import uuid
from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Query, Response

from server.core.deps import ActiveUser, DbSession
from server.schemas.expense import (
    ExpenseCreate,
    ExpenseListOut,
    ExpenseOut,
    ExpensePatch,
    RecentOut,
    SuggestionOut,
)
from server.services import expenses as service

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.post("", response_model=ExpenseOut, status_code=201)
async def create_expense(
    body: ExpenseCreate, response: Response, db: DbSession, user: ActiveUser
) -> ExpenseOut:
    out, created = await service.create(db, user.household_id, user.user_id, body)
    if not created:
        # Idempotent replay: same resource, but signal it wasn't re-created.
        response.status_code = 200
    return out


@router.get("/recent", response_model=RecentOut)
async def recent(db: DbSession, user: ActiveUser) -> RecentOut:
    return await service.recent(
        db, user.household_id, user.user_id, datetime.now().hour
    )


@router.get("/suggestions", response_model=list[SuggestionOut])
async def description_suggestions(
    db: DbSession,
    user: ActiveUser,
    category_id: uuid.UUID | None = None,
    limit: int = Query(default=100, le=200),
) -> list[SuggestionOut]:
    return await service.description_suggestions(
        db, user.household_id, category_id, limit
    )


@router.get("", response_model=ExpenseListOut)
async def list_expenses(
    db: DbSession,
    user: ActiveUser,
    date_from: date_type | None = None,
    date_to: date_type | None = None,
    category_id: uuid.UUID | None = None,
    member_id: uuid.UUID | None = None,
    payment_method_id: uuid.UUID | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> ExpenseListOut:
    return await service.list_expenses(
        db,
        user.household_id,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        member_id=member_id,
        payment_method_id=payment_method_id,
        limit=limit,
        offset=offset,
    )


@router.patch("/{expense_id}", response_model=ExpenseOut)
async def patch_expense(
    expense_id: uuid.UUID, body: ExpensePatch, db: DbSession, user: ActiveUser
) -> ExpenseOut:
    return await service.patch(db, user.household_id, expense_id, body)


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: uuid.UUID, db: DbSession, user: ActiveUser
) -> None:
    await service.delete(db, user.household_id, expense_id)
