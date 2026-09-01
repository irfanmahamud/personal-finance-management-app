import uuid

from pydantic import BaseModel, Field


NEED_WANT_SAVE_PATTERN = "^(need|want|save)$"


class CategoryOut(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None
    name_en: str
    name_bn: str
    icon: str | None
    sort_order: int
    archived: bool
    # need | want | save | null - powers 50/30/20 auto-apply (§3.3.3); only
    # meaningful on top-level categories.
    need_want_save: str | None = None

    model_config = {"from_attributes": True}


class CategoryTreeOut(CategoryOut):
    children: list[CategoryOut] = []


class CategoryCreate(BaseModel):
    parent_id: uuid.UUID | None = None
    name_en: str = Field(min_length=1, max_length=120)
    name_bn: str = Field(min_length=1, max_length=120)
    icon: str | None = Field(default=None, max_length=16)


class CategoryPatch(BaseModel):
    name_en: str | None = Field(default=None, min_length=1, max_length=120)
    name_bn: str | None = Field(default=None, min_length=1, max_length=120)
    icon: str | None = Field(default=None, max_length=16)
    sort_order: int | None = None
    archived: bool | None = None
    need_want_save: str | None = Field(default=None, pattern=NEED_WANT_SAVE_PATTERN)


class PaymentMethodOut(BaseModel):
    id: uuid.UUID
    name: str
    name_bn: str | None
    icon: str | None
    sort_order: int

    model_config = {"from_attributes": True}


class PaymentMethodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    name_bn: str | None = Field(default=None, max_length=60)
    icon: str | None = Field(default=None, max_length=16)
