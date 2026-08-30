import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Deduction, Household, IncomeSource, TaxConfig
from server.schemas.income import (
    DeductionCreate,
    IncomeSourceCreate,
    IncomeSourcePatch,
    TaxEstimateOut,
)
from server.services.periods import fiscal_year_label
from server.services.tax import engine

# Annualization factors (monthly-equivalent x 12)
_ANNUAL = {"monthly": 12, "weekly": 52, "biweekly": 26, "irregular": 0}


def _annualize(amount_bdt: int, frequency: str) -> int:
    return amount_bdt * _ANNUAL.get(frequency, 0)


def _monthlyize(amount_bdt: int, frequency: str) -> int:
    return _annualize(amount_bdt, frequency) // 12


async def list_sources(db: AsyncSession, household_id: uuid.UUID) -> list[IncomeSource]:
    return list(
        (
            await db.execute(
                select(IncomeSource)
                .where(IncomeSource.household_id == household_id)
                .order_by(IncomeSource.name)
            )
        ).scalars().all()
    )


async def create_source(
    db: AsyncSession, household_id: uuid.UUID, body: IncomeSourceCreate
) -> IncomeSource:
    source = IncomeSource(
        household_id=household_id,
        name=body.name,
        type=body.type,
        currency=body.currency,
        amount=body.amount,
        amount_bdt=body.amount_bdt if body.amount_bdt is not None else body.amount,
        frequency=body.frequency,
        taxable=body.taxable,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source


async def patch_source(
    db: AsyncSession, household_id: uuid.UUID, source_id: uuid.UUID, body: IncomeSourcePatch
) -> IncomeSource:
    source = await db.get(IncomeSource, source_id)
    if source is None or source.household_id != household_id:
        raise NotFoundError("Income source not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(source, k, v)
    if "amount" in data and source.currency == "BDT" and "amount_bdt" not in data:
        source.amount_bdt = source.amount
    await db.commit()
    await db.refresh(source)
    return source


async def list_deductions(db: AsyncSession, household_id: uuid.UUID) -> list[Deduction]:
    return list(
        (
            await db.execute(
                select(Deduction).where(Deduction.household_id == household_id)
            )
        ).scalars().all()
    )


async def create_deduction(
    db: AsyncSession, household_id: uuid.UUID, body: DeductionCreate
) -> Deduction:
    deduction = Deduction(household_id=household_id, type=body.type, amount=body.amount)
    db.add(deduction)
    await db.commit()
    await db.refresh(deduction)
    return deduction


async def delete_deduction(
    db: AsyncSession, household_id: uuid.UUID, deduction_id: uuid.UUID
) -> None:
    deduction = await db.get(Deduction, deduction_id)
    if deduction is None or deduction.household_id != household_id:
        raise NotFoundError("Deduction not found")
    await db.delete(deduction)
    await db.commit()


async def tax_estimate(
    db: AsyncSession,
    household_id: uuid.UUID,
    today: date,
    eligible_investment: int = 0,
    taxpayer_category: str = "general",
) -> TaxEstimateOut:
    household = await db.get(Household, household_id)
    fy = fiscal_year_label(today, household.fiscal_year_start if household else 7)

    config = (
        await db.execute(select(TaxConfig).where(TaxConfig.fiscal_year == fy))
    ).scalar_one_or_none()
    if config is None:
        # Fall back to the latest configured year rather than failing -
        # still flagged by its own verified value.
        config = (
            await db.execute(
                select(TaxConfig).order_by(TaxConfig.effective_from.desc()).limit(1)
            )
        ).scalar_one_or_none()
    if config is None:
        raise NotFoundError("No tax configuration available")

    sources = await list_sources(db, household_id)
    active = [s for s in sources if s.active]
    gross_annual_taxable = sum(
        _annualize(s.amount_bdt, s.frequency) for s in active if s.taxable
    )
    monthly_gross = sum(_monthlyize(s.amount_bdt, s.frequency) for s in active)

    result = engine.compute(
        gross_annual_taxable,
        config.slabs,
        config.thresholds,
        config.rebate_rules,
        eligible_investment=eligible_investment,
        taxpayer_category=taxpayer_category,
    )

    deductions = await list_deductions(db, household_id)
    monthly_deductions = sum(d.amount for d in deductions)

    return TaxEstimateOut(
        fiscal_year=config.fiscal_year,
        verified=config.verified,
        gross_annual=result.gross_annual,
        exemption=result.exemption,
        taxable_annual=result.taxable_annual,
        gross_tax=result.gross_tax,
        rebate=result.rebate,
        net_tax_annual=result.net_tax_annual,
        monthly_tds=result.monthly_tds,
        lines=[vars(l) for l in result.lines],
        monthly_gross=monthly_gross,
        monthly_deductions=monthly_deductions,
        monthly_net=monthly_gross - result.monthly_tds - monthly_deductions,
    )
