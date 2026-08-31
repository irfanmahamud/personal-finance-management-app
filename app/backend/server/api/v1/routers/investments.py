import uuid
from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.investment import InvestmentCreate, InvestmentOut, InvestmentPatch, PortfolioOut
from server.services import investments as service

router = APIRouter(prefix="/investments", tags=["investments"])


@router.get("", response_model=list[InvestmentOut])
async def list_investments(
    db: DbSession, user: ActiveUser, include_inactive: bool = False
) -> list[InvestmentOut]:
    return await service.list_investments(db, user.household_id, date.today(), include_inactive)


@router.get("/portfolio", response_model=PortfolioOut)
async def portfolio(db: DbSession, user: ActiveUser) -> PortfolioOut:
    return await service.portfolio(db, user.household_id, date.today())


@router.post("", response_model=InvestmentOut, status_code=201)
async def create_investment(
    body: InvestmentCreate, db: DbSession, user: ActiveUser
) -> InvestmentOut:
    return await service.create(db, user.household_id, body, date.today())


@router.patch("/{investment_id}", response_model=InvestmentOut)
async def patch_investment(
    investment_id: uuid.UUID, body: InvestmentPatch, db: DbSession, user: ActiveUser
) -> InvestmentOut:
    return await service.patch(db, user.household_id, investment_id, body, date.today())


@router.delete("/{investment_id}", status_code=204)
async def delete_investment(investment_id: uuid.UUID, db: DbSession, user: ActiveUser) -> None:
    await service.delete(db, user.household_id, investment_id)
