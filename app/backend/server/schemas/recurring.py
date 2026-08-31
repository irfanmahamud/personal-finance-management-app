import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field


class RecurringRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category_id: uuid.UUID
    amount: int = Field(gt=0, description="poisha")
    payment_method_id: uuid.UUID | None = None
    for_member_id: uuid.UUID | None = None
    day_of_month: int = Field(ge=1, le=28)
    notes: str | None = Field(default=None, max_length=2000)


class RecurringRulePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category_id: uuid.UUID | None = None
    amount: int | None = Field(default=None, gt=0)
    payment_method_id: uuid.UUID | None = None
    for_member_id: uuid.UUID | None = None
    day_of_month: int | None = Field(default=None, ge=1, le=28)
    active: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class RecurringMarkPaid(BaseModel):
    date: date_type | None = None  # defaults to today
    amount: int | None = Field(default=None, gt=0)  # override just this occurrence


class RecurringRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    category_id: uuid.UUID
    category_name_en: str
    category_name_bn: str
    icon: str | None
    amount: int
    payment_method_id: uuid.UUID | None
    for_member_id: uuid.UUID | None
    day_of_month: int
    next_due_date: date_type
    # overdue | due_today | due_soon | upcoming | inactive
    status: str
    active: bool
    notes: str | None
    last_paid_date: date_type | None
