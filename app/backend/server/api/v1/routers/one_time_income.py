import uuid
from datetime import date

from fastapi import APIRouter, Query

from server.core.deps import ActiveUser, DbSession
from server.schemas.one_time_income import (
    OneTimeIncomeCreate,
    OneTimeIncomeOut,
    OneTimeIncomePatch,
)
from server.services import one_time_income as service

router = APIRouter(prefix="/one-time-income", tags=["one-time-income"])


@router.get("", response_model=list[OneTimeIncomeOut])
async def list_entries(
    db: DbSession,
    user: ActiveUser,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> list[OneTimeIncomeOut]:
    return await service.list_entries(db, user.household_id, date_from, date_to)


@router.post("", response_model=OneTimeIncomeOut, status_code=201)
async def create_entry(body: OneTimeIncomeCreate, db: DbSession, user: ActiveUser) -> OneTimeIncomeOut:
    return await service.create(db, user.household_id, body)


@router.patch("/{entry_id}", response_model=OneTimeIncomeOut)
async def patch_entry(
    entry_id: uuid.UUID, body: OneTimeIncomePatch, db: DbSession, user: ActiveUser
) -> OneTimeIncomeOut:
    return await service.patch(db, user.household_id, entry_id, body)


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(entry_id: uuid.UUID, db: DbSession, user: ActiveUser) -> None:
    await service.delete(db, user.household_id, entry_id)
