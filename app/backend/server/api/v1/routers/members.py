from fastapi import APIRouter
from sqlalchemy import select

from server.core.deps import ActiveUser, DbSession
from server.db.models import Member
from server.schemas.member import MemberOut

router = APIRouter(prefix="/members", tags=["members"])


# Read-only in Phase 1: rows exist for expense attribution ("for whom"),
# management UI is Phase 2 (spec §3.5).
@router.get("", response_model=list[MemberOut])
async def list_members(db: DbSession, user: ActiveUser) -> list[MemberOut]:
    return list(
        (
            await db.execute(
                select(Member)
                .where(Member.household_id == user.household_id, Member.active)
                .order_by(Member.name)
            )
        ).scalars().all()
    )
