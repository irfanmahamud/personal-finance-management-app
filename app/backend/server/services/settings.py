import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Budget, Household, User
from server.schemas.settings import SettingsOut, SettingsPatch
from server.services.periods import month_period


async def get_settings_for(
    db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID
) -> SettingsOut:
    household = await db.get(Household, household_id)
    user = await db.get(User, user_id)
    if household is None or user is None:
        raise NotFoundError("Household not found")
    return SettingsOut(
        household_id=household.id,
        household_name=household.name,
        fiscal_year_start=household.fiscal_year_start,
        month_start_day=household.month_start_day,
        base_currency=household.base_currency,
        locale=user.locale,
        eid_mode_enabled=household.eid_mode_enabled,
    )


async def _migrate_current_budget(
    db: AsyncSession, household_id: uuid.UUID, today: date_type,
    old_month_start_day: int, new_month_start_day: int,
) -> None:
    """Changing month_start_day shifts which period is "current" - reshape
    the budget that WAS current (under the old rule) to the new boundary
    in place, rather than orphaning it. Only period_start/period_end move;
    lines/amounts/rollover are untouched, and spend is computed live from
    Expense rows at read time, so nothing else needs to change."""
    old_start, _ = month_period(today, old_month_start_day)
    budget = (
        await db.execute(
            select(Budget).where(
                Budget.household_id == household_id, Budget.period_start == old_start,
            )
        )
    ).scalar_one_or_none()
    if budget is None:
        return  # nothing current to migrate

    new_start, new_end = month_period(today, new_month_start_day)
    conflict = (
        await db.execute(
            select(Budget.id).where(
                Budget.household_id == household_id, Budget.period_start == new_start,
            )
        )
    ).scalar_one_or_none()
    if conflict is not None:
        return  # a budget already occupies the target period - leave both as-is

    budget.period_start = new_start
    budget.period_end = new_end


async def patch_settings(
    db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID,
    patch: SettingsPatch, today: date_type,
) -> SettingsOut:
    household = await db.get(Household, household_id)
    user = await db.get(User, user_id)
    if household is None or user is None:
        raise NotFoundError("Household not found")
    if patch.household_name is not None:
        household.name = patch.household_name
    if patch.fiscal_year_start is not None:
        household.fiscal_year_start = patch.fiscal_year_start
    if patch.month_start_day is not None and patch.month_start_day != household.month_start_day:
        await _migrate_current_budget(
            db, household_id, today, household.month_start_day, patch.month_start_day
        )
        household.month_start_day = patch.month_start_day
    if patch.locale is not None:
        user.locale = patch.locale
    if patch.eid_mode_enabled is not None:
        household.eid_mode_enabled = patch.eid_mode_enabled
    await db.commit()
    return await get_settings_for(db, household_id, user_id)
