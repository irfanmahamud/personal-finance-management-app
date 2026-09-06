import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field


class OneTimeIncomeCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    amount: int = Field(gt=0, description="poisha, BDT")
    date: date_type
    taxable: bool = False
    notes: str | None = Field(default=None, max_length=2000)


class OneTimeIncomePatch(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    amount: int | None = Field(default=None, gt=0)
    date: date_type | None = None
    taxable: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class OneTimeIncomeOut(BaseModel):
    id: uuid.UUID
    label: str
    amount: int
    date: date_type
    taxable: bool
    notes: str | None

    model_config = {"from_attributes": True}
