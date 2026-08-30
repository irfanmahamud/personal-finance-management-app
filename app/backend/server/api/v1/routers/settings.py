from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.settings import SettingsOut, SettingsPatch
from server.services import settings as settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
async def get_settings(db: DbSession, user: ActiveUser) -> SettingsOut:
    return await settings_service.get_settings_for(db, user.household_id, user.user_id)


@router.patch("", response_model=SettingsOut)
async def update_settings(
    patch: SettingsPatch, db: DbSession, user: ActiveUser
) -> SettingsOut:
    return await settings_service.patch_settings(
        db, user.household_id, user.user_id, patch
    )
