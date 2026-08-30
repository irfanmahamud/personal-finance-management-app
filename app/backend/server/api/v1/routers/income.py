import uuid
from datetime import date

from fastapi import APIRouter, Query

from server.core.deps import ActiveUser, DbSession
from server.schemas.income import (
    DeductionCreate,
    DeductionOut,
    IncomeSourceCreate,
    IncomeSourceOut,
    IncomeSourcePatch,
    TaxEstimateOut,
)
from server.services import income as service

router = APIRouter(tags=["income"])


@router.get("/income-sources", response_model=list[IncomeSourceOut])
async def list_sources(db: DbSession, user: ActiveUser) -> list[IncomeSourceOut]:
    return await service.list_sources(db, user.household_id)


@router.post("/income-sources", response_model=IncomeSourceOut, status_code=201)
async def create_source(
    body: IncomeSourceCreate, db: DbSession, user: ActiveUser
) -> IncomeSourceOut:
    return await service.create_source(db, user.household_id, body)


@router.patch("/income-sources/{source_id}", response_model=IncomeSourceOut)
async def patch_source(
    source_id: uuid.UUID, body: IncomeSourcePatch, db: DbSession, user: ActiveUser
) -> IncomeSourceOut:
    return await service.patch_source(db, user.household_id, source_id, body)


@router.get("/deductions", response_model=list[DeductionOut])
async def list_deductions(db: DbSession, user: ActiveUser) -> list[DeductionOut]:
    return await service.list_deductions(db, user.household_id)


@router.post("/deductions", response_model=DeductionOut, status_code=201)
async def create_deduction(
    body: DeductionCreate, db: DbSession, user: ActiveUser
) -> DeductionOut:
    return await service.create_deduction(db, user.household_id, body)


@router.delete("/deductions/{deduction_id}", status_code=204)
async def delete_deduction(
    deduction_id: uuid.UUID, db: DbSession, user: ActiveUser
) -> None:
    await service.delete_deduction(db, user.household_id, deduction_id)


@router.get("/tax/estimate", response_model=TaxEstimateOut)
async def tax_estimate(
    db: DbSession,
    user: ActiveUser,
    eligible_investment: int = Query(default=0, ge=0),
    taxpayer_category: str = Query(
        default="general",
        pattern="^(general|female_or_senior|disabled|freedom_fighter)$",
    ),
) -> TaxEstimateOut:
    return await service.tax_estimate(
        db, user.household_id, date.today(), eligible_investment, taxpayer_category
    )
