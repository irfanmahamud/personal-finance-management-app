import uuid
from datetime import date

from fastapi import APIRouter, Query

from server.core.deps import ActiveUser, DbSession
from server.schemas.debt import (
    DebtCreate,
    DebtOut,
    DebtPatch,
    DebtPaymentCreate,
    DebtPaymentOut,
    EmiCalculation,
    PayoffComparisonOut,
)
from server.services import debts as service

router = APIRouter(prefix="/debts", tags=["debts"])


@router.get("", response_model=list[DebtOut])
async def list_debts(
    db: DbSession, user: ActiveUser, include_inactive: bool = False
) -> list[DebtOut]:
    return await service.list_debts(db, user.household_id, date.today(), include_inactive)


@router.get("/emi-calculator", response_model=EmiCalculation)
async def emi_calculator(
    principal: int = Query(gt=0),
    annual_rate_bps: int = Query(ge=0),
    term_months: int = Query(gt=0, le=600),
) -> EmiCalculation:
    return service.emi_calculator(principal, annual_rate_bps, term_months)


@router.get("/payoff-comparison", response_model=PayoffComparisonOut)
async def payoff_comparison(
    db: DbSession, user: ActiveUser, extra_monthly: int = Query(default=0, ge=0)
) -> PayoffComparisonOut:
    return await service.payoff_comparison(db, user.household_id, date.today(), extra_monthly)


@router.post("", response_model=DebtOut, status_code=201)
async def create_debt(body: DebtCreate, db: DbSession, user: ActiveUser) -> DebtOut:
    return await service.create(db, user.household_id, body, date.today())


@router.patch("/{debt_id}", response_model=DebtOut)
async def patch_debt(
    debt_id: uuid.UUID, body: DebtPatch, db: DbSession, user: ActiveUser
) -> DebtOut:
    return await service.patch(db, user.household_id, debt_id, body, date.today())


@router.delete("/{debt_id}", status_code=204)
async def delete_debt(debt_id: uuid.UUID, db: DbSession, user: ActiveUser) -> None:
    await service.delete(db, user.household_id, debt_id)


@router.get("/{debt_id}/payments", response_model=list[DebtPaymentOut])
async def list_payments(debt_id: uuid.UUID, db: DbSession, user: ActiveUser) -> list[DebtPaymentOut]:
    return await service.list_payments(db, user.household_id, debt_id)


@router.post("/{debt_id}/payments", response_model=DebtOut, status_code=201)
async def add_payment(
    debt_id: uuid.UUID, body: DebtPaymentCreate, db: DbSession, user: ActiveUser
) -> DebtOut:
    return await service.add_payment(db, user.household_id, debt_id, body, date.today())
