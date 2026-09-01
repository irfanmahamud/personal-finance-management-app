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
    # True when the payer withholds tax before paying out (typical salary).
    tds_at_source: bool = False
    # Actual monthly withholding from the payslip, if known (poisha).
    tds_amount_monthly: int | None = Field(default=None, ge=0)


class IncomeSourcePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: str | None = Field(default=None, pattern=INCOME_TYPES)
    amount: int | None = Field(default=None, gt=0)
    amount_bdt: int | None = Field(default=None, gt=0)
    frequency: str | None = Field(default=None, pattern=FREQUENCIES)
    taxable: bool | None = None
    tds_at_source: bool | None = None
    tds_amount_monthly: int | None = Field(default=None, ge=0)
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
    tds_at_source: bool
    tds_amount_monthly: int | None
    active: bool

    model_config = {"from_attributes": True}


DEDUCTION_TYPES = "^(professional_tax|provident_fund|emi|association_fee|insurance)$"


class DeductionCreate(BaseModel):
    type: str = Field(pattern=DEDUCTION_TYPES)
    # Provide either a flat monthly amount, or income_source_id + percentage_bps
    # (e.g. "10% of my salary") - the effective amount is then computed live
    # and stays in sync with the income source instead of going stale.
    amount: int | None = Field(default=None, gt=0, description="poisha, monthly")
    income_source_id: uuid.UUID | None = None
    percentage_bps: int | None = Field(default=None, gt=0, le=10_000)
    # provident_fund only: the employer's matching rate. Requires income_source_id.
    employer_match_bps: int | None = Field(default=None, gt=0, le=10_000)


class DeductionPatch(BaseModel):
    amount: int | None = Field(default=None, gt=0)
    income_source_id: uuid.UUID | None = None
    percentage_bps: int | None = Field(default=None, gt=0, le=10_000)
    employer_match_bps: int | None = Field(default=None, gt=0, le=10_000)


class DeductionOut(BaseModel):
    id: uuid.UUID
    type: str
    amount: int  # computed effective monthly employee amount, poisha
    frequency: str
    income_source_id: uuid.UUID | None
    percentage_bps: int | None
    employer_match_bps: int | None
    employer_amount: int  # computed, poisha/month - not part of take-home


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
    # Withheld-at-source vs. self-paid split: liability already covered by
    # payers withholding TDS, and what remains for the taxpayer to provision.
    withheld_annual: int
    remaining_payable_annual: int  # negative = overpaid, expect refund/adjustment
    monthly_withheld: int
    monthly_set_aside: int  # what to put away monthly for un-withheld tax
    # Gross -> net monthly walkthrough
    monthly_gross: int
    monthly_deductions: int
    monthly_net: int
    # Employer's provident-fund matching contribution - additional savings,
    # never subtracted from take-home (spec §3.7A.1: employee + employer
    # contributions, one entry, both views).
    provident_fund_employer_monthly: int
