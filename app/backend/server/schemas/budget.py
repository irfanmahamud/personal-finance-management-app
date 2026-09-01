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
        pattern="^(young_professional|young_family|extended_family|50_30_20)$",
    )
    # For a household template or 50/30/20: the total the percentages apply to.
    # 50/30/20 requires categories tagged need/want/save first (Categories screen).
    total_amount: int | None = Field(default=None, gt=0, description="poisha")
    # For custom/zero-based budgets: explicit lines.
    lines: list[BudgetLineIn] = []
    # Carry rollover from the previous period's budget where enabled.
    apply_rollover: bool = True
    # Zero-based budgeting (§3.3.3): the pool assigned across `lines`. When
    # set, the budget's method becomes "zero_based" and BudgetOut exposes
    # unassigned_amount = assignable_amount - sum(lines) as the "every taka
    # assigned" surface.
    assignable_amount: int | None = Field(default=None, ge=0, description="poisha")


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
    assignable_amount: int | None = None
    # assignable_amount - total_amount; null unless method is zero_based.
    unassigned_amount: int | None = None


class BudgetSummary(BaseModel):
    id: uuid.UUID
    period_start: date
    period_end: date
    method: str
    total_amount: int
    total_spent: int
