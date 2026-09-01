"""Zakat calculator (spec §5.3). Nisab tracks the market gold/silver price,
which this app has no live feed for (same reasoning as tax_config being
versioned rather than computed) - a household updates zakat_config
periodically via PATCH /zakat/config, and it starts UNVERIFIED.

Zakatable wealth = cash/bank assets + gold/jewelry assets + investments
flagged zakatable, minus outstanding debt. Property, vehicles, and other
personal-use assets are excluded by category, not by a per-asset flag.
"""

import uuid
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Asset, ZakatConfig
from server.schemas.zakat import ZakatConfigOut, ZakatConfigPatch, ZakatEstimateOut
from server.services import debts as debts_service
from server.services import investments as investments_service


async def _current_config(db: AsyncSession) -> ZakatConfig:
    config = (
        await db.execute(
            select(ZakatConfig).order_by(ZakatConfig.effective_from.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if config is None:
        raise NotFoundError("No zakat configuration available")
    return config


def _config_out(config: ZakatConfig) -> ZakatConfigOut:
    return ZakatConfigOut(
        id=config.id,
        nisab_threshold=config.nisab_threshold,
        rate_bps=config.rate_bps,
        effective_from=config.effective_from,
        verified=config.verified,
    )


async def get_config(db: AsyncSession) -> ZakatConfigOut:
    return _config_out(await _current_config(db))


async def patch_config(db: AsyncSession, body: ZakatConfigPatch) -> ZakatConfigOut:
    config = await _current_config(db)
    if body.nisab_threshold is not None:
        config.nisab_threshold = body.nisab_threshold
    if body.rate_bps is not None:
        config.rate_bps = body.rate_bps
    if body.verified is not None:
        config.verified = body.verified
    await db.commit()
    return _config_out(config)


async def estimate(
    db: AsyncSession, household_id: uuid.UUID, today: date_type
) -> ZakatEstimateOut:
    config = await _current_config(db)

    asset_rows = (
        await db.execute(
            select(Asset.category, Asset.value).where(
                Asset.household_id == household_id, Asset.active.is_(True)
            )
        )
    ).all()
    cash_and_bank = sum(value for category, value in asset_rows if category == "cash_bank")
    gold_and_jewelry = sum(value for category, value in asset_rows if category == "gold_jewelry")

    investments = await investments_service.list_investments(db, household_id, today)
    zakatable_investments = sum(
        inv.effective_value for inv in investments if inv.zakatable and inv.active
    )

    debts = await debts_service.list_debts(db, household_id, today)
    liabilities = sum(d.current_balance for d in debts)

    zakatable_wealth = max(0, cash_and_bank + gold_and_jewelry + zakatable_investments - liabilities)
    meets_nisab = zakatable_wealth >= config.nisab_threshold
    zakat_due = zakatable_wealth * config.rate_bps // 10_000 if meets_nisab else 0

    return ZakatEstimateOut(
        cash_and_bank=cash_and_bank,
        gold_and_jewelry=gold_and_jewelry,
        zakatable_investments=zakatable_investments,
        liabilities=liabilities,
        zakatable_wealth=zakatable_wealth,
        nisab_threshold=config.nisab_threshold,
        meets_nisab=meets_nisab,
        rate_bps=config.rate_bps,
        zakat_due=zakat_due,
        verified=config.verified,
    )
