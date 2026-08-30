import uuid
from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field


class ExpenseCreate(BaseModel):
    # Idempotency key for the offline write queue - generated client-side.
    client_uuid: uuid.UUID
    date: date_type
    category_id: uuid.UUID
    amount: int = Field(gt=0, description="poisha")
    currency: str = Field(default="BDT", min_length=3, max_length=3)
    amount_bdt: int | None = Field(
        default=None, gt=0, description="poisha; defaults to amount for BDT"
    )
    description: str | None = Field(default=None, max_length=500)
    payment_method_id: uuid.UUID | None = None
    for_member_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)


class ExpensePatch(BaseModel):
    date: date_type | None = None
    category_id: uuid.UUID | None = None
    amount: int | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=500)
    payment_method_id: uuid.UUID | None = None
    for_member_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)


class ExpenseOut(BaseModel):
    id: uuid.UUID
    date: date_type
    category_id: uuid.UUID
    category_name_en: str
    category_name_bn: str
    amount: int
    currency: str
    amount_bdt: int
    description: str | None
    payment_method_id: uuid.UUID | None
    logged_by_user_id: uuid.UUID
    for_member_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    client_uuid: uuid.UUID


class ExpenseListOut(BaseModel):
    items: list[ExpenseOut]
    total: int


class RecentOut(BaseModel):
    """Powers 'repeat last entry' and the smart quick-add category grid."""

    last: ExpenseOut | None
    # Subcategory ids ranked by usage in the current time-of-day bucket
    # (falls back to overall usage). A SQL ranking, not a model (spec §3.4.1).
    category_ranking: list[uuid.UUID]
