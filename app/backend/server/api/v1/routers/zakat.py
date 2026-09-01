from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.zakat import ZakatConfigOut, ZakatConfigPatch, ZakatEstimateOut
from server.services import zakat as service

router = APIRouter(prefix="/zakat", tags=["zakat"])


@router.get("/estimate", response_model=ZakatEstimateOut)
async def zakat_estimate(db: DbSession, user: ActiveUser) -> ZakatEstimateOut:
    return await service.estimate(db, user.household_id, date.today())


@router.get("/config", response_model=ZakatConfigOut)
async def get_zakat_config(db: DbSession, user: ActiveUser) -> ZakatConfigOut:
    return await service.get_config(db)


@router.patch("/config", response_model=ZakatConfigOut)
async def patch_zakat_config(
    body: ZakatConfigPatch, db: DbSession, user: ActiveUser
) -> ZakatConfigOut:
    return await service.patch_config(db, body)
