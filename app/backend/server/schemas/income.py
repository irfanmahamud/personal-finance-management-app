import uuid

from pydantic import BaseModel, Field

INCOME_TYPES = "^(salary|business|freelance|rental|remittance|investment|other)$"
FREQUENCIES = "^(monthly|weekly|biweekly|irregular)$"


class IncomeSourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(pattern=INCOME_TYPES)
    currency: str = Field(default="BDT", min_length=3, max_length=3)
    amount: int = Field(gt=0, description="poisha, in `currency`")
    amount_bdt: int | None = Field(default=None, gt=0)
    frequency: str = Field(default="monthly", pattern=FREQUENCIES)
    taxable: bool = True


class IncomeSourcePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    amount: int | None = Field(default=None, gt=0)
    amount_bdt: int | None = Field(default=None, gt=0)
    frequency: str | None = Field(default=None, pattern=FREQUENCIES)
    taxable: bool | None = None
    active: bool | None = None


class IncomeSourceOut(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    currency: str
    amount: int
    amount_bdt: int
    frequency: str
    taxable: bool
    active: bool

    model_config = {"from_attributes": True}


class DeductionCreate(BaseModel):
    type: str = Field(pattern="^(professional_tax|provident_fund|emi|association_fee|insurance)$")
    amount: int = Field(gt=0, description="poisha, monthly")


class DeductionOut(BaseModel):
    id: uuid.UUID
    type: str
    amount: int
    frequency: str

    model_config = {"from_attributes": True}


class BreakdownLineOut(BaseModel):
    label: str
    detail: str
    amount: int


class TaxEstimateOut(BaseModel):
    fiscal_year: str
    verified: bool  # False -> the UI must show the UNVERIFIED banner
    gross_annual: int
    exemption: int
    taxable_annual: int
    gross_tax: int
    rebate: int
    net_tax_annual: int
    monthly_tds: int
    lines: list[BreakdownLineOut]
    # Gross -> net monthly walkthrough
    monthly_gross: int
    monthly_deductions: int
    monthly_net: int
