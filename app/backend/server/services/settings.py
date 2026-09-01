import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Household, User
from server.schemas.settings import SettingsOut, SettingsPatch


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
        base_currency=household.base_currency,
        locale=user.locale,
        eid_mode_enabled=household.eid_mode_enabled,
    )


async def patch_settings(
    db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID, patch: SettingsPatch
) -> SettingsOut:
    household = await db.get(Household, household_id)
    user = await db.get(User, user_id)
    if household is None or user is None:
        raise NotFoundError("Household not found")
    if patch.household_name is not None:
        household.name = patch.household_name
    if patch.fiscal_year_start is not None:
        household.fiscal_year_start = patch.fiscal_year_start
    if patch.locale is not None:
        user.locale = patch.locale
    if patch.eid_mode_enabled is not None:
        household.eid_mode_enabled = patch.eid_mode_enabled
    await db.commit()
    return await get_settings_for(db, household_id, user_id)
