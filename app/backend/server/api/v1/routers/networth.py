import uuid
from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.networth import (
    AssetCreate,
    AssetOut,
    AssetPatch,
    NetWorthBreakdown,
    NetWorthSnapshotOut,
)
from server.services import networth as service

router = APIRouter(prefix="/networth", tags=["networth"])


@router.get("/current", response_model=NetWorthBreakdown)
async def current(db: DbSession, user: ActiveUser) -> NetWorthBreakdown:
    return await service.current(db, user.household_id, date.today())


@router.get("/history", response_model=list[NetWorthSnapshotOut])
async def history(db: DbSession, user: ActiveUser, limit: int = 24) -> list[NetWorthSnapshotOut]:
    return await service.history(db, user.household_id, limit)


@router.get("/assets", response_model=list[AssetOut])
async def list_assets(
    db: DbSession, user: ActiveUser, include_inactive: bool = False
) -> list[AssetOut]:
    return await service.list_assets(db, user.household_id, include_inactive)


@router.post("/assets", response_model=AssetOut, status_code=201)
async def create_asset(body: AssetCreate, db: DbSession, user: ActiveUser) -> AssetOut:
    return await service.create_asset(db, user.household_id, user.user_id, body, date.today())


@router.patch("/assets/{asset_id}", response_model=AssetOut)
async def patch_asset(
    asset_id: uuid.UUID, body: AssetPatch, db: DbSession, user: ActiveUser
) -> AssetOut:
    return await service.patch_asset(db, user.household_id, user.user_id, asset_id, body, date.today())


@router.delete("/assets/{asset_id}", status_code=204)
async def delete_asset(asset_id: uuid.UUID, db: DbSession, user: ActiveUser) -> None:
    await service.delete_asset(db, user.household_id, asset_id)
