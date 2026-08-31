"""Recurring expenses & bills (spec §3.4.5, §3.8).

Occurrences are generated lazily: a rule just carries a `next_due_date`
that a request-time query compares to today for status, and "mark paid"
advances it by one calendar month. No background job queue - a household
app does not need Bull + Redis to know rent is due on the 1st.
"""

import calendar
import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import DomainValidationError, NotFoundError
from server.db.models import Category, Expense, RecurringRule
from server.schemas.expense import ExpenseCreate, ExpenseOut
from server.schemas.recurring import (
    RecurringMarkPaid,
    RecurringRuleCreate,
    RecurringRuleOut,
    RecurringRulePatch,
)
from server.services import expenses as expense_service


def _advance_month(d: date_type, day_of_month: int) -> date_type:
    month = d.month + 1
    year = d.year
    if month > 12:
        month = 1
        year += 1
    last_day = calendar.monthrange(year, month)[1]
    return date_type(year, month, min(day_of_month, last_day))


def _initial_due_date(today: date_type, day_of_month: int) -> date_type:
    last_day = calendar.monthrange(today.year, today.month)[1]
    candidate = date_type(today.year, today.month, min(day_of_month, last_day))
    return candidate if candidate >= today else _advance_month(today, day_of_month)


def _status(next_due: date_type, today: date_type, active: bool) -> str:
    if not active:
        return "inactive"
    delta = (next_due - today).days
    if delta < 0:
        return "overdue"
    if delta == 0:
        return "due_today"
    if delta <= 3:
        return "due_soon"
    return "upcoming"


async def _to_out(db: AsyncSession, rule: RecurringRule, today: date_type) -> RecurringRuleOut:
    category = await db.get(Category, rule.category_id)
    last_paid = (
        await db.execute(
            select(Expense.date)
            .where(Expense.recurring_rule_id == rule.id)
            .order_by(Expense.date.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return RecurringRuleOut(
        id=rule.id,
        name=rule.name,
        category_id=rule.category_id,
        category_name_en=category.name_en if category else "",
        category_name_bn=category.name_bn if category else "",
        icon=category.icon if category else None,
        amount=rule.amount,
        payment_method_id=rule.payment_method_id,
        for_member_id=rule.for_member_id,
        day_of_month=rule.day_of_month,
        next_due_date=rule.next_due_date,
        status=_status(rule.next_due_date, today, rule.active),
        active=rule.active,
        notes=rule.notes,
        last_paid_date=last_paid,
    )


async def list_rules(
    db: AsyncSession, household_id: uuid.UUID, today: date_type, include_inactive: bool = False
) -> list[RecurringRuleOut]:
    stmt = select(RecurringRule).where(RecurringRule.household_id == household_id)
    if not include_inactive:
        stmt = stmt.where(RecurringRule.active.is_(True))
    stmt = stmt.order_by(RecurringRule.next_due_date)
    rules = (await db.execute(stmt)).scalars().all()
    return [await _to_out(db, r, today) for r in rules]


async def _get_owned(db: AsyncSession, household_id: uuid.UUID, rule_id: uuid.UUID) -> RecurringRule:
    rule = await db.get(RecurringRule, rule_id)
    if rule is None or rule.household_id != household_id:
        raise NotFoundError("Recurring rule not found")
    return rule


async def create(
    db: AsyncSession, household_id: uuid.UUID, body: RecurringRuleCreate, today: date_type
) -> RecurringRuleOut:
    category = await db.get(Category, body.category_id)
    if category is None or category.household_id != household_id:
        raise NotFoundError("Category not found")

    rule = RecurringRule(
        household_id=household_id,
        name=body.name,
        category_id=body.category_id,
        amount=body.amount,
        payment_method_id=body.payment_method_id,
        for_member_id=body.for_member_id,
        day_of_month=body.day_of_month,
        next_due_date=_initial_due_date(today, body.day_of_month),
        notes=body.notes,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return await _to_out(db, rule, today)


async def patch(
    db: AsyncSession,
    household_id: uuid.UUID,
    rule_id: uuid.UUID,
    body: RecurringRulePatch,
    today: date_type,
) -> RecurringRuleOut:
    rule = await _get_owned(db, household_id, rule_id)

    if body.category_id is not None:
        category = await db.get(Category, body.category_id)
        if category is None or category.household_id != household_id:
            raise NotFoundError("Category not found")
        rule.category_id = body.category_id
    if body.name is not None:
        rule.name = body.name
    if body.amount is not None:
        rule.amount = body.amount
    if body.payment_method_id is not None:
        rule.payment_method_id = body.payment_method_id
    if body.for_member_id is not None:
        rule.for_member_id = body.for_member_id
    if body.day_of_month is not None:
        rule.day_of_month = body.day_of_month
        rule.next_due_date = _initial_due_date(today, body.day_of_month)
    if body.active is not None:
        rule.active = body.active
    if body.notes is not None:
        rule.notes = body.notes

    await db.commit()
    return await _to_out(db, rule, today)


async def delete(db: AsyncSession, household_id: uuid.UUID, rule_id: uuid.UUID) -> None:
    rule = await _get_owned(db, household_id, rule_id)
    await db.delete(rule)
    await db.commit()


async def mark_paid(
    db: AsyncSession,
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    rule_id: uuid.UUID,
    body: RecurringMarkPaid,
    today: date_type,
) -> ExpenseOut:
    rule = await _get_owned(db, household_id, rule_id)
    if not rule.active:
        raise DomainValidationError("Recurring rule is inactive")

    expense_out, _created = await expense_service.create(
        db,
        household_id,
        user_id,
        ExpenseCreate(
            client_uuid=uuid.uuid4(),
            date=body.date or today,
            category_id=rule.category_id,
            amount=body.amount if body.amount is not None else rule.amount,
            payment_method_id=rule.payment_method_id,
            for_member_id=rule.for_member_id,
            description=rule.name,
        ),
    )

    # expense_service.create doesn't know about recurring rules - stamp the
    # provenance link (powers this rule's payment history) after the fact.
    expense_row = await db.get(Expense, expense_out.id)
    expense_row.recurring_rule_id = rule.id

    rule.next_due_date = _advance_month(rule.next_due_date, rule.day_of_month)
    await db.commit()
    return expense_out


async def skip(
    db: AsyncSession, household_id: uuid.UUID, rule_id: uuid.UUID, today: date_type
) -> RecurringRuleOut:
    rule = await _get_owned(db, household_id, rule_id)
    rule.next_due_date = _advance_month(rule.next_due_date, rule.day_of_month)
    await db.commit()
    return await _to_out(db, rule, today)
