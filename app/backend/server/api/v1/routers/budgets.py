import uuid
from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.budget import BudgetCreate, BudgetLinePatch, BudgetOut
from server.services import budgets as service

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/current", response_model=BudgetOut)
async def current_budget(db: DbSession, user: ActiveUser) -> BudgetOut:
    return await service.get_current(db, user.household_id, date.today())


@router.post("", response_model=BudgetOut, status_code=201)
async def create_budget(
    body: BudgetCreate, db: DbSession, user: ActiveUser
) -> BudgetOut:
    return await service.create(db, user.household_id, body, date.today())


@router.patch("/{budget_id}/lines/{line_id}", response_model=BudgetOut)
async def patch_budget_line(
    budget_id: uuid.UUID,
    line_id: uuid.UUID,
    body: BudgetLinePatch,
    db: DbSession,
    user: ActiveUser,
) -> BudgetOut:
    return await service.patch_line(db, user.household_id, budget_id, line_id, body)
