import uuid
from datetime import date

from pydantic import BaseModel, Field


class BudgetLineIn(BaseModel):
    category_id: uuid.UUID
    amount: int = Field(ge=0, description="poisha")
    rollover_enabled: bool = False


class BudgetCreate(BaseModel):
    period_start: date | None = None  # defaults to the current month
    template: str | None = Field(
        default=None,
        pattern="^(young_professional|young_family|extended_family)$",
    )
    # For a template: the total monthly budget the percentages apply to.
    total_amount: int | None = Field(default=None, gt=0, description="poisha")
    # For custom budgets: explicit lines.
    lines: list[BudgetLineIn] = []
    # Carry rollover from the previous period's budget where enabled.
    apply_rollover: bool = True


class BudgetLinePatch(BaseModel):
    amount: int | None = Field(default=None, ge=0)
    rollover_enabled: bool | None = None


class BudgetLineOut(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name_en: str
    category_name_bn: str
    icon: str | None
    amount: int
    rolled_over_amount: int
    spent: int
    # available = amount + rolled_over - spent (may be negative = overspent)
    available: int
    # ok | warn75 | warn95 - soft warnings only, never a hard block (§3.3.3)
    status: str
    rollover_enabled: bool


class BudgetOut(BaseModel):
    id: uuid.UUID
    period_start: date
    period_end: date
    fiscal_year: str
    method: str
    total_amount: int
    total_spent: int
    lines: list[BudgetLineOut]
