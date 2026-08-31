"""Debt manager (spec §3.9): loans and credit-card balances, an EMI
calculator with amortization schedule, actual-history payoff projection,
and an avalanche-vs-snowball comparison. All deterministic math - no model.
"""

import calendar
import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Debt, DebtPayment
from server.db.queries import debts as q
from server.db.queries.reports import fetch_all
from server.schemas.debt import (
    AmortizationRow,
    DebtCreate,
    DebtOut,
    DebtPatch,
    DebtPaymentCreate,
    DebtPaymentOut,
    EmiCalculation,
    PayoffComparisonOut,
    PayoffStrategy,
)

MAX_MONTHS = 600  # 50 years - a simulation backstop, not a product limit


def emi_amount(principal: int, annual_rate_bps: int, term_months: int) -> int:
    if term_months <= 0:
        return principal
    monthly_rate = annual_rate_bps / 10_000 / 12
    if monthly_rate == 0:
        return round(principal / term_months)
    factor = (1 + monthly_rate) ** term_months
    return round(principal * monthly_rate * factor / (factor - 1))


def amortization_schedule(
    principal: int, annual_rate_bps: int, term_months: int
) -> list[AmortizationRow]:
    monthly_rate = annual_rate_bps / 10_000 / 12
    payment = emi_amount(principal, annual_rate_bps, term_months)
    balance = principal
    rows: list[AmortizationRow] = []
    for month in range(1, term_months + 1):
        interest = round(balance * monthly_rate)
        principal_part = min(balance, payment - interest)
        balance = max(0, balance - principal_part)
        rows.append(
            AmortizationRow(month=month, payment=payment, interest=interest, principal=principal_part, balance=balance)
        )
        if balance <= 0:
            break
    return rows


def _add_months(d: date_type, n: int) -> date_type:
    total = d.month - 1 + n
    year = d.year + total // 12
    month = total % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date_type(year, month, min(d.day, last_day))


def _project_payoff(
    balance: int, annual_rate_bps: int | None, avg_payment: int | None, today: date_type
) -> date_type | None:
    if not avg_payment or avg_payment <= 0 or balance <= 0:
        return None
    monthly_rate = (annual_rate_bps or 0) / 10_000 / 12
    months = 0
    b = float(balance)
    while b > 0 and months < MAX_MONTHS:
        interest = b * monthly_rate
        if avg_payment <= interest and monthly_rate > 0:
            return None  # payments don't even cover interest - never pays off
        b = b + interest - avg_payment
        months += 1
    if months >= MAX_MONTHS:
        return None
    return _add_months(today, months)


async def _to_out(db: AsyncSession, debt: Debt, today: date_type) -> DebtOut:
    payments = (
        (
            await db.execute(
                select(DebtPayment).where(DebtPayment.debt_id == debt.id)
            )
        )
        .scalars()
        .all()
    )
    total_paid = sum(p.amount for p in payments)
    total_interest_paid = sum(p.interest_portion for p in payments)
    total_principal_paid = sum(p.principal_portion for p in payments)

    calculated_emi = (
        emi_amount(debt.principal, debt.interest_rate_bps, debt.term_months)
        if debt.interest_rate_bps is not None and debt.term_months
        else None
    )

    monthly_rows = await fetch_all(db, q.MONTHLY_PAYMENTS, debt_id=debt.id)
    avg_monthly_payment = (
        int(sum(int(r.total) for r in monthly_rows) / len(monthly_rows)) if monthly_rows else None
    )

    paid_off = debt.current_balance <= 0
    projected_payoff_date = None
    if not paid_off:
        payment_for_projection = avg_monthly_payment or debt.minimum_payment
        projected_payoff_date = _project_payoff(
            debt.current_balance, debt.interest_rate_bps, payment_for_projection, today
        )

    return DebtOut(
        id=debt.id,
        name=debt.name,
        lender=debt.lender,
        debt_type=debt.debt_type,
        principal=debt.principal,
        current_balance=debt.current_balance,
        interest_rate_bps=debt.interest_rate_bps,
        term_months=debt.term_months,
        minimum_payment=debt.minimum_payment,
        start_date=debt.start_date,
        active=debt.active,
        notes=debt.notes,
        paid_off=paid_off,
        total_paid=total_paid,
        total_interest_paid=total_interest_paid,
        total_principal_paid=total_principal_paid,
        calculated_emi=calculated_emi,
        avg_monthly_payment=avg_monthly_payment,
        projected_payoff_date=projected_payoff_date,
    )


async def list_debts(
    db: AsyncSession, household_id: uuid.UUID, today: date_type, include_inactive: bool = False
) -> list[DebtOut]:
    stmt = select(Debt).where(Debt.household_id == household_id)
    if not include_inactive:
        stmt = stmt.where(Debt.active.is_(True))
    stmt = stmt.order_by(Debt.created_at)
    debts = (await db.execute(stmt)).scalars().all()
    return [await _to_out(db, d, today) for d in debts]


async def _get_owned(db: AsyncSession, household_id: uuid.UUID, debt_id: uuid.UUID) -> Debt:
    debt = await db.get(Debt, debt_id)
    if debt is None or debt.household_id != household_id:
        raise NotFoundError("Debt not found")
    return debt


async def create(
    db: AsyncSession, household_id: uuid.UUID, body: DebtCreate, today: date_type
) -> DebtOut:
    debt = Debt(
        household_id=household_id,
        name=body.name,
        lender=body.lender,
        debt_type=body.debt_type,
        principal=body.principal,
        current_balance=body.current_balance if body.current_balance is not None else body.principal,
        interest_rate_bps=body.interest_rate_bps,
        term_months=body.term_months,
        minimum_payment=body.minimum_payment,
        start_date=body.start_date,
        notes=body.notes,
    )
    db.add(debt)
    await db.commit()
    await db.refresh(debt)
    return await _to_out(db, debt, today)


async def patch(
    db: AsyncSession, household_id: uuid.UUID, debt_id: uuid.UUID, body: DebtPatch, today: date_type
) -> DebtOut:
    debt = await _get_owned(db, household_id, debt_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(debt, field, value)
    await db.commit()
    return await _to_out(db, debt, today)


async def delete(db: AsyncSession, household_id: uuid.UUID, debt_id: uuid.UUID) -> None:
    debt = await _get_owned(db, household_id, debt_id)
    await db.delete(debt)
    await db.commit()


async def add_payment(
    db: AsyncSession,
    household_id: uuid.UUID,
    debt_id: uuid.UUID,
    body: DebtPaymentCreate,
    today: date_type,
) -> DebtOut:
    debt = await _get_owned(db, household_id, debt_id)
    monthly_rate = (debt.interest_rate_bps or 0) / 10_000 / 12
    interest_portion = min(round(debt.current_balance * monthly_rate), body.amount)
    principal_portion = body.amount - interest_portion
    debt.current_balance = max(0, debt.current_balance - principal_portion)

    db.add(
        DebtPayment(
            debt_id=debt.id,
            date=body.date or today,
            amount=body.amount,
            interest_portion=interest_portion,
            principal_portion=principal_portion,
            notes=body.notes,
        )
    )
    await db.commit()
    return await _to_out(db, debt, today)


async def list_payments(
    db: AsyncSession, household_id: uuid.UUID, debt_id: uuid.UUID
) -> list[DebtPaymentOut]:
    debt = await _get_owned(db, household_id, debt_id)
    rows = (
        (
            await db.execute(
                select(DebtPayment)
                .where(DebtPayment.debt_id == debt.id)
                .order_by(DebtPayment.date.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        DebtPaymentOut(
            id=p.id, date=p.date, amount=p.amount,
            interest_portion=p.interest_portion, principal_portion=p.principal_portion, notes=p.notes,
        )
        for p in rows
    ]


def emi_calculator(principal: int, annual_rate_bps: int, term_months: int) -> EmiCalculation:
    schedule = amortization_schedule(principal, annual_rate_bps, term_months)
    emi = schedule[0].payment if schedule else 0
    total_payment = sum(r.payment for r in schedule)
    total_interest = sum(r.interest for r in schedule)
    return EmiCalculation(emi=emi, total_payment=total_payment, total_interest=total_interest, schedule=schedule)


def _simulate_strategy(
    debts: list[dict], order_key, extra_monthly: int
) -> tuple[list[uuid.UUID], int | None, int]:
    order = sorted(debts, key=order_key)
    balances = {d["id"]: float(d["balance"]) for d in debts}
    months = 0
    total_interest = 0.0
    while any(v > 0 for v in balances.values()) and months < MAX_MONTHS:
        months += 1
        pool = extra_monthly
        stuck = True
        for d in order:
            bal = balances[d["id"]]
            if bal <= 0:
                continue
            interest = bal * d["monthly_rate"]
            total_interest += interest
            bal += interest
            pay = min(d["minimum_payment"], bal)
            bal -= pay
            balances[d["id"]] = bal
            if pay > 0:
                stuck = False
        for d in order:
            if pool <= 0:
                break
            bal = balances[d["id"]]
            if bal <= 0:
                continue
            pay = min(pool, bal)
            bal -= pay
            pool -= pay
            balances[d["id"]] = bal
            if pay > 0:
                stuck = False
        if stuck:
            # No payment covers even the accruing interest - this strategy
            # never reaches debt-free at this extra_monthly.
            return [d["id"] for d in order], None, round(total_interest)

    months_result = months if months < MAX_MONTHS else None
    return [d["id"] for d in order], months_result, round(total_interest)


async def payoff_comparison(
    db: AsyncSession, household_id: uuid.UUID, today: date_type, extra_monthly: int
) -> PayoffComparisonOut:
    active_debts = await list_debts(db, household_id, today, include_inactive=False)
    debts = [
        {
            "id": d.id,
            "balance": d.current_balance,
            "rate_bps": d.interest_rate_bps or 0,
            "monthly_rate": (d.interest_rate_bps or 0) / 10_000 / 12,
            "minimum_payment": d.minimum_payment or 0,
        }
        for d in active_debts
        if d.current_balance > 0
    ]

    avalanche_order, avalanche_months, avalanche_interest = _simulate_strategy(
        debts, lambda d: -d["rate_bps"], extra_monthly
    )
    snowball_order, snowball_months, snowball_interest = _simulate_strategy(
        debts, lambda d: d["balance"], extra_monthly
    )

    return PayoffComparisonOut(
        extra_monthly=extra_monthly,
        avalanche=PayoffStrategy(
            order=avalanche_order, months_to_debt_free=avalanche_months, total_interest_paid=avalanche_interest
        ),
        snowball=PayoffStrategy(
            order=snowball_order, months_to_debt_free=snowball_months, total_interest_paid=snowball_interest
        ),
    )
