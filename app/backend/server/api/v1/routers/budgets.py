import uuid
from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.core.errors import DomainValidationError
from server.schemas.budget import (
    BudgetCreate,
    BudgetLineIn,
    BudgetLinePatch,
    BudgetOut,
    BudgetSummary,
)
from server.services import budgets as service

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/current", response_model=BudgetOut)
async def current_budget(db: DbSession, user: ActiveUser) -> BudgetOut:
    return await service.get_current(db, user.household_id, date.today())


@router.get("/history", response_model=list[BudgetSummary])
async def budget_history(db: DbSession, user: ActiveUser, limit: int = 12) -> list[BudgetSummary]:
    return await service.list_history(db, user.household_id, limit)


@router.get("/{period}", response_model=BudgetOut)
async def budget_for_period(period: str, db: DbSession, user: ActiveUser) -> BudgetOut:
    try:
        day = date.fromisoformat(f"{period}-01")
    except ValueError as exc:
        raise DomainValidationError("period must be YYYY-MM") from exc
    return await service.get_by_period(db, user.household_id, day)


@router.post("", response_model=BudgetOut, status_code=201)
async def create_budget(
    body: BudgetCreate, db: DbSession, user: ActiveUser
) -> BudgetOut:
    return await service.create(db, user.household_id, body, date.today())


@router.post("/{budget_id}/lines", response_model=BudgetOut, status_code=201)
async def add_budget_line(
    budget_id: uuid.UUID, body: BudgetLineIn, db: DbSession, user: ActiveUser
) -> BudgetOut:
    return await service.add_line(db, user.household_id, budget_id, body)


@router.patch("/{budget_id}/lines/{line_id}", response_model=BudgetOut)
async def patch_budget_line(
    budget_id: uuid.UUID,
    line_id: uuid.UUID,
    body: BudgetLinePatch,
    db: DbSession,
    user: ActiveUser,
) -> BudgetOut:
    return await service.patch_line(db, user.household_id, budget_id, line_id, body)
