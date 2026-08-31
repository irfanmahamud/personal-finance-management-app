import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field

ASSET_CATEGORY_PATTERN = "^(cash_bank|property|vehicle|gold_jewelry|other)$"


class AssetCreate(BaseModel):
    category: str = Field(pattern=ASSET_CATEGORY_PATTERN)
    name: str = Field(min_length=1, max_length=120)
    value: int = Field(ge=0, description="poisha")
    valued_on: date_type | None = None  # defaults to today
    notes: str | None = Field(default=None, max_length=2000)


class AssetPatch(BaseModel):
    category: str | None = Field(default=None, pattern=ASSET_CATEGORY_PATTERN)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    value: int | None = Field(default=None, ge=0)
    valued_on: date_type | None = None
    active: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class AssetOut(BaseModel):
    id: uuid.UUID
    category: str
    name: str
    value: int
    valued_on: date_type
    logged_by_user_id: uuid.UUID
    active: bool
    notes: str | None


class NetWorthBreakdown(BaseModel):
    cash_bank: int
    property: int
    vehicle: int
    gold_jewelry: int
    other: int
    investments: int
    total_assets: int
    total_liabilities: int
    net_worth: int
    as_of: date_type


class NetWorthSnapshotOut(BaseModel):
    id: uuid.UUID
    snapshot_date: date_type
    total_assets: int
    total_liabilities: int
    net_worth: int
