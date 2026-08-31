"""Family member management (spec §3.5). Rows existed since Phase 1 for
expense attribution ("for whom"); this adds the management CRUD."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Member
from server.schemas.member import MemberCreate, MemberPatch


async def list_members(
    db: AsyncSession, household_id: uuid.UUID, include_inactive: bool = False
) -> list[Member]:
    stmt = select(Member).where(Member.household_id == household_id)
    if not include_inactive:
        stmt = stmt.where(Member.active.is_(True))
    stmt = stmt.order_by(Member.name)
    return list((await db.execute(stmt)).scalars().all())


async def create(db: AsyncSession, household_id: uuid.UUID, body: MemberCreate) -> Member:
    member = Member(
        household_id=household_id,
        name=body.name,
        name_bn=body.name_bn,
        relation=body.relation,
        dob=body.dob,
        monthly_allowance=body.monthly_allowance,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def patch(
    db: AsyncSession, household_id: uuid.UUID, member_id: uuid.UUID, body: MemberPatch
) -> Member:
    member = await db.get(Member, member_id)
    if member is None or member.household_id != household_id:
        raise NotFoundError("Member not found")

    if body.name is not None:
        member.name = body.name
    if body.name_bn is not None:
        member.name_bn = body.name_bn
    if body.relation is not None:
        member.relation = body.relation
    if body.dob is not None:
        member.dob = body.dob
    if body.monthly_allowance is not None:
        member.monthly_allowance = body.monthly_allowance
    if body.active is not None:
        member.active = body.active

    await db.commit()
    return member
