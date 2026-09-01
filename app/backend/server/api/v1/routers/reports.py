import csv
import io
import uuid
from datetime import date as date_type
from datetime import date, timedelta

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from server.core.deps import ActiveUser, DbSession
from server.schemas.report import (
    BudgetVarianceOut,
    CategoryReportOut,
    MonthlySummaryOut,
    SpendingTimeseriesOut,
    YearlySummaryOut,
)
from server.services import reports as service

# Default lookback per granularity when the caller doesn't pick a range.
_DEFAULT_LOOKBACK_DAYS = {"day": 30, "week": 84, "month": 365}

router = APIRouter(tags=["reports"])


@router.get("/reports/monthly", response_model=MonthlySummaryOut)
async def monthly(
    db: DbSession, user: ActiveUser, month: date_type | None = None
) -> MonthlySummaryOut:
    return await service.monthly_summary(db, user.household_id, month or date.today())


@router.get("/reports/budget-variance", response_model=BudgetVarianceOut)
async def budget_variance(
    db: DbSession, user: ActiveUser, month: date_type | None = None
) -> BudgetVarianceOut:
    return await service.budget_variance(db, user.household_id, month or date.today())


@router.get("/reports/timeseries", response_model=SpendingTimeseriesOut)
async def spending_timeseries(
    db: DbSession,
    user: ActiveUser,
    granularity: str = "day",
    date_from: date_type | None = None,
    date_to: date_type | None = None,
) -> SpendingTimeseriesOut:
    end = date_to or date.today()
    start = date_from or end - timedelta(days=_DEFAULT_LOOKBACK_DAYS.get(granularity, 30))
    return await service.spending_timeseries(db, user.household_id, granularity, start, end)


@router.get("/reports/category", response_model=CategoryReportOut)
async def category_report(
    date_from: date_type,
    date_to: date_type,
    db: DbSession,
    user: ActiveUser,
    category_id: uuid.UUID | None = None,
) -> CategoryReportOut:
    return await service.category_report(
        db, user.household_id, date_from, date_to, category_id
    )


@router.get("/reports/yearly", response_model=YearlySummaryOut)
async def yearly(db: DbSession, user: ActiveUser) -> YearlySummaryOut:
    return await service.yearly_summary(db, user.household_id, date.today())


@router.get("/export/csv")
async def export_csv(
    date_from: date_type, date_to: date_type, db: DbSession, user: ActiveUser
) -> StreamingResponse:
    rows = await service.export_rows(db, user.household_id, date_from, date_to)

    def generate():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            ["date", "category", "subcategory", "amount_bdt_taka", "currency",
             "amount_original_taka", "description", "payment_method",
             "for_member", "logged_by", "notes", "created_at"]
        )
        for r in rows:
            # Poisha -> taka with exact decimal string, no float involved.
            writer.writerow([
                r.date.isoformat(),
                r.category,
                r.subcategory if r.subcategory != r.category else "",
                f"{r.amount_bdt // 100}.{r.amount_bdt % 100:02d}",
                r.currency,
                f"{r.amount // 100}.{r.amount % 100:02d}",
                r.description or "",
                r.payment_method or "",
                r.for_member or "",
                r.logged_by,
                r.notes or "",
                r.created_at.isoformat(),
            ])
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)
        yield buffer.getvalue()

    filename = f"expenses_{date_from}_{date_to}.csv"
    return StreamingResponse(
        generate(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
