"""Net worth (spec §3.10). Assets are manual, point-in-time valuations;
investments and liabilities are pulled live from their own tables rather
than duplicated here - a figure is entered exactly once. Snapshots are
upserted lazily whenever the household views this screen, one per
household per month - no cron, same philosophy as recurring.py.
"""

import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Asset, NetWorthSnapshot
from server.schemas.networth import (
    AssetCreate,
    AssetOut,
    AssetPatch,
    NetWorthBreakdown,
    NetWorthSnapshotOut,
)
from server.services import debts as debts_service
from server.services import investments as investments_service

ASSET_CATEGORIES = ("cash_bank", "property", "vehicle", "gold_jewelry", "other")


def _asset_out(a: Asset) -> AssetOut:
    return AssetOut(
        id=a.id, category=a.category, name=a.name, value=a.value, valued_on=a.valued_on,
        logged_by_user_id=a.logged_by_user_id, active=a.active, notes=a.notes,
    )


async def list_assets(
    db: AsyncSession, household_id: uuid.UUID, include_inactive: bool = False
) -> list[AssetOut]:
    stmt = select(Asset).where(Asset.household_id == household_id)
    if not include_inactive:
        stmt = stmt.where(Asset.active.is_(True))
    stmt = stmt.order_by(Asset.category, Asset.name)
    rows = (await db.execute(stmt)).scalars().all()
    return [_asset_out(a) for a in rows]


async def _get_owned(db: AsyncSession, household_id: uuid.UUID, asset_id: uuid.UUID) -> Asset:
    asset = await db.get(Asset, asset_id)
    if asset is None or asset.household_id != household_id:
        raise NotFoundError("Asset not found")
    return asset


async def create_asset(
    db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID, body: AssetCreate, today: date_type
) -> AssetOut:
    asset = Asset(
        household_id=household_id,
        category=body.category,
        name=body.name,
        value=body.value,
        valued_on=body.valued_on or today,
        logged_by_user_id=user_id,
        notes=body.notes,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return _asset_out(asset)


async def patch_asset(
    db: AsyncSession,
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    asset_id: uuid.UUID,
    body: AssetPatch,
    today: date_type,
) -> AssetOut:
    asset = await _get_owned(db, household_id, asset_id)
    revalued = body.value is not None
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    if revalued:
        # A new value is a new valuation event - record who and when, even
        # if the caller didn't pass valued_on explicitly.
        asset.logged_by_user_id = user_id
        if body.valued_on is None:
            asset.valued_on = today
    await db.commit()
    return _asset_out(asset)


async def delete_asset(db: AsyncSession, household_id: uuid.UUID, asset_id: uuid.UUID) -> None:
    asset = await _get_owned(db, household_id, asset_id)
    await db.delete(asset)
    await db.commit()


async def _breakdown(db: AsyncSession, household_id: uuid.UUID, today: date_type) -> NetWorthBreakdown:
    assets = await list_assets(db, household_id)
    totals = {cat: 0 for cat in ASSET_CATEGORIES}
    for a in assets:
        totals[a.category] += a.value

    portfolio = await investments_service.portfolio(db, household_id, today)
    debts = await debts_service.list_debts(db, household_id, today)

    total_assets = sum(totals.values()) + portfolio.total_current_value
    total_liabilities = sum(d.current_balance for d in debts)

    return NetWorthBreakdown(
        cash_bank=totals["cash_bank"],
        property=totals["property"],
        vehicle=totals["vehicle"],
        gold_jewelry=totals["gold_jewelry"],
        other=totals["other"],
        investments=portfolio.total_current_value,
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=total_assets - total_liabilities,
        as_of=today,
    )


async def current(db: AsyncSession, household_id: uuid.UUID, today: date_type) -> NetWorthBreakdown:
    """Live figures, and upserts this month's snapshot as a side effect -
    viewing net worth at least once a month is what builds the history."""
    breakdown = await _breakdown(db, household_id, today)
    snapshot_date = today.replace(day=1)

    stmt = (
        pg_insert(NetWorthSnapshot)
        .values(
            household_id=household_id,
            snapshot_date=snapshot_date,
            total_assets=breakdown.total_assets,
            total_liabilities=breakdown.total_liabilities,
            net_worth=breakdown.net_worth,
        )
        .on_conflict_do_update(
            index_elements=["household_id", "snapshot_date"],
            set_={
                "total_assets": breakdown.total_assets,
                "total_liabilities": breakdown.total_liabilities,
                "net_worth": breakdown.net_worth,
            },
        )
    )
    await db.execute(stmt)
    await db.commit()
    return breakdown


async def history(
    db: AsyncSession, household_id: uuid.UUID, limit: int = 24
) -> list[NetWorthSnapshotOut]:
    rows = (
        await db.execute(
            select(NetWorthSnapshot)
            .where(NetWorthSnapshot.household_id == household_id)
            .order_by(NetWorthSnapshot.snapshot_date.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        NetWorthSnapshotOut(
            id=r.id, snapshot_date=r.snapshot_date, total_assets=r.total_assets,
            total_liabilities=r.total_liabilities, net_worth=r.net_worth,
        )
        for r in reversed(rows)  # chart wants oldest -> newest
    ]
