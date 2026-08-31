import uuid

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.member import MemberCreate, MemberOut, MemberPatch
from server.services import members as service

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=list[MemberOut])
async def list_members(
    db: DbSession, user: ActiveUser, include_inactive: bool = False
) -> list[MemberOut]:
    return await service.list_members(db, user.household_id, include_inactive)


@router.post("", response_model=MemberOut, status_code=201)
async def create_member(body: MemberCreate, db: DbSession, user: ActiveUser) -> MemberOut:
    return await service.create(db, user.household_id, body)


@router.patch("/{member_id}", response_model=MemberOut)
async def patch_member(
    member_id: uuid.UUID, body: MemberPatch, db: DbSession, user: ActiveUser
) -> MemberOut:
    return await service.patch(db, user.household_id, member_id, body)
