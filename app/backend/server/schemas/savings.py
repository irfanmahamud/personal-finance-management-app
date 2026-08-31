import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field

GOAL_TYPE_PATTERN = "^(emergency_fund|child_education|hajj_umrah|home|vehicle|wedding|custom)$"


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    name_bn: str | None = Field(default=None, max_length=120)
    goal_type: str = Field(pattern=GOAL_TYPE_PATTERN)
    target_amount: int = Field(gt=0, description="poisha")
    target_date: date_type | None = None
    priority: int | None = None  # defaults to last (lowest funding priority)


class GoalPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    name_bn: str | None = Field(default=None, max_length=120)
    goal_type: str | None = Field(default=None, pattern=GOAL_TYPE_PATTERN)
    target_amount: int | None = Field(default=None, gt=0)
    target_date: date_type | None = None
    priority: int | None = None
    active: bool | None = None


class ContributionCreate(BaseModel):
    date: date_type | None = None  # defaults to today
    amount: int = Field(gt=0, description="poisha")
    notes: str | None = Field(default=None, max_length=500)


class ContributionOut(BaseModel):
    id: uuid.UUID
    date: date_type
    amount: int
    notes: str | None


class GoalOut(BaseModel):
    id: uuid.UUID
    name: str
    name_bn: str | None
    goal_type: str
    target_amount: int
    target_date: date_type | None
    priority: int
    active: bool
    total_contributed: int
    progress_pct: float
    remaining: int
    achieved: bool
    # Deterministic forecast (spec §3.7.2 Phase 2 tier) - pure history, no model.
    avg_monthly_contribution: int | None
    projected_completion_date: date_type | None
    milestones_reached: list[int]  # subset of [25, 50, 75, 100]


class AllocationSuggestion(BaseModel):
    goal_id: uuid.UUID
    goal_name: str
    suggested_amount: int


class AllocationSuggestionOut(BaseModel):
    monthly_income: int
    spent_so_far: int
    surplus: int
    suggestions: list[AllocationSuggestion]
