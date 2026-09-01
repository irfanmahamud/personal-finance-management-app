"""Authentication flows: login, refresh rotation, logout, PIN gate.

PIN attempt limiting is server-side (spec §7.3): a 6-digit PIN brute-forces
in seconds if the client is the only gate. Five failures lock the PIN for
15 minutes.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import AuthError, ConflictError, DomainValidationError
from server.core.security import (
    create_access_token,
    hash_refresh_token,
    hash_secret,
    new_refresh_token,
    verify_secret,
)
from server.db.models import Category, Household, PaymentMethod, RefreshToken, User
from server.db.seed_defaults import DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS

PIN_MAX_ATTEMPTS = 5
PIN_LOCKOUT = timedelta(minutes=15)


async def signup(
    db: AsyncSession, email: str, password: str, household_name: str
) -> tuple[str, str, datetime, User]:
    """Public registration (Phase 4 multi-tenant feature, built ahead on
    explicit request - spec §12 otherwise defers this). Creates a brand
    new household, seeded with the same default category tree and payment
    methods as db/seed.py, so a signed-up household isn't left empty."""
    email = email.lower()
    existing = (
        await db.execute(select(User.id).where(User.email == email))
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("An account with this email already exists")

    household = Household(name=household_name)
    db.add(household)
    await db.flush()

    user = User(
        household_id=household.id,
        email=email,
        password_hash=hash_secret(password),
        role="admin",
    )
    db.add(user)
    await db.flush()

    for sort, (icon, name_en, name_bn, subs) in enumerate(DEFAULT_CATEGORIES):
        parent = Category(
            household_id=household.id, name_en=name_en, name_bn=name_bn, icon=icon, sort_order=sort
        )
        db.add(parent)
        await db.flush()
        for sub_sort, (sub_en, sub_bn) in enumerate(subs):
            db.add(
                Category(
                    household_id=household.id, parent_id=parent.id,
                    name_en=sub_en, name_bn=sub_bn, sort_order=sub_sort,
                )
            )

    for sort, (name, name_bn, icon) in enumerate(DEFAULT_PAYMENT_METHODS):
        db.add(
            PaymentMethod(
                household_id=household.id, name=name, name_bn=name_bn, icon=icon, sort_order=sort
            )
        )

    access = create_access_token(user.id, user.household_id)
    plain, token_hash, expires = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires))
    await db.commit()
    return access, plain, expires, user


async def login(
    db: AsyncSession, email: str, password: str
) -> tuple[str, str, datetime, User]:
    """Return (access_token, refresh_plain, refresh_expiry, user)."""
    user = (
        await db.execute(select(User).where(User.email == email.lower()))
    ).scalar_one_or_none()
    # Same error for unknown email and wrong password - no account probing.
    if user is None or not verify_secret(user.password_hash, password):
        raise AuthError("Invalid email or password")

    access = create_access_token(user.id, user.household_id)
    plain, token_hash, expires = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires))
    await db.commit()
    return access, plain, expires, user


async def refresh(
    db: AsyncSession, refresh_plain: str
) -> tuple[str, str, datetime]:
    """Rotate the refresh token: old one is revoked, a new one is issued."""
    token_hash = hash_refresh_token(refresh_plain)
    record = (
        await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if record is None or record.revoked or record.expires_at < now:
        raise AuthError("Invalid refresh token")

    user = await db.get(User, record.user_id)
    if user is None:
        raise AuthError("Invalid refresh token")

    record.revoked = True
    access = create_access_token(user.id, user.household_id)
    plain, new_hash, expires = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=new_hash, expires_at=expires))
    await db.commit()
    return access, plain, expires


async def logout(db: AsyncSession, refresh_plain: str | None) -> None:
    if not refresh_plain:
        return
    token_hash = hash_refresh_token(refresh_plain)
    record = (
        await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
    ).scalar_one_or_none()
    if record is not None:
        record.revoked = True
        await db.commit()


async def set_pin(
    db: AsyncSession, user_id: uuid.UUID, password: str, pin: str
) -> None:
    user = await db.get(User, user_id)
    if user is None or not verify_secret(user.password_hash, password):
        raise AuthError("Invalid password")
    user.pin_hash = hash_secret(pin)
    user.pin_failed_attempts = 0
    user.pin_locked_until = None
    await db.commit()


async def verify_pin(db: AsyncSession, user_id: uuid.UUID, pin: str) -> bool:
    user = await db.get(User, user_id)
    if user is None or user.pin_hash is None:
        raise DomainValidationError("No PIN set")

    now = datetime.now(timezone.utc)
    if user.pin_locked_until is not None and user.pin_locked_until > now:
        raise AuthError("PIN locked - try again later")

    if verify_secret(user.pin_hash, pin):
        user.pin_failed_attempts = 0
        user.pin_locked_until = None
        await db.commit()
        return True

    user.pin_failed_attempts += 1
    if user.pin_failed_attempts >= PIN_MAX_ATTEMPTS:
        user.pin_locked_until = now + PIN_LOCKOUT
        user.pin_failed_attempts = 0
    await db.commit()
    return False
