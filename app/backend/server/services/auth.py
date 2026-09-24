"""Authentication flows: login, refresh rotation, logout, PIN gate.

PIN attempt limiting is server-side (spec §7.3): a 6-digit PIN brute-forces
in seconds if the client is the only gate. Five failures lock the PIN for
15 minutes.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import AuthError, ConflictError, DomainValidationError
from server.core.security import (
    create_access_token,
    hash_refresh_token,
    hash_secret,
    new_refresh_token,
    verify_secret,
)
from server.db.models import (
    Asset,
    Budget,
    BudgetLine,
    Category,
    Debt,
    DebtPayment,
    Deduction,
    Expense,
    Goal,
    GoalContribution,
    Household,
    IncomeSource,
    ZakatConfig,
    Investment,
    InvestmentTransaction,
    LoanGiven,
    LoanGivenPayment,
    Member,
    NetWorthSnapshot,
    OneTimeIncome,
    PaymentMethod,
    Receipt,
    RecurringRule,
    RefreshToken,
    Tag,
    User,
)
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


async def _revoke_chain_forward(db: AsyncSession, start: RefreshToken) -> None:
    """Revoke `start` and every successor reachable from it."""
    walk: RefreshToken | None = start
    seen: set = set()
    while walk is not None and walk.id not in seen:
        seen.add(walk.id)
        walk.revoked = True
        walk = (
            await db.get(RefreshToken, walk.replaced_by_id)
            if walk.replaced_by_id is not None
            else None
        )


async def refresh(
    db: AsyncSession, refresh_plain: str
) -> tuple[str, str, datetime]:
    """Rotate the refresh token with DEFERRED revocation.

    The presented token is not revoked when its successor is issued - it stays
    valid until the successor is FIRST USED, because using the successor is
    the only proof the client actually persisted it. This closes the mobile
    logout race: on a flaky network the rotation response can be lost after
    the server committed it, leaving the phone holding what used to be a dead
    token ("keep the user logged in until they log out").

    Three cases for the presented token T:
    - T has no successor: normal rotation. Issue T2, point T at it, and revoke
      T's PREDECESSOR (using T proves T was adopted - the grace window on the
      previous token ends now). At most two usable tokens exist per chain.
    - T has an UNUSED successor: the previous rotation's response never made
      it to the client. Revoke the orphan and issue a fresh successor -
      recovery, not an error.
    - T has a USED successor: someone is replaying an old token after the real
      client moved on - a theft signal. Revoke the whole chain and fail.
    """
    token_hash = hash_refresh_token(refresh_plain)
    record = (
        await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if record is None or record.expires_at < now:
        raise AuthError("Invalid refresh token")

    if record.revoked:
        # A revoked token being replayed is the theft signal (its successor
        # was adopted, which is what revoked it - or it was logged out).
        # Standard reuse detection: kill every descendant still alive, so a
        # stolen old token can't coexist with a live session.
        if record.replaced_by_id is not None:
            successor = await db.get(RefreshToken, record.replaced_by_id)
            if successor is not None:
                await _revoke_chain_forward(db, successor)
                await db.commit()
        raise AuthError("Invalid refresh token")

    user = await db.get(User, record.user_id)
    if user is None:
        raise AuthError("Invalid refresh token")

    if record.replaced_by_id is not None:
        # A successor exists but was never used (using it would have revoked
        # this token): the rotation response was lost - recovery, not reuse.
        successor = await db.get(RefreshToken, record.replaced_by_id)
        if successor is not None:
            successor.revoked = True  # orphan: issued but never adopted

    # Using this token proves the client adopted it - its predecessor's
    # grace window closes here.
    predecessor = (
        await db.execute(
            select(RefreshToken).where(RefreshToken.replaced_by_id == record.id)
        )
    ).scalar_one_or_none()
    if predecessor is not None:
        predecessor.revoked = True

    access = create_access_token(user.id, user.household_id)
    plain, new_hash, expires = new_refresh_token()
    new_row = RefreshToken(user_id=user.id, token_hash=new_hash, expires_at=expires)
    db.add(new_row)
    await db.flush()
    record.replaced_by_id = new_row.id
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
        # Logout is explicit: revoke the presented token, its in-grace
        # predecessor, and any orphan successor - nothing survives.
        record.revoked = True
        predecessor = (
            await db.execute(
                select(RefreshToken).where(RefreshToken.replaced_by_id == record.id)
            )
        ).scalar_one_or_none()
        if predecessor is not None:
            predecessor.revoked = True
        if record.replaced_by_id is not None:
            successor = await db.get(RefreshToken, record.replaced_by_id)
            if successor is not None:
                await _revoke_chain_forward(db, successor)
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


async def delete_account(db: AsyncSession, user_id: uuid.UUID, household_id: uuid.UUID, password: str) -> None:
    """Irreversible. Spec §9/§12 keep this app single-user-per-household (no
    invite flow) - deleting "your account" IS deleting the whole household,
    so every row scoped to it goes too. Deletes bottom-up through the FK
    graph by hand (household_id has no ON DELETE CASCADE anywhere - adding
    it to ~20 constraints just for this would be a bigger, riskier change
    than one reviewable, explicit list) rather than relying on the database
    to figure out the order."""
    user = await db.get(User, user_id)
    if user is None or not verify_secret(user.password_hash, password):
        raise AuthError("Invalid password")

    hid = household_id
    goal_ids = select(Goal.id).where(Goal.household_id == hid)
    investment_ids = select(Investment.id).where(Investment.household_id == hid)
    debt_ids = select(Debt.id).where(Debt.household_id == hid)
    loan_ids = select(LoanGiven.id).where(LoanGiven.household_id == hid)
    budget_ids = select(Budget.id).where(Budget.household_id == hid)

    # Second-level rows (no household_id of their own) first.
    await db.execute(delete(GoalContribution).where(GoalContribution.goal_id.in_(goal_ids)))
    await db.execute(
        delete(InvestmentTransaction).where(InvestmentTransaction.investment_id.in_(investment_ids))
    )
    await db.execute(delete(DebtPayment).where(DebtPayment.debt_id.in_(debt_ids)))
    await db.execute(delete(LoanGivenPayment).where(LoanGivenPayment.loan_id.in_(loan_ids)))
    await db.execute(delete(BudgetLine).where(BudgetLine.budget_id.in_(budget_ids)))

    # Expense/Tag first - expense_tag cascades from either side (the only
    # ON DELETE CASCADE in the schema), and Expense is what everything else
    # below (Receipt, RecurringRule, LoanGiven, Member, PaymentMethod,
    # Category) is referenced by.
    await db.execute(delete(Expense).where(Expense.household_id == hid))
    await db.execute(delete(Tag).where(Tag.household_id == hid))
    await db.execute(delete(Receipt).where(Receipt.household_id == hid))
    await db.execute(delete(RecurringRule).where(RecurringRule.household_id == hid))
    await db.execute(delete(Budget).where(Budget.household_id == hid))
    await db.execute(delete(Goal).where(Goal.household_id == hid))
    await db.execute(delete(Investment).where(Investment.household_id == hid))
    await db.execute(delete(Debt).where(Debt.household_id == hid))
    await db.execute(delete(LoanGiven).where(LoanGiven.household_id == hid))
    await db.execute(delete(Asset).where(Asset.household_id == hid))
    await db.execute(delete(NetWorthSnapshot).where(NetWorthSnapshot.household_id == hid))
    await db.execute(delete(Member).where(Member.household_id == hid))
    await db.execute(delete(Deduction).where(Deduction.household_id == hid))
    await db.execute(delete(ZakatConfig).where(ZakatConfig.household_id == hid))
    await db.execute(delete(IncomeSource).where(IncomeSource.household_id == hid))
    await db.execute(delete(OneTimeIncome).where(OneTimeIncome.household_id == hid))
    await db.execute(delete(PaymentMethod).where(PaymentMethod.household_id == hid))
    await db.execute(delete(Category).where(Category.household_id == hid))  # self-FK, one statement
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await db.execute(delete(Household).where(Household.id == hid))
    await db.commit()
