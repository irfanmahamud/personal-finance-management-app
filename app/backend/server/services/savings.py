"""Savings plans & goals (spec §3.7).

Forecasting is the Phase 2 deterministic tier only (§3.7.2): projected
completion from the actual average monthly contribution, pure SQL over
history. Seasonal/AI-assisted forecasting is Phase 3.
"""

import calendar
import math
import uuid
from datetime import date as date_type

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Goal, GoalContribution
from server.db.queries import savings as q
from server.db.queries.reports import MONTHLY_INCOME, TOTALS, fetch_all, fetch_one
from server.schemas.savings import (
    AllocationSuggestion,
    AllocationSuggestionOut,
    ContributionCreate,
    ContributionOut,
    GoalCreate,
    GoalOut,
    GoalPatch,
)
from server.services.periods import month_period

MILESTONES = (25, 50, 75, 100)


def _add_months(d: date_type, n: int) -> date_type:
    total = d.month - 1 + n
    year = d.year + total // 12
    month = total % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date_type(year, month, min(d.day, last_day))


async def _to_out(db: AsyncSession, goal: Goal, today: date_type) -> GoalOut:
    contributions = (
        (
            await db.execute(
                select(GoalContribution.amount).where(GoalContribution.goal_id == goal.id)
            )
        )
        .scalars()
        .all()
    )
    total_contributed = sum(contributions)
    remaining = max(0, goal.target_amount - total_contributed)
    progress_pct = (
        min(100.0, total_contributed / goal.target_amount * 100) if goal.target_amount > 0 else 0.0
    )
    achieved = total_contributed >= goal.target_amount

    monthly_rows = await fetch_all(db, q.MONTHLY_CONTRIBUTIONS, goal_id=goal.id)
    avg_monthly = (
        int(sum(int(r.total) for r in monthly_rows) / len(monthly_rows)) if monthly_rows else None
    )

    projected_completion_date = None
    if not achieved and avg_monthly:
        months_needed = math.ceil(remaining / avg_monthly)
        projected_completion_date = _add_months(today, months_needed)

    return GoalOut(
        id=goal.id,
        name=goal.name,
        name_bn=goal.name_bn,
        goal_type=goal.goal_type,
        target_amount=goal.target_amount,
        target_date=goal.target_date,
        priority=goal.priority,
        active=goal.active,
        total_contributed=total_contributed,
        progress_pct=round(progress_pct, 1),
        remaining=remaining,
        achieved=achieved,
        avg_monthly_contribution=avg_monthly,
        projected_completion_date=projected_completion_date,
        milestones_reached=[m for m in MILESTONES if progress_pct >= m],
    )


async def list_goals(
    db: AsyncSession, household_id: uuid.UUID, today: date_type, include_inactive: bool = False
) -> list[GoalOut]:
    stmt = select(Goal).where(Goal.household_id == household_id)
    if not include_inactive:
        stmt = stmt.where(Goal.active.is_(True))
    stmt = stmt.order_by(Goal.priority, Goal.created_at)
    goals = (await db.execute(stmt)).scalars().all()
    return [await _to_out(db, g, today) for g in goals]


async def _get_owned(db: AsyncSession, household_id: uuid.UUID, goal_id: uuid.UUID) -> Goal:
    goal = await db.get(Goal, goal_id)
    if goal is None or goal.household_id != household_id:
        raise NotFoundError("Goal not found")
    return goal


async def create_goal(
    db: AsyncSession, household_id: uuid.UUID, body: GoalCreate, today: date_type
) -> GoalOut:
    priority = body.priority
    if priority is None:
        max_priority = (
            await db.execute(
                select(func.max(Goal.priority)).where(Goal.household_id == household_id)
            )
        ).scalar_one()
        priority = (max_priority or 0) + 1

    goal = Goal(
        household_id=household_id,
        name=body.name,
        name_bn=body.name_bn,
        goal_type=body.goal_type,
        target_amount=body.target_amount,
        target_date=body.target_date,
        priority=priority,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return await _to_out(db, goal, today)


async def patch_goal(
    db: AsyncSession, household_id: uuid.UUID, goal_id: uuid.UUID, body: GoalPatch, today: date_type
) -> GoalOut:
    goal = await _get_owned(db, household_id, goal_id)

    if body.name is not None:
        goal.name = body.name
    if body.name_bn is not None:
        goal.name_bn = body.name_bn
    if body.goal_type is not None:
        goal.goal_type = body.goal_type
    if body.target_amount is not None:
        goal.target_amount = body.target_amount
    if body.target_date is not None:
        goal.target_date = body.target_date
    if body.priority is not None:
        goal.priority = body.priority
    if body.active is not None:
        goal.active = body.active

    await db.commit()
    return await _to_out(db, goal, today)


async def add_contribution(
    db: AsyncSession,
    household_id: uuid.UUID,
    goal_id: uuid.UUID,
    body: ContributionCreate,
    today: date_type,
) -> GoalOut:
    goal = await _get_owned(db, household_id, goal_id)
    db.add(
        GoalContribution(
            goal_id=goal.id,
            date=body.date or today,
            amount=body.amount,
            notes=body.notes,
        )
    )
    await db.commit()
    return await _to_out(db, goal, today)


async def list_contributions(
    db: AsyncSession, household_id: uuid.UUID, goal_id: uuid.UUID
) -> list[ContributionOut]:
    goal = await _get_owned(db, household_id, goal_id)
    rows = (
        (
            await db.execute(
                select(GoalContribution)
                .where(GoalContribution.goal_id == goal.id)
                .order_by(GoalContribution.date.desc())
            )
        )
        .scalars()
        .all()
    )
    return [ContributionOut(id=c.id, date=c.date, amount=c.amount, notes=c.notes) for c in rows]


async def allocation_suggestion(
    db: AsyncSession, household_id: uuid.UUID, today: date_type
) -> AllocationSuggestionOut:
    """Funding priority (§3.7.1): the month's savings surplus, suggested-
    allocated top-down across active goals by priority. The household
    confirms each suggestion by posting it as a contribution - nothing
    here writes anything."""
    income_row = await fetch_one(db, MONTHLY_INCOME, household_id=household_id)
    monthly_income = int(income_row.monthly_income)

    start, end = month_period(today)
    spend_row = await fetch_one(db, TOTALS, household_id=household_id, date_from=start, date_to=end)
    spent_so_far = int(spend_row.total_spent)

    surplus = max(0, monthly_income - spent_so_far)

    goals = await list_goals(db, household_id, today)
    suggestions: list[AllocationSuggestion] = []
    remaining_surplus = surplus
    for goal in goals:
        if remaining_surplus <= 0 or goal.achieved:
            continue
        alloc = min(remaining_surplus, goal.remaining)
        if alloc <= 0:
            continue
        suggestions.append(
            AllocationSuggestion(goal_id=goal.id, goal_name=goal.name, suggested_amount=alloc)
        )
        remaining_surplus -= alloc

    return AllocationSuggestionOut(
        monthly_income=monthly_income,
        spent_so_far=spent_so_far,
        surplus=surplus,
        suggestions=suggestions,
    )
