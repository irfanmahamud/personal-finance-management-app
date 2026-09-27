"""Budget period math. Pure functions - unit-tested, framework-free.

Budgets are monthly (spec §3.3: budget vs. actual is a monthly view), but
not necessarily calendar-month: a household can set `month_start_day`
(1-28, default 1) so its "month" runs payday-to-payday instead of
1st-to-end-of-month. The household's fiscal_year_start does not change
month boundaries; it determines which months belong to which fiscal year
for annual reporting (M5/M6) and the fiscal-year label shown alongside a
period - a separate, orthogonal setting from month_start_day.
"""

from datetime import date, timedelta


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    """(year, month) shifted by `delta` calendar months (either direction),
    handling any Dec<->Jan rollover via a flattened month index."""
    total = (year * 12 + (month - 1)) + delta
    return total // 12, total % 12 + 1


def month_period(day: date, month_start_day: int = 1) -> tuple[date, date]:
    """The custom-boundary period containing `day`: month_start_day of one
    calendar month to month_start_day - 1 of the next. Capped at 1-28
    (enforced by callers/schema) so every value is a valid day in every
    calendar month, in every year - no leap-year/month-length clamping is
    ever needed. With month_start_day=1 this is byte-identical to a plain
    calendar month (the pre-existing, still-default behavior)."""
    if day.day >= month_start_day:
        start_year, start_month = day.year, day.month
    else:
        start_year, start_month = _shift_month(day.year, day.month, -1)
    start = date(start_year, start_month, month_start_day)
    end_year, end_month = _shift_month(start_year, start_month, 1)
    end = date(end_year, end_month, month_start_day) - timedelta(days=1)
    return start, end


def next_period(period_start: date, month_start_day: int = 1) -> tuple[date, date]:
    end_year, end_month = _shift_month(period_start.year, period_start.month, 1)
    return month_period(date(end_year, end_month, month_start_day), month_start_day)


def fiscal_year_label(day: date, fiscal_year_start: int) -> str:
    """E.g. 2026-08-30 with start=7 -> "2026-27"; with start=1 -> "2026"."""
    if fiscal_year_start == 1:
        return str(day.year)
    if day.month >= fiscal_year_start:
        return f"{day.year}-{str(day.year + 1)[-2:]}"
    return f"{day.year - 1}-{str(day.year)[-2:]}"


def fiscal_year_range(today: date, fiscal_year_start: int) -> tuple[date, date]:
    """Start/end dates of the fiscal year containing `today` (inclusive)."""
    if fiscal_year_start == 1:
        return date(today.year, 1, 1), date(today.year, 12, 31)
    start_year = today.year if today.month >= fiscal_year_start else today.year - 1
    start = date(start_year, fiscal_year_start, 1)
    end = date(start_year + 1, fiscal_year_start, 1) - timedelta(days=1)
    return start, end


def rollover_amount(line_amount: int, rolled_over: int, spent: int) -> int:
    """Unused budget carried into the next period (never negative).

    All values are integer poisha.
    """
    return max(0, line_amount + rolled_over - spent)
