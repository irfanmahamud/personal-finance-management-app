"""Investment tracking (spec §3.7A). One flexible table across the
in-scope instrument types - see db/models.py::Investment for why.

Deliberately not built in this slice: contribution schedules that
generate recurring entries for DPS/pension installments (§3.7A.2), and
zakat-calculator linkage (the calculator itself doesn't exist yet - the
zakatable flag is stored for when it does, same pattern as `member` rows
existing before Phase 2's family UI).
"""

import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Investment
from server.schemas.investment import (
    InvestmentCreate,
    InvestmentOut,
    InvestmentPatch,
    PortfolioByType,
    PortfolioOut,
)

MATURITY_SOON_DAYS = 30
RENEWAL_DUE_DAYS = 7


def _maturity_status(maturity_date: date_type | None, today: date_type) -> str:
    if maturity_date is None:
        return "none"
    delta = (maturity_date - today).days
    if delta < 0:
        return "overdue"
    if delta <= RENEWAL_DUE_DAYS:
        return "renewal_due"
    if delta <= MATURITY_SOON_DAYS:
        return "maturity_soon"
    return "upcoming"


def _projected_maturity_value(inv: Investment) -> int | None:
    if inv.rate_bps is None or inv.tenure_months is None:
        return None
    years = inv.tenure_months / 12
    return int(inv.amount + inv.amount * inv.rate_bps / 10_000 * years)


def _to_out(inv: Investment, today: date_type) -> InvestmentOut:
    effective_value = inv.current_value if inv.current_value is not None else inv.amount
    return InvestmentOut(
        id=inv.id,
        instrument_type=inv.instrument_type,
        name=inv.name,
        amount=inv.amount,
        rate_bps=inv.rate_bps,
        start_date=inv.start_date,
        maturity_date=inv.maturity_date,
        tenure_months=inv.tenure_months,
        auto_renewal=inv.auto_renewal,
        current_value=inv.current_value,
        effective_value=effective_value,
        projected_maturity_value=_projected_maturity_value(inv),
        rebate_eligible=inv.rebate_eligible,
        zakatable=inv.zakatable,
        active=inv.active,
        notes=inv.notes,
        maturity_status=_maturity_status(inv.maturity_date, today),
    )


async def list_investments(
    db: AsyncSession, household_id: uuid.UUID, today: date_type, include_inactive: bool = False
) -> list[InvestmentOut]:
    stmt = select(Investment).where(Investment.household_id == household_id)
    if not include_inactive:
        stmt = stmt.where(Investment.active.is_(True))
    stmt = stmt.order_by(Investment.maturity_date.is_(None), Investment.maturity_date)
    rows = (await db.execute(stmt)).scalars().all()
    return [_to_out(r, today) for r in rows]


async def _get_owned(db: AsyncSession, household_id: uuid.UUID, investment_id: uuid.UUID) -> Investment:
    inv = await db.get(Investment, investment_id)
    if inv is None or inv.household_id != household_id:
        raise NotFoundError("Investment not found")
    return inv


async def create(
    db: AsyncSession, household_id: uuid.UUID, body: InvestmentCreate, today: date_type
) -> InvestmentOut:
    inv = Investment(household_id=household_id, **body.model_dump())
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return _to_out(inv, today)


async def patch(
    db: AsyncSession,
    household_id: uuid.UUID,
    investment_id: uuid.UUID,
    body: InvestmentPatch,
    today: date_type,
) -> InvestmentOut:
    inv = await _get_owned(db, household_id, investment_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(inv, field, value)
    await db.commit()
    return _to_out(inv, today)


async def delete(db: AsyncSession, household_id: uuid.UUID, investment_id: uuid.UUID) -> None:
    inv = await _get_owned(db, household_id, investment_id)
    await db.delete(inv)
    await db.commit()


async def portfolio(db: AsyncSession, household_id: uuid.UUID, today: date_type) -> PortfolioOut:
    investments = await list_investments(db, household_id, today)

    by_type: dict[str, PortfolioByType] = {}
    for inv in investments:
        row = by_type.setdefault(
            inv.instrument_type,
            PortfolioByType(instrument_type=inv.instrument_type, count=0, invested=0, current_value=0),
        )
        row.count += 1
        row.invested += inv.amount
        row.current_value += inv.effective_value

    upcoming = sorted(
        (inv for inv in investments if inv.maturity_date is not None and inv.maturity_date >= today),
        key=lambda inv: inv.maturity_date,
    )[:3]

    return PortfolioOut(
        total_invested=sum(inv.amount for inv in investments),
        total_current_value=sum(inv.effective_value for inv in investments),
        by_type=list(by_type.values()),
        next_maturities=upcoming,
    )


async def eligible_investment_total(db: AsyncSession, household_id: uuid.UUID) -> int:
    """Sum of active, rebate-eligible investment principal - the §3.2.2 tax
    engine's `eligible_investment` input (services/income.py::tax_estimate)."""
    rows = (
        await db.execute(
            select(Investment.amount).where(
                Investment.household_id == household_id,
                Investment.active.is_(True),
                Investment.rebate_eligible.is_(True),
            )
        )
    ).scalars().all()
    return sum(rows)
