import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field


class LoanGivenCreate(BaseModel):
    borrower_name: str = Field(min_length=1, max_length=120)
    borrower_contact: str | None = Field(default=None, max_length=120)
    principal: int = Field(gt=0, description="poisha")
    interest_rate_bps: int | None = Field(default=None, ge=0, description="annual, basis points; omit for interest-free")
    start_date: date_type | None = None
    due_date: date_type | None = None
    notes: str | None = Field(default=None, max_length=2000)
    # Whether handing over this loan should also log an Expense (real cash
    # leaving now) - off by default, e.g. for backfilling a loan given
    # before the household started tracking, which shouldn't hit spending.
    log_as_expense: bool = False
    category_id: uuid.UUID | None = None  # required when log_as_expense is True
    payment_method_id: uuid.UUID | None = None
    for_member_id: uuid.UUID | None = None


class LoanGivenPatch(BaseModel):
    borrower_name: str | None = Field(default=None, min_length=1, max_length=120)
    borrower_contact: str | None = Field(default=None, max_length=120)
    principal: int | None = Field(default=None, gt=0)
    current_balance: int | None = Field(default=None, ge=0)
    interest_rate_bps: int | None = Field(default=None, ge=0)
    start_date: date_type | None = None
    due_date: date_type | None = None
    active: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class LoanGivenPaymentCreate(BaseModel):
    date: date_type | None = None  # defaults to today
    amount: int = Field(gt=0, description="poisha")
    notes: str | None = Field(default=None, max_length=500)


class LoanGivenPaymentOut(BaseModel):
    id: uuid.UUID
    date: date_type
    amount: int
    interest_portion: int
    principal_portion: int
    notes: str | None


class LoanGivenOut(BaseModel):
    id: uuid.UUID
    borrower_name: str
    borrower_contact: str | None
    principal: int
    current_balance: int
    interest_rate_bps: int | None
    start_date: date_type | None
    due_date: date_type | None
    active: bool
    notes: str | None
    paid_off: bool
    # overdue | due_soon | upcoming | no_due_date | paid_off | inactive
    status: str
    total_repaid: int
    total_interest_earned: int
    total_principal_repaid: int


class LoanSummaryOut(BaseModel):
    total_outstanding: int
    total_lent: int  # principal, active loans only
    total_repaid: int
    total_interest_earned: int
    active_count: int
    overdue_count: int
