"""Seed the household and its two user accounts.

All identity comes from the environment (spec §10 criterion 8: no family
names or amounts anywhere in source). Idempotent: safe to run repeatedly.

Usage: uv run python -m server.db.seed
"""

import asyncio
import os
import sys

from sqlalchemy import select

from server.core.security import hash_secret
from datetime import date

from server.db.models import Category, Household, PaymentMethod, TaxConfig, User
from server.db.seed_defaults import DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS
from server.db.session import get_session_factory


async def seed() -> None:
    name = os.environ.get("SEED_HOUSEHOLD_NAME", "Household")
    users = []
    for i in (1, 2):
        email = os.environ.get(f"SEED_USER_{i}_EMAIL")
        password = os.environ.get(f"SEED_USER_{i}_PASSWORD")
        if email and password:
            users.append((email.lower(), password, "admin" if i == 1 else "member"))

    if not users:
        sys.exit("No SEED_USER_*_EMAIL/PASSWORD set - nothing to seed.")

    async with get_session_factory()() as db:
        household = (
            await db.execute(select(Household).limit(1))
        ).scalar_one_or_none()
        if household is None:
            household = Household(name=name)
            db.add(household)
            await db.flush()
            print(f"created household {household.id}")

        for email, password, role in users:
            existing = (
                await db.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if existing is None:
                db.add(
                    User(
                        household_id=household.id,
                        email=email,
                        password_hash=hash_secret(password),
                        role=role,
                    )
                )
                print(f"created user {email} ({role})")
            else:
                print(f"user {email} already exists - skipped")

        # Default categories and payment methods, once per household.
        has_categories = (
            await db.execute(
                select(Category.id)
                .where(Category.household_id == household.id)
                .limit(1)
            )
        ).scalar_one_or_none()
        if has_categories is None:
            for sort, (icon, name_en, name_bn, subs) in enumerate(DEFAULT_CATEGORIES):
                parent = Category(
                    household_id=household.id,
                    name_en=name_en,
                    name_bn=name_bn,
                    icon=icon,
                    sort_order=sort,
                )
                db.add(parent)
                await db.flush()
                for sub_sort, (sub_en, sub_bn) in enumerate(subs):
                    db.add(
                        Category(
                            household_id=household.id,
                            parent_id=parent.id,
                            name_en=sub_en,
                            name_bn=sub_bn,
                            sort_order=sub_sort,
                        )
                    )
            print(f"seeded {len(DEFAULT_CATEGORIES)} categories")

        has_methods = (
            await db.execute(
                select(PaymentMethod.id)
                .where(PaymentMethod.household_id == household.id)
                .limit(1)
            )
        ).scalar_one_or_none()
        if has_methods is None:
            for sort, (name, name_bn, icon) in enumerate(DEFAULT_PAYMENT_METHODS):
                db.add(
                    PaymentMethod(
                        household_id=household.id,
                        name=name,
                        name_bn=name_bn,
                        icon=icon,
                        sort_order=sort,
                    )
                )
            print(f"seeded {len(DEFAULT_PAYMENT_METHODS)} payment methods")

        # Tax config: spec §3.2.2 figures, explicitly UNVERIFIED until the
        # current NBR slabs/thresholds/rebate rules are confirmed (§13 Q1).
        has_tax = (
            await db.execute(select(TaxConfig.id).limit(1))
        ).scalar_one_or_none()
        if has_tax is None:
            db.add(
                TaxConfig(
                    fiscal_year="2025-26",
                    slabs=[
                        {"up_to": 35_000_000, "rate_bps": 0},
                        {"up_to": 45_000_000, "rate_bps": 500},
                        {"up_to": 75_000_000, "rate_bps": 1000},
                        {"up_to": 115_000_000, "rate_bps": 1500},
                        {"up_to": 175_000_000, "rate_bps": 2000},
                        {"up_to": None, "rate_bps": 2500},
                    ],
                    thresholds={
                        # Category thresholds & min-tax floor: to be filled
                        # in during verification (§13 Q1).
                        "zero_band": {},
                        "min_tax": 0,
                    },
                    rebate_rules={
                        "salary_exemption_share_bps": 3333,
                        "salary_exemption_cap": 45_000_000,
                        "rebate_rate_bps": 1500,
                        "max_investment_share_bps": 2000,
                        "max_investment": 100_000_000,
                    },
                    effective_from=date(2025, 7, 1),
                    verified=False,
                )
            )
            print("seeded tax config 2025-26 (UNVERIFIED)")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
