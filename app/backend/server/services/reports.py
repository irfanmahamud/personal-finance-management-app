import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import DomainValidationError, NotFoundError
from server.db.models import Budget, Household
from server.db.queries import reports as q
from server.schemas.report import (
    BudgetVarianceOut,
    CategoryReportOut,
    CategorySpend,
    DailyPoint,
    MonthlySummaryOut,
    SpendingTimeseriesOut,
    TimeseriesPoint,
    VarianceLine,
    YearlyMonthPoint,
    YearlySummaryOut,
)
from server.services.budgets import _to_out as budget_to_out
from server.services.periods import fiscal_year_label, month_period, next_period


def _spend_rows(rows) -> list[CategorySpend]:
    return [
        CategorySpend(
            category_id=r.category_id,
            name_en=r.name_en,
            name_bn=r.name_bn,
            icon=getattr(r, "icon", None),
            spent=int(r.spent),
            entries=int(r.entries),
        )
        for r in rows
    ]


async def monthly_summary(
    db: AsyncSession, household_id: uuid.UUID, month_of: date_type
) -> MonthlySummaryOut:
    start, end = month_period(month_of)
    household = await db.get(Household, household_id)

    totals = await q.fetch_one(
        db, q.TOTALS, household_id=household_id, date_from=start, date_to=end
    )
    income_row = await q.fetch_one(db, q.MONTHLY_INCOME, household_id=household_id)
    by_category = await q.fetch_all(
        db, q.CATEGORY_BREAKDOWN, household_id=household_id, date_from=start, date_to=end
    )
    daily = await q.fetch_all(
        db, q.DAILY_SERIES, household_id=household_id, date_from=start, date_to=end
    )

    income = int(income_row.monthly_income)
    total_spent = int(totals.total_spent)
    return MonthlySummaryOut(
        period_start=start,
        period_end=end,
        fiscal_year=fiscal_year_label(start, household.fiscal_year_start if household else 7),
        income=income,
        total_spent=total_spent,
        surplus=income - total_spent,
        entries=int(totals.entries),
        by_category=_spend_rows(by_category),
        daily=[DailyPoint(date=r.date, spent=int(r.spent)) for r in daily],
    )


async def budget_variance(
    db: AsyncSession, household_id: uuid.UUID, month_of: date_type
) -> BudgetVarianceOut:
    start, _ = month_period(month_of)
    budget = (
        await db.execute(
            select(Budget).where(
                Budget.household_id == household_id, Budget.period_start == start
            )
        )
    ).scalar_one_or_none()
    if budget is None:
        raise NotFoundError("No budget for this period")

    out = await budget_to_out(db, budget)
    lines = [
        VarianceLine(
            category_id=l.category_id,
            name_en=l.category_name_en,
            name_bn=l.category_name_bn,
            icon=l.icon,
            budgeted=l.amount + l.rolled_over_amount,
            spent=l.spent,
            variance=l.amount + l.rolled_over_amount - l.spent,
        )
        for l in out.lines
    ]
    return BudgetVarianceOut(
        period_start=out.period_start,
        period_end=out.period_end,
        lines=lines,
        total_budgeted=out.total_amount,
        total_spent=out.total_spent,
    )


async def category_report(
    db: AsyncSession,
    household_id: uuid.UUID,
    date_from: date_type,
    date_to: date_type,
    category_id: uuid.UUID | None = None,
) -> CategoryReportOut:
    totals = await q.fetch_one(
        db, q.TOTALS, household_id=household_id, date_from=date_from, date_to=date_to
    )
    by_category = await q.fetch_all(
        db, q.CATEGORY_BREAKDOWN,
        household_id=household_id, date_from=date_from, date_to=date_to,
    )
    subs = None
    if category_id is not None:
        sub_rows = await q.fetch_all(
            db, q.SUBCATEGORY_BREAKDOWN,
            household_id=household_id, date_from=date_from, date_to=date_to,
            parent_id=category_id,
        )
        subs = _spend_rows(sub_rows)
    return CategoryReportOut(
        date_from=date_from,
        date_to=date_to,
        total_spent=int(totals.total_spent),
        by_category=_spend_rows(by_category),
        subcategories=subs,
    )


async def yearly_summary(
    db: AsyncSession, household_id: uuid.UUID, today: date_type
) -> YearlySummaryOut:
    """Yearly month-by-month (spec §3.6 Phase 2). Income is today's active
    sources applied to every month, same limitation monthly_summary already
    has - income_source isn't a dated ledger, only a current snapshot."""
    household = await db.get(Household, household_id)
    fy_start_month = household.fiscal_year_start if household else 7
    today_start, _ = month_period(today)
    fy_year = today_start.year if today_start.month >= fy_start_month else today_start.year - 1
    cursor = date_type(fy_year, fy_start_month, 1)

    income_row = await q.fetch_one(db, q.MONTHLY_INCOME, household_id=household_id)
    income = int(income_row.monthly_income)

    months: list[YearlyMonthPoint] = []
    for _ in range(12):
        start, end = month_period(cursor)
        totals = await q.fetch_one(
            db, q.TOTALS, household_id=household_id, date_from=start, date_to=end
        )
        spent = int(totals.total_spent)
        months.append(YearlyMonthPoint(month=start, income=income, spent=spent, surplus=income - spent))
        cursor, _ = next_period(start)

    return YearlySummaryOut(
        fiscal_year=fiscal_year_label(today_start, fy_start_month),
        months=months,
        total_income=sum(m.income for m in months),
        total_spent=sum(m.spent for m in months),
        total_surplus=sum(m.surplus for m in months),
    )


GRANULARITIES = ("day", "week", "month")


async def spending_timeseries(
    db: AsyncSession,
    household_id: uuid.UUID,
    granularity: str,
    date_from: date_type,
    date_to: date_type,
) -> SpendingTimeseriesOut:
    """Dashboard/Reports graphs (day/week/month/custom range, user's own
    choice - not a fixed period). `granularity` is validated against a
    fixed set before reaching SQL, not passed through as free text."""
    if granularity not in GRANULARITIES:
        raise DomainValidationError("granularity must be day, week, or month")
    if date_from > date_to:
        raise DomainValidationError("date_from must not be after date_to")

    rows = await q.fetch_all(
        db, q.SPENDING_TIMESERIES,
        household_id=household_id, granularity=granularity, date_from=date_from, date_to=date_to,
    )
    points = [TimeseriesPoint(period=r.period, spent=int(r.spent)) for r in rows]
    return SpendingTimeseriesOut(
        granularity=granularity,
        date_from=date_from,
        date_to=date_to,
        points=points,
        total_spent=sum(p.spent for p in points),
    )


async def export_rows(
    db: AsyncSession, household_id: uuid.UUID, date_from: date_type, date_to: date_type
):
    return await q.fetch_all(
        db, q.EXPORT_ROWS, household_id=household_id, date_from=date_from, date_to=date_to
    )
