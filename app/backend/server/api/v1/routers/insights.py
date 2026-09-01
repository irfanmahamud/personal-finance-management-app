from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.insight import InsightOut
from server.services import insights as service

router = APIRouter(tags=["insights"])


@router.get("/insights", response_model=list[InsightOut])
async def list_insights(db: DbSession, user: ActiveUser) -> list[InsightOut]:
    return await service.list_insights(db, user.household_id, date.today())
