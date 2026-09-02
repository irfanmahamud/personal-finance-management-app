"""Loans given (a new module, not spec-numbered - explicitly requested):
tracking money the household lends to people, mirroring the Debt manager
(§3.9) but inverted - the household is the lender, not the borrower.
Interest is optional; a loan with no interest_rate_bps is interest-free
and every repayment reduces principal directly.
"""

import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import DomainValidationError, NotFoundError
from server.db.models import Expense, LoanGiven, LoanGivenPayment
from server.schemas.expense import ExpenseCreate
from server.schemas.loan import (
    LoanGivenCreate,
    LoanGivenOut,
    LoanGivenPatch,
    LoanGivenPaymentCreate,
    LoanGivenPaymentOut,
    LoanSummaryOut,
)
from server.services import expenses as expense_service

DUE_SOON_DAYS = 7  # same threshold convention as Investment's RENEWAL_DUE_DAYS


def _status(loan: LoanGiven, today: date_type) -> str:
    if not loan.active:
        return "inactive"
    if loan.current_balance <= 0:
        return "paid_off"
    if loan.due_date is None:
        return "no_due_date"
    delta = (loan.due_date - today).days
    if delta < 0:
        return "overdue"
    if delta <= DUE_SOON_DAYS:
        return "due_soon"
    return "upcoming"


async def _to_out(db: AsyncSession, loan: LoanGiven, today: date_type) -> LoanGivenOut:
    payments = (
        (
            await db.execute(
                select(LoanGivenPayment).where(LoanGivenPayment.loan_id == loan.id)
            )
        )
        .scalars()
        .all()
    )
    total_repaid = sum(p.amount for p in payments)
    total_interest_earned = sum(p.interest_portion for p in payments)
    total_principal_repaid = sum(p.principal_portion for p in payments)

    return LoanGivenOut(
        id=loan.id,
        borrower_name=loan.borrower_name,
        borrower_contact=loan.borrower_contact,
        principal=loan.principal,
        current_balance=loan.current_balance,
        interest_rate_bps=loan.interest_rate_bps,
        start_date=loan.start_date,
        due_date=loan.due_date,
        active=loan.active,
        notes=loan.notes,
        paid_off=loan.current_balance <= 0,
        status=_status(loan, today),
        total_repaid=total_repaid,
        total_interest_earned=total_interest_earned,
        total_principal_repaid=total_principal_repaid,
    )


async def list_loans(
    db: AsyncSession, household_id: uuid.UUID, today: date_type, include_inactive: bool = False
) -> list[LoanGivenOut]:
    stmt = select(LoanGiven).where(LoanGiven.household_id == household_id)
    if not include_inactive:
        stmt = stmt.where(LoanGiven.active.is_(True))
    stmt = stmt.order_by(LoanGiven.due_date.is_(None), LoanGiven.due_date)
    loans = (await db.execute(stmt)).scalars().all()
    return [await _to_out(db, loan, today) for loan in loans]


async def _get_owned(db: AsyncSession, household_id: uuid.UUID, loan_id: uuid.UUID) -> LoanGiven:
    loan = await db.get(LoanGiven, loan_id)
    if loan is None or loan.household_id != household_id:
        raise NotFoundError("Loan not found")
    return loan


async def create(
    db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID, body: LoanGivenCreate, today: date_type
) -> LoanGivenOut:
    if body.log_as_expense and body.category_id is None:
        raise DomainValidationError("category_id is required to log this loan as an expense")

    loan = LoanGiven(
        household_id=household_id,
        borrower_name=body.borrower_name,
        borrower_contact=body.borrower_contact,
        principal=body.principal,
        current_balance=body.principal,
        interest_rate_bps=body.interest_rate_bps,
        start_date=body.start_date,
        due_date=body.due_date,
        notes=body.notes,
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)

    if body.log_as_expense:
        expense_out, _created = await expense_service.create(
            db,
            household_id,
            user_id,
            ExpenseCreate(
                client_uuid=uuid.uuid4(),
                date=body.start_date or today,
                category_id=body.category_id,
                amount=body.principal,
                payment_method_id=body.payment_method_id,
                for_member_id=body.for_member_id,
                description=f"Loan to {body.borrower_name}",
            ),
        )
        # expense_service.create doesn't know about loans - stamp the
        # provenance link after the fact, same pattern as recurring.mark_paid.
        expense_row = await db.get(Expense, expense_out.id)
        expense_row.loan_given_id = loan.id
        await db.commit()

    return await _to_out(db, loan, today)


async def patch(
    db: AsyncSession, household_id: uuid.UUID, loan_id: uuid.UUID, body: LoanGivenPatch, today: date_type
) -> LoanGivenOut:
    loan = await _get_owned(db, household_id, loan_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(loan, field, value)
    await db.commit()
    return await _to_out(db, loan, today)


async def delete(db: AsyncSession, household_id: uuid.UUID, loan_id: uuid.UUID) -> None:
    loan = await _get_owned(db, household_id, loan_id)
    await db.delete(loan)
    await db.commit()


async def add_payment(
    db: AsyncSession,
    household_id: uuid.UUID,
    loan_id: uuid.UUID,
    body: LoanGivenPaymentCreate,
    today: date_type,
) -> LoanGivenOut:
    loan = await _get_owned(db, household_id, loan_id)
    monthly_rate = (loan.interest_rate_bps or 0) / 10_000 / 12
    interest_portion = min(round(loan.current_balance * monthly_rate), body.amount)
    principal_portion = body.amount - interest_portion
    loan.current_balance = max(0, loan.current_balance - principal_portion)

    db.add(
        LoanGivenPayment(
            loan_id=loan.id,
            date=body.date or today,
            amount=body.amount,
            interest_portion=interest_portion,
            principal_portion=principal_portion,
            notes=body.notes,
        )
    )
    await db.commit()
    return await _to_out(db, loan, today)


async def list_payments(
    db: AsyncSession, household_id: uuid.UUID, loan_id: uuid.UUID
) -> list[LoanGivenPaymentOut]:
    loan = await _get_owned(db, household_id, loan_id)
    rows = (
        (
            await db.execute(
                select(LoanGivenPayment)
                .where(LoanGivenPayment.loan_id == loan.id)
                .order_by(LoanGivenPayment.date.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        LoanGivenPaymentOut(
            id=p.id, date=p.date, amount=p.amount,
            interest_portion=p.interest_portion, principal_portion=p.principal_portion, notes=p.notes,
        )
        for p in rows
    ]


async def summary(db: AsyncSession, household_id: uuid.UUID, today: date_type) -> LoanSummaryOut:
    loans = await list_loans(db, household_id, today, include_inactive=False)
    return LoanSummaryOut(
        total_outstanding=sum(loan.current_balance for loan in loans),
        total_lent=sum(loan.principal for loan in loans),
        total_repaid=sum(loan.total_repaid for loan in loans),
        total_interest_earned=sum(loan.total_interest_earned for loan in loans),
        active_count=sum(1 for loan in loans if not loan.paid_off),
        overdue_count=sum(1 for loan in loans if loan.status == "overdue"),
    )
