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
from server.db.models import Household, User
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
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
