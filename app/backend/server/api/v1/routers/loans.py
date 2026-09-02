import uuid
from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.loan import (
    LoanGivenCreate,
    LoanGivenOut,
    LoanGivenPatch,
    LoanGivenPaymentCreate,
    LoanGivenPaymentOut,
    LoanSummaryOut,
)
from server.services import loans as service

router = APIRouter(prefix="/loans", tags=["loans"])


@router.get("", response_model=list[LoanGivenOut])
async def list_loans(
    db: DbSession, user: ActiveUser, include_inactive: bool = False
) -> list[LoanGivenOut]:
    return await service.list_loans(db, user.household_id, date.today(), include_inactive)


@router.get("/summary", response_model=LoanSummaryOut)
async def loan_summary(db: DbSession, user: ActiveUser) -> LoanSummaryOut:
    return await service.summary(db, user.household_id, date.today())


@router.post("", response_model=LoanGivenOut, status_code=201)
async def create_loan(body: LoanGivenCreate, db: DbSession, user: ActiveUser) -> LoanGivenOut:
    return await service.create(db, user.household_id, body, date.today())


@router.patch("/{loan_id}", response_model=LoanGivenOut)
async def patch_loan(
    loan_id: uuid.UUID, body: LoanGivenPatch, db: DbSession, user: ActiveUser
) -> LoanGivenOut:
    return await service.patch(db, user.household_id, loan_id, body, date.today())


@router.delete("/{loan_id}", status_code=204)
async def delete_loan(loan_id: uuid.UUID, db: DbSession, user: ActiveUser) -> None:
    await service.delete(db, user.household_id, loan_id)


@router.get("/{loan_id}/payments", response_model=list[LoanGivenPaymentOut])
async def list_payments(loan_id: uuid.UUID, db: DbSession, user: ActiveUser) -> list[LoanGivenPaymentOut]:
    return await service.list_payments(db, user.household_id, loan_id)


@router.post("/{loan_id}/payments", response_model=LoanGivenOut, status_code=201)
async def add_payment(
    loan_id: uuid.UUID, body: LoanGivenPaymentCreate, db: DbSession, user: ActiveUser
) -> LoanGivenOut:
    return await service.add_payment(db, user.household_id, loan_id, body, date.today())
