import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    name_bn: str | None = Field(default=None, max_length=120)
    relation: str | None = Field(default=None, max_length=50)
    dob: date_type | None = None
    monthly_allowance: int = Field(default=0, ge=0, description="poisha")


class MemberPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    name_bn: str | None = Field(default=None, max_length=120)
    relation: str | None = Field(default=None, max_length=50)
    dob: date_type | None = None
    monthly_allowance: int | None = Field(default=None, ge=0)
    active: bool | None = None


class MemberOut(BaseModel):
    id: uuid.UUID
    name: str
    name_bn: str | None
    relation: str | None
    dob: date_type | None
    monthly_allowance: int
    active: bool

    model_config = {"from_attributes": True}
