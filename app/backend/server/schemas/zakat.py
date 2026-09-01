import uuid
from datetime import date

from pydantic import BaseModel, Field


class ZakatConfigOut(BaseModel):
    id: uuid.UUID
    nisab_threshold: int
    rate_bps: int
    effective_from: date
    verified: bool


class ZakatConfigPatch(BaseModel):
    nisab_threshold: int | None = Field(default=None, gt=0)
    rate_bps: int | None = Field(default=None, ge=0)
    verified: bool | None = None


class ZakatEstimateOut(BaseModel):
    cash_and_bank: int
    gold_and_jewelry: int
    zakatable_investments: int
    liabilities: int
    zakatable_wealth: int
    nisab_threshold: int
    meets_nisab: bool
    rate_bps: int
    zakat_due: int
    verified: bool
