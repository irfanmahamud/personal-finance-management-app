import uuid
from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.expense import ExpenseOut
from server.schemas.recurring import (
    RecurringMarkPaid,
    RecurringRuleCreate,
    RecurringRuleOut,
    RecurringRulePatch,
)
from server.services import recurring as service

router = APIRouter(prefix="/recurring", tags=["recurring"])


@router.get("", response_model=list[RecurringRuleOut])
async def list_recurring(
    db: DbSession, user: ActiveUser, include_inactive: bool = False
) -> list[RecurringRuleOut]:
    return await service.list_rules(db, user.household_id, date.today(), include_inactive)


@router.post("", response_model=RecurringRuleOut, status_code=201)
async def create_recurring(
    body: RecurringRuleCreate, db: DbSession, user: ActiveUser
) -> RecurringRuleOut:
    return await service.create(db, user.household_id, body, date.today())


@router.patch("/{rule_id}", response_model=RecurringRuleOut)
async def patch_recurring(
    rule_id: uuid.UUID, body: RecurringRulePatch, db: DbSession, user: ActiveUser
) -> RecurringRuleOut:
    return await service.patch(db, user.household_id, rule_id, body, date.today())


@router.delete("/{rule_id}", status_code=204)
async def delete_recurring(rule_id: uuid.UUID, db: DbSession, user: ActiveUser) -> None:
    await service.delete(db, user.household_id, rule_id)


@router.post("/{rule_id}/mark-paid", response_model=ExpenseOut, status_code=201)
async def mark_paid(
    rule_id: uuid.UUID, body: RecurringMarkPaid, db: DbSession, user: ActiveUser
) -> ExpenseOut:
    return await service.mark_paid(db, user.household_id, user.user_id, rule_id, body, date.today())


@router.post("/{rule_id}/skip", response_model=RecurringRuleOut)
async def skip_recurring(rule_id: uuid.UUID, db: DbSession, user: ActiveUser) -> RecurringRuleOut:
    return await service.skip(db, user.household_id, rule_id, date.today())
