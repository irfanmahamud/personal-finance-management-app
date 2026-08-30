"""Budget period math. Pure functions - unit-tested, framework-free.

Budgets are monthly (spec §3.3: budget vs. actual is a monthly view).
The household's fiscal_year_start does not change month boundaries; it
determines which months belong to which fiscal year for annual reporting
(M5/M6) and the fiscal-year label shown alongside a period.
"""

from datetime import date


def month_period(day: date) -> tuple[date, date]:
    """The calendar-month period containing `day`."""
    start = day.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end.fromordinal(end.toordinal() - 1)


def next_period(period_start: date) -> tuple[date, date]:
    if period_start.month == 12:
        return month_period(period_start.replace(year=period_start.year + 1, month=1))
    return month_period(period_start.replace(month=period_start.month + 1))


def fiscal_year_label(day: date, fiscal_year_start: int) -> str:
    """E.g. 2026-08-30 with start=7 -> "2026-27"; with start=1 -> "2026"."""
    if fiscal_year_start == 1:
        return str(day.year)
    if day.month >= fiscal_year_start:
        return f"{day.year}-{str(day.year + 1)[-2:]}"
    return f"{day.year - 1}-{str(day.year)[-2:]}"


def rollover_amount(line_amount: int, rolled_over: int, spent: int) -> int:
    """Unused budget carried into the next period (never negative).

    All values are integer poisha.
    """
    return max(0, line_amount + rolled_over - spent)
