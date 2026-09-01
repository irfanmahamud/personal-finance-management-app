import uuid

from pydantic import BaseModel, Field


class SettingsOut(BaseModel):
    household_id: uuid.UUID
    household_name: str
    fiscal_year_start: int
    base_currency: str
    locale: str
    eid_mode_enabled: bool


class SettingsPatch(BaseModel):
    household_name: str | None = Field(default=None, min_length=1, max_length=120)
    fiscal_year_start: int | None = Field(default=None, ge=1, le=12)
    locale: str | None = Field(default=None, pattern="^(en|bn)$")
    eid_mode_enabled: bool | None = None
