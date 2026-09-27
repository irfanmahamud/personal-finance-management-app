from datetime import date

from server.services.periods import (
    fiscal_year_label,
    month_period,
    next_period,
    rollover_amount,
)

# --- Pure period math (money math - exhaustive) ---


def test_month_period_boundaries():
    """Default (month_start_day=1): calendar-month boundaries, unchanged."""
    assert month_period(date(2026, 8, 30)) == (date(2026, 8, 1), date(2026, 8, 31))
    assert month_period(date(2026, 2, 10)) == (date(2026, 2, 1), date(2026, 2, 28))
    assert month_period(date(2028, 2, 10)) == (date(2028, 2, 1), date(2028, 2, 29))  # leap
    assert month_period(date(2026, 12, 31)) == (date(2026, 12, 1), date(2026, 12, 31))


def test_month_period_default_arg_matches_explicit_1():
    assert month_period(date(2026, 8, 30)) == month_period(date(2026, 8, 30), 1)


def test_month_period_custom_start_day_25():
    # Day just before the boundary belongs to the PREVIOUS period.
    assert month_period(date(2026, 8, 24), 25) == (date(2026, 7, 25), date(2026, 8, 24))
    # The boundary day itself OPENS a new period.
    assert month_period(date(2026, 8, 25), 25) == (date(2026, 8, 25), date(2026, 9, 24))


def test_month_period_custom_start_day_year_boundary():
    # December -> January rollover, both sides of the boundary day.
    assert month_period(date(2026, 1, 9), 10) == (date(2025, 12, 10), date(2026, 1, 9))
    assert month_period(date(2026, 1, 10), 10) == (date(2026, 1, 10), date(2026, 2, 9))


def test_month_period_start_day_28_never_touches_leap_day():
    assert month_period(date(2028, 2, 27), 28) == (date(2028, 1, 28), date(2028, 2, 27))
    assert month_period(date(2028, 2, 28), 28) == (date(2028, 2, 28), date(2028, 3, 27))


def test_next_period():
    assert next_period(date(2026, 8, 1)) == (date(2026, 9, 1), date(2026, 9, 30))
    assert next_period(date(2026, 12, 1)) == (date(2027, 1, 1), date(2027, 1, 31))
    assert next_period(date(2026, 8, 25), 25) == month_period(date(2026, 9, 25), 25)
    assert next_period(date(2026, 12, 10), 10) == (date(2027, 1, 10), date(2027, 2, 9))


def test_fiscal_year_label():
    assert fiscal_year_label(date(2026, 8, 30), 7) == "2026-27"
    assert fiscal_year_label(date(2026, 6, 30), 7) == "2025-26"
    assert fiscal_year_label(date(2026, 8, 30), 1) == "2026"


def test_rollover_never_negative():
    assert rollover_amount(100_000, 0, 30_000) == 70_000
    assert rollover_amount(100_000, 20_000, 150_000) == 0  # overspent
    assert rollover_amount(100_000, 20_000, 90_000) == 30_000  # includes prior rollover
