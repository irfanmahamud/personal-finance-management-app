import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field

INSTRUMENT_TYPE_PATTERN = "^(dps|fdr|sanchayapatra|pension|provident_fund|business|mutual_fund_gold)$"


class InvestmentCreate(BaseModel):
    instrument_type: str = Field(pattern=INSTRUMENT_TYPE_PATTERN)
    name: str = Field(min_length=1, max_length=120)
    amount: int = Field(gt=0, description="poisha")
    rate_bps: int | None = Field(default=None, ge=0, description="annual rate, basis points")
    start_date: date_type | None = None
    maturity_date: date_type | None = None
    tenure_months: int | None = Field(default=None, gt=0)
    auto_renewal: bool = False
    current_value: int | None = Field(default=None, ge=0, description="poisha, manual valuation")
    rebate_eligible: bool = False
    zakatable: bool = False
    notes: str | None = Field(default=None, max_length=2000)


class InvestmentPatch(BaseModel):
    instrument_type: str | None = Field(default=None, pattern=INSTRUMENT_TYPE_PATTERN)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    amount: int | None = Field(default=None, gt=0)
    rate_bps: int | None = Field(default=None, ge=0)
    start_date: date_type | None = None
    maturity_date: date_type | None = None
    tenure_months: int | None = Field(default=None, gt=0)
    auto_renewal: bool | None = None
    current_value: int | None = Field(default=None, ge=0)
    rebate_eligible: bool | None = None
    zakatable: bool | None = None
    active: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class InvestmentOut(BaseModel):
    id: uuid.UUID
    instrument_type: str
    name: str
    amount: int
    rate_bps: int | None
    start_date: date_type | None
    maturity_date: date_type | None
    tenure_months: int | None
    auto_renewal: bool
    current_value: int | None
    effective_value: int  # current_value if set, else amount
    projected_maturity_value: int | None  # simple-interest estimate, when rate + tenure are known
    rebate_eligible: bool
    zakatable: bool
    active: bool
    notes: str | None
    # overdue | renewal_due | maturity_soon | upcoming | none (no maturity_date)
    maturity_status: str


class PortfolioByType(BaseModel):
    instrument_type: str
    count: int
    invested: int
    current_value: int


class PortfolioOut(BaseModel):
    total_invested: int
    total_current_value: int
    by_type: list[PortfolioByType]
    next_maturities: list[InvestmentOut]
