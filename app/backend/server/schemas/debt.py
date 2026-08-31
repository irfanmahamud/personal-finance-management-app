import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field

DEBT_TYPE_PATTERN = "^(bank_loan|personal_loan|family_loan|credit_card)$"


class DebtCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    lender: str | None = Field(default=None, max_length=120)
    debt_type: str = Field(pattern=DEBT_TYPE_PATTERN)
    principal: int = Field(gt=0, description="poisha")
    current_balance: int | None = Field(
        default=None, ge=0, description="poisha; defaults to principal"
    )
    interest_rate_bps: int | None = Field(default=None, ge=0, description="annual, basis points")
    term_months: int | None = Field(default=None, gt=0, le=600)
    minimum_payment: int | None = Field(default=None, ge=0, description="poisha/month")
    start_date: date_type | None = None
    notes: str | None = Field(default=None, max_length=2000)


class DebtPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    lender: str | None = Field(default=None, max_length=120)
    debt_type: str | None = Field(default=None, pattern=DEBT_TYPE_PATTERN)
    principal: int | None = Field(default=None, gt=0)
    current_balance: int | None = Field(default=None, ge=0)
    interest_rate_bps: int | None = Field(default=None, ge=0)
    term_months: int | None = Field(default=None, gt=0, le=600)
    minimum_payment: int | None = Field(default=None, ge=0)
    start_date: date_type | None = None
    active: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class DebtPaymentCreate(BaseModel):
    date: date_type | None = None  # defaults to today
    amount: int = Field(gt=0, description="poisha")
    notes: str | None = Field(default=None, max_length=500)


class DebtPaymentOut(BaseModel):
    id: uuid.UUID
    date: date_type
    amount: int
    interest_portion: int
    principal_portion: int
    notes: str | None


class DebtOut(BaseModel):
    id: uuid.UUID
    name: str
    lender: str | None
    debt_type: str
    principal: int
    current_balance: int
    interest_rate_bps: int | None
    term_months: int | None
    minimum_payment: int | None
    start_date: date_type | None
    active: bool
    notes: str | None
    paid_off: bool
    total_paid: int
    total_interest_paid: int
    total_principal_paid: int
    calculated_emi: int | None  # from principal/rate/term - the loan's original EMI
    avg_monthly_payment: int | None  # actual, from payment history
    projected_payoff_date: date_type | None  # deterministic, from avg_monthly_payment


class AmortizationRow(BaseModel):
    month: int
    payment: int
    interest: int
    principal: int
    balance: int


class EmiCalculation(BaseModel):
    emi: int
    total_payment: int
    total_interest: int
    schedule: list[AmortizationRow]


class PayoffStrategy(BaseModel):
    order: list[uuid.UUID]  # debt ids, priority order this strategy targets first
    months_to_debt_free: int | None
    total_interest_paid: int


class PayoffComparisonOut(BaseModel):
    extra_monthly: int
    avalanche: PayoffStrategy
    snowball: PayoffStrategy
