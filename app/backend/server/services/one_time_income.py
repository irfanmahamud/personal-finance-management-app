"""One-time income (not spec-numbered - explicitly requested): ad-hoc
income events (a bonus, a one-off freelance payment, a gift), distinct
from the standing recurring IncomeSource. See db/models.py::OneTimeIncome
for exactly how it feeds reports.py and income.py::tax_estimate.
"""

import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import OneTimeIncome
from server.schemas.one_time_income import OneTimeIncomeCreate, OneTimeIncomePatch


async def list_entries(
    db: AsyncSession,
    household_id: uuid.UUID,
    date_from: date_type | None = None,
    date_to: date_type | None = None,
) -> list[OneTimeIncome]:
    stmt = select(OneTimeIncome).where(OneTimeIncome.household_id == household_id)
    if date_from is not None:
        stmt = stmt.where(OneTimeIncome.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(OneTimeIncome.date <= date_to)
    stmt = stmt.order_by(OneTimeIncome.date.desc())
    return list((await db.execute(stmt)).scalars().all())


async def _get_owned(db: AsyncSession, household_id: uuid.UUID, entry_id: uuid.UUID) -> OneTimeIncome:
    entry = await db.get(OneTimeIncome, entry_id)
    if entry is None or entry.household_id != household_id:
        raise NotFoundError("One-time income entry not found")
    return entry


async def create(
    db: AsyncSession, household_id: uuid.UUID, body: OneTimeIncomeCreate
) -> OneTimeIncome:
    entry = OneTimeIncome(
        household_id=household_id,
        label=body.label,
        amount=body.amount,
        date=body.date,
        taxable=body.taxable,
        notes=body.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def patch(
    db: AsyncSession, household_id: uuid.UUID, entry_id: uuid.UUID, body: OneTimeIncomePatch
) -> OneTimeIncome:
    entry = await _get_owned(db, household_id, entry_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    return entry


async def delete(db: AsyncSession, household_id: uuid.UUID, entry_id: uuid.UUID) -> None:
    entry = await _get_owned(db, household_id, entry_id)
    await db.delete(entry)
    await db.commit()


async def taxable_total_in_range(
    db: AsyncSession, household_id: uuid.UUID, date_from: date_type, date_to: date_type
) -> int:
    """Raw (not annualized - already a total) sum of taxable entries in a
    date range, for income.py::tax_estimate's current-fiscal-year figure."""
    entries = await list_entries(db, household_id, date_from, date_to)
    return sum(e.amount for e in entries if e.taxable)


async def total_in_range(
    db: AsyncSession, household_id: uuid.UUID, date_from: date_type, date_to: date_type
) -> int:
    """Sum of ALL entries (taxable or not) in a date range - unlike
    taxable_total_in_range, this is for income.py::tax_estimate's
    monthly_net/take-home figure, where a non-taxable gift is still real
    cash that landed this month, same as a taxable bonus."""
    entries = await list_entries(db, household_id, date_from, date_to)
    return sum(e.amount for e in entries)
