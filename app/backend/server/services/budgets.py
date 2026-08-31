import uuid
from datetime import date as date_type

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import ConflictError, DomainValidationError, NotFoundError
from server.db.models import Budget, BudgetLine, Category, Expense, Household
from server.schemas.budget import (
    BudgetCreate,
    BudgetLineIn,
    BudgetLineOut,
    BudgetLinePatch,
    BudgetOut,
    BudgetSummary,
)
from server.services.periods import (
    fiscal_year_label,
    month_period,
    rollover_amount,
)

# Template allocation: fraction (basis points out of 10_000) of total_amount
# per top-level category name_en. Only categories that exist for the
# household are used; a missing one is skipped, not an error.
TEMPLATES: dict[str, dict[str, int]] = {
    "young_professional": {
        "Housing": 3000, "Utilities": 800, "Grocery & Food": 2000,
        "Transport": 800, "Clothing": 400, "Festivals & Entertainment": 800,
        "Savings & Investment": 2000, "One-time/Irregular": 200,
    },
    "young_family": {
        "Housing": 2500, "Utilities": 700, "Grocery & Food": 2000,
        "Child Care": 1500, "Health & Medical": 600, "Transport": 600,
        "Clothing": 300, "Festivals & Entertainment": 400,
        "Savings & Investment": 1200, "One-time/Irregular": 200,
    },
    "extended_family": {
        "Housing": 2200, "Utilities": 700, "Grocery & Food": 2000,
        "Child Care": 1200, "Health & Medical": 700, "Transport": 500,
        "Clothing": 300, "Family Allowances": 1200,
        "Festivals & Entertainment": 300, "Savings & Investment": 800,
        "One-time/Irregular": 100,
    },
}


def _line_status(amount: int, rolled: int, spent: int) -> str:
    limit = amount + rolled
    if limit <= 0:
        return "ok" if spent == 0 else "warn95"
    ratio = spent / limit
    if ratio >= 0.95:
        return "warn95"
    if ratio >= 0.75:
        return "warn75"
    return "ok"


async def _spent_by_category(
    db: AsyncSession, household_id: uuid.UUID, start: date_type, end: date_type
) -> dict[uuid.UUID, int]:
    rows = (
        await db.execute(
            select(Expense.category_id, func.sum(Expense.amount_bdt))
            .where(
                Expense.household_id == household_id,
                Expense.date >= start,
                Expense.date <= end,
            )
            .group_by(Expense.category_id)
        )
    ).all()
    return {r[0]: int(r[1]) for r in rows}


async def _to_out(db: AsyncSession, budget: Budget) -> BudgetOut:
    lines = (
        await db.execute(
            select(BudgetLine, Category.name_en, Category.name_bn, Category.icon, Category.parent_id)
            .join(Category, Category.id == BudgetLine.category_id)
            .where(BudgetLine.budget_id == budget.id)
            .order_by(Category.sort_order)
        )
    ).all()
    spent_map = await _spent_by_category(
        db, budget.household_id, budget.period_start, budget.period_end
    )
    # Budget lines are top-level categories; a line's spend includes its subs.
    children = (
        await db.execute(
            select(Category.id, Category.parent_id).where(
                Category.household_id == budget.household_id,
                Category.parent_id.is_not(None),
            )
        )
    ).all()
    subs_of: dict[uuid.UUID, list[uuid.UUID]] = {}
    for child_id, parent_id in children:
        subs_of.setdefault(parent_id, []).append(child_id)

    out_lines: list[BudgetLineOut] = []
    household = await db.get(Household, budget.household_id)
    for row in lines:
        line: BudgetLine = row.BudgetLine
        cat_ids = [line.category_id, *subs_of.get(line.category_id, [])]
        spent = sum(spent_map.get(cid, 0) for cid in cat_ids)
        available = line.amount + line.rolled_over_amount - spent
        out_lines.append(
            BudgetLineOut(
                id=line.id,
                category_id=line.category_id,
                category_name_en=row.name_en,
                category_name_bn=row.name_bn,
                icon=row.icon,
                amount=line.amount,
                rolled_over_amount=line.rolled_over_amount,
                spent=spent,
                available=available,
                status=_line_status(line.amount, line.rolled_over_amount, spent),
                rollover_enabled=line.rollover_enabled,
            )
        )
    return BudgetOut(
        id=budget.id,
        period_start=budget.period_start,
        period_end=budget.period_end,
        fiscal_year=fiscal_year_label(
            budget.period_start, household.fiscal_year_start if household else 7
        ),
        method=budget.method,
        total_amount=sum(l.amount + l.rolled_over_amount for l in out_lines),
        total_spent=sum(l.spent for l in out_lines),
        lines=out_lines,
    )


async def get_by_period(
    db: AsyncSession, household_id: uuid.UUID, day_in_period: date_type
) -> BudgetOut:
    start, _ = month_period(day_in_period)
    budget = (
        await db.execute(
            select(Budget).where(
                Budget.household_id == household_id,
                Budget.period_start == start,
            )
        )
    ).scalar_one_or_none()
    if budget is None:
        raise NotFoundError("No budget for that period")
    return await _to_out(db, budget)


async def get_current(
    db: AsyncSession, household_id: uuid.UUID, today: date_type
) -> BudgetOut:
    return await get_by_period(db, household_id, today)


async def list_history(
    db: AsyncSession, household_id: uuid.UUID, limit: int = 12
) -> list[BudgetSummary]:
    budgets = (
        (
            await db.execute(
                select(Budget)
                .where(Budget.household_id == household_id)
                .order_by(Budget.period_start.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    summaries = []
    for budget in budgets:
        full = await _to_out(db, budget)
        summaries.append(
            BudgetSummary(
                id=full.id,
                period_start=full.period_start,
                period_end=full.period_end,
                method=full.method,
                total_amount=full.total_amount,
                total_spent=full.total_spent,
            )
        )
    return summaries


async def create(
    db: AsyncSession, household_id: uuid.UUID, body: BudgetCreate, today: date_type
) -> BudgetOut:
    start, end = month_period(body.period_start or today)

    existing = (
        await db.execute(
            select(Budget.id).where(
                Budget.household_id == household_id, Budget.period_start == start
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("A budget for this period already exists")

    # Resolve lines: template percentages over total, or explicit lines.
    lines: list[tuple[uuid.UUID, int, bool]] = []  # (category_id, amount, rollover)
    if body.template is not None:
        if body.total_amount is None:
            raise DomainValidationError("total_amount is required with a template")
        allocation = TEMPLATES[body.template]
        cats = (
            await db.execute(
                select(Category).where(
                    Category.household_id == household_id,
                    Category.parent_id.is_(None),
                    Category.archived.is_(False),
                )
            )
        ).scalars().all()
        by_name = {c.name_en: c for c in cats}
        for name, bps in allocation.items():
            cat = by_name.get(name)
            if cat is not None:
                lines.append((cat.id, body.total_amount * bps // 10_000, False))
    elif body.lines:
        for line in body.lines:
            cat = await db.get(Category, line.category_id)
            if cat is None or cat.household_id != household_id:
                raise NotFoundError("Category not found")
            lines.append((line.category_id, line.amount, line.rollover_enabled))
    else:
        raise DomainValidationError("Provide a template or explicit lines")

    # Rollover from the previous period where that line opted in (§3.3.3).
    rollover_by_cat: dict[uuid.UUID, int] = {}
    if body.apply_rollover:
        prev = (
            await db.execute(
                select(Budget)
                .where(Budget.household_id == household_id, Budget.period_start < start)
                .order_by(Budget.period_start.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if prev is not None:
            prev_out = await _to_out(db, prev)
            for line in prev_out.lines:
                if line.rollover_enabled:
                    rollover_by_cat[line.category_id] = rollover_amount(
                        line.amount, line.rolled_over_amount, line.spent
                    )

    budget = Budget(
        household_id=household_id,
        period_start=start,
        period_end=end,
        method="template" if body.template else "custom",
    )
    db.add(budget)
    await db.flush()
    for category_id, amount, rollover_enabled in lines:
        db.add(
            BudgetLine(
                budget_id=budget.id,
                category_id=category_id,
                amount=amount,
                rollover_enabled=rollover_enabled,
                rolled_over_amount=rollover_by_cat.get(category_id, 0),
            )
        )
    await db.commit()
    await db.refresh(budget)
    return await _to_out(db, budget)


async def add_line(
    db: AsyncSession,
    household_id: uuid.UUID,
    budget_id: uuid.UUID,
    body: BudgetLineIn,
) -> BudgetOut:
    budget = await db.get(Budget, budget_id)
    if budget is None or budget.household_id != household_id:
        raise NotFoundError("Budget not found")

    category = await db.get(Category, body.category_id)
    if category is None or category.household_id != household_id:
        raise NotFoundError("Category not found")
    if category.parent_id is not None:
        raise DomainValidationError("Budget lines track top-level categories only")

    existing = (
        await db.execute(
            select(BudgetLine.id).where(
                BudgetLine.budget_id == budget_id, BudgetLine.category_id == body.category_id
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("This category already has a line in the budget")

    db.add(
        BudgetLine(
            budget_id=budget_id,
            category_id=body.category_id,
            amount=body.amount,
            rollover_enabled=body.rollover_enabled,
        )
    )
    await db.commit()
    return await _to_out(db, budget)


async def patch_line(
    db: AsyncSession,
    household_id: uuid.UUID,
    budget_id: uuid.UUID,
    line_id: uuid.UUID,
    body: BudgetLinePatch,
) -> BudgetOut:
    budget = await db.get(Budget, budget_id)
    if budget is None or budget.household_id != household_id:
        raise NotFoundError("Budget not found")
    line = await db.get(BudgetLine, line_id)
    if line is None or line.budget_id != budget_id:
        raise NotFoundError("Budget line not found")
    if body.amount is not None:
        line.amount = body.amount
    if body.rollover_enabled is not None:
        line.rollover_enabled = body.rollover_enabled
    await db.commit()
    return await _to_out(db, budget)
