import uuid
from datetime import date

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.savings import (
    AllocationSuggestionOut,
    ContributionCreate,
    ContributionOut,
    GoalCreate,
    GoalOut,
    GoalPatch,
)
from server.services import savings as service

router = APIRouter(prefix="/savings", tags=["savings"])


@router.get("/goals", response_model=list[GoalOut])
async def list_goals(
    db: DbSession, user: ActiveUser, include_inactive: bool = False
) -> list[GoalOut]:
    return await service.list_goals(db, user.household_id, date.today(), include_inactive)


@router.post("/goals", response_model=GoalOut, status_code=201)
async def create_goal(body: GoalCreate, db: DbSession, user: ActiveUser) -> GoalOut:
    return await service.create_goal(db, user.household_id, body, date.today())


@router.patch("/goals/{goal_id}", response_model=GoalOut)
async def patch_goal(
    goal_id: uuid.UUID, body: GoalPatch, db: DbSession, user: ActiveUser
) -> GoalOut:
    return await service.patch_goal(db, user.household_id, goal_id, body, date.today())


@router.get("/goals/{goal_id}/contributions", response_model=list[ContributionOut])
async def list_contributions(
    goal_id: uuid.UUID, db: DbSession, user: ActiveUser
) -> list[ContributionOut]:
    return await service.list_contributions(db, user.household_id, goal_id)


@router.post("/goals/{goal_id}/contributions", response_model=GoalOut, status_code=201)
async def add_contribution(
    goal_id: uuid.UUID, body: ContributionCreate, db: DbSession, user: ActiveUser
) -> GoalOut:
    return await service.add_contribution(db, user.household_id, goal_id, body, date.today())


@router.get("/allocation-suggestion", response_model=AllocationSuggestionOut)
async def allocation_suggestion(db: DbSession, user: ActiveUser) -> AllocationSuggestionOut:
    return await service.allocation_suggestion(db, user.household_id, date.today())
