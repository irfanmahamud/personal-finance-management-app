"""Deterministic Insights Engine (spec §4.2, rows 1-5): "deterministic
rules over SQL, not model output." No LLM, no external dependency - these
are pure aggregates, phrased client-side via i18n like every other number
in this app. Rows 6-8 (tax optimization, milestone, seasonal) and §4.1 NL
query need a model and stay Phase 3-proper, not built here.

Every insight type degrades gracefully to "nothing" when the household
doesn't have enough history yet - these get more useful as the ledger
grows, same philosophy as the rest of Phase 2's deterministic forecasts.
"""

import uuid
from datetime import date as date_type
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.queries import insights as q
from server.db.queries.reports import CATEGORY_BREAKDOWN, fetch_all
from server.schemas.insight import InsightOut
from server.services import budgets as budgets_service
from server.services import savings as savings_service
from server.services.periods import month_period

# Thresholds - tuned to avoid noise, not derived from anything external.
PATTERN_MIN_EXTRA_PCT = 20
PATTERN_MIN_WEEKS = 4  # need at least this many occurrences of a weekday
ANOMALY_MIN_MULTIPLIER = 2.0
SAVINGS_OPPORTUNITY_CUT_SHARE = 0.20  # suggest cutting 20% of the top "want" category


def _weekday_occurrences(date_from: date_type, date_to: date_type) -> dict[int, int]:
    """Counts each weekday's occurrences using Postgres's EXTRACT(DOW)
    convention (0=Sunday..6=Saturday) - Python's date.weekday() is
    0=Monday..6=Sunday, so it's shifted by one before counting."""
    counts = {i: 0 for i in range(7)}
    d = date_from
    while d <= date_to:
        counts[(d.weekday() + 1) % 7] += 1
        d += timedelta(days=1)
    return counts


def _months_before(d: date_type, n: int) -> date_type:
    total = d.month - 1 - n
    year = d.year + total // 12
    month = total % 12 + 1
    return date_type(year, month, 1)


async def _overspend_insights(db: AsyncSession, household_id: uuid.UUID, today: date_type) -> list[InsightOut]:
    try:
        budget = await budgets_service.get_current(db, household_id, today)
    except NotFoundError:
        return []
    days_left = (budget.period_end - today).days
    out = []
    for line in budget.lines:
        if line.status == "ok":
            continue
        limit = line.amount + line.rolled_over_amount
        pct = round(line.spent / limit * 100) if limit > 0 else 100
        out.append(
            InsightOut(
                type="overspend",
                severity="warning" if line.status == "warn95" else "info",
                category_id=line.category_id,
                category_name_en=line.category_name_en,
                category_name_bn=line.category_name_bn,
                pct=pct,
                days_left=max(0, days_left),
            )
        )
    return out


async def _pattern_insight(db: AsyncSession, household_id: uuid.UUID, today: date_type) -> InsightOut | None:
    date_from = _months_before(today, 3)
    rows = await fetch_all(db, q.WEEKDAY_TOTALS, household_id=household_id, date_from=date_from, date_to=today)
    if not rows:
        return None

    totals = {int(r.weekday): int(r.total) for r in rows}
    span_days = (today - date_from).days + 1
    if span_days < PATTERN_MIN_WEEKS * 7:
        return None

    overall_avg = sum(totals.values()) / span_days
    if overall_avg <= 0:
        return None

    occurrences_by_weekday = _weekday_occurrences(date_from, today)
    best_weekday, best_extra_pct = None, 0
    for weekday in range(7):
        occurrences = occurrences_by_weekday[weekday]
        if occurrences < PATTERN_MIN_WEEKS:
            continue
        weekday_avg = totals.get(weekday, 0) / occurrences
        extra_pct = round((weekday_avg - overall_avg) / overall_avg * 100)
        if extra_pct > best_extra_pct:
            best_weekday, best_extra_pct = weekday, extra_pct

    if best_weekday is None or best_extra_pct < PATTERN_MIN_EXTRA_PCT:
        return None
    return InsightOut(type="pattern", severity="info", weekday=best_weekday, extra_pct=best_extra_pct)


async def _anomaly_insights(db: AsyncSession, household_id: uuid.UUID, today: date_type) -> list[InsightOut]:
    this_month_start, this_month_end = month_period(today)
    history_start = _months_before(this_month_start, 6)
    history_end = this_month_start.fromordinal(this_month_start.toordinal() - 1)  # day before this month

    current_rows = await fetch_all(
        db, CATEGORY_BREAKDOWN, household_id=household_id, date_from=this_month_start, date_to=this_month_end
    )
    history_rows = await fetch_all(
        db, CATEGORY_BREAKDOWN, household_id=household_id, date_from=history_start, date_to=history_end
    )
    history_by_cat = {r.category_id: int(r.spent) for r in history_rows}
    history_months = max(1.0, (this_month_start - history_start).days / 30.44)

    out = []
    for r in current_rows:
        hist_total = history_by_cat.get(r.category_id)
        if not hist_total:
            continue
        hist_avg = hist_total / history_months
        if hist_avg <= 0:
            continue
        multiplier = int(r.spent) / hist_avg
        if multiplier >= ANOMALY_MIN_MULTIPLIER:
            out.append(
                InsightOut(
                    type="anomaly",
                    severity="info",
                    category_id=r.category_id,
                    category_name_en=r.name_en,
                    category_name_bn=r.name_bn,
                    multiplier=round(multiplier, 1),
                )
            )
    return out


async def _savings_opportunity_insight(
    db: AsyncSession, household_id: uuid.UUID, today: date_type
) -> InsightOut | None:
    start, end = month_period(today)
    rows = await fetch_all(
        db, q.CATEGORY_TOTALS_BY_TAG, household_id=household_id, date_from=start, date_to=end, tag="want"
    )
    if not rows:
        return None
    top = rows[0]
    spent = int(top.spent)
    if spent <= 0:
        return None
    cut = round(spent * SAVINGS_OPPORTUNITY_CUT_SHARE / 100) * 100  # round to nearest taka
    if cut <= 0:
        return None
    return InsightOut(
        type="savings_opportunity",
        severity="info",
        category_id=top.category_id,
        category_name_en=top.name_en,
        category_name_bn=top.name_bn,
        cut_amount=cut,
        annual_savings=cut * 12,
    )


async def _goal_projection_insights(
    db: AsyncSession, household_id: uuid.UUID, today: date_type
) -> list[InsightOut]:
    goals = await savings_service.list_goals(db, household_id, today)
    out = []
    for goal in goals:
        if goal.achieved or goal.projected_completion_date is None:
            continue
        months = (
            (goal.projected_completion_date.year - today.year) * 12
            + (goal.projected_completion_date.month - today.month)
        )
        if months <= 0:
            continue
        out.append(
            InsightOut(
                type="goal_projection",
                severity="info",
                goal_id=goal.id,
                goal_name=goal.name,
                goal_name_bn=goal.name_bn,
                months_remaining=months,
                projected_completion_date=goal.projected_completion_date,
            )
        )
    return out


async def list_insights(db: AsyncSession, household_id: uuid.UUID, today: date_type) -> list[InsightOut]:
    insights: list[InsightOut] = []
    insights.extend(await _overspend_insights(db, household_id, today))

    pattern = await _pattern_insight(db, household_id, today)
    if pattern:
        insights.append(pattern)

    insights.extend(await _anomaly_insights(db, household_id, today))

    savings_opportunity = await _savings_opportunity_insight(db, household_id, today)
    if savings_opportunity:
        insights.append(savings_opportunity)

    insights.extend(await _goal_projection_insights(db, household_id, today))
    return insights
