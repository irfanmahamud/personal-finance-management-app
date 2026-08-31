import uuid
from datetime import date as date_type
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import NotFoundError
from server.db.models import Category, Expense
from server.schemas.expense import (
    ExpenseCreate,
    ExpenseListOut,
    ExpenseOut,
    ExpensePatch,
    RecentOut,
    SuggestionOut,
)


def _row_to_out(row) -> ExpenseOut:
    e: Expense = row.Expense
    return ExpenseOut(
        id=e.id,
        date=e.date,
        category_id=e.category_id,
        category_name_en=row.name_en,
        category_name_bn=row.name_bn,
        amount=e.amount,
        currency=e.currency,
        amount_bdt=e.amount_bdt,
        description=e.description,
        payment_method_id=e.payment_method_id,
        logged_by_user_id=e.logged_by_user_id,
        for_member_id=e.for_member_id,
        notes=e.notes,
        created_at=e.created_at,
        client_uuid=e.client_uuid,
    )


def _base_query(household_id: uuid.UUID):
    return (
        select(Expense, Category.name_en, Category.name_bn)
        .join(Category, Category.id == Expense.category_id)
        .where(Expense.household_id == household_id)
    )


async def _get_out(db: AsyncSession, household_id: uuid.UUID, expense_id: uuid.UUID) -> ExpenseOut:
    row = (
        await db.execute(_base_query(household_id).where(Expense.id == expense_id))
    ).first()
    if row is None:
        raise NotFoundError("Expense not found")
    return _row_to_out(row)


async def create(
    db: AsyncSession,
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    body: ExpenseCreate,
) -> tuple[ExpenseOut, bool]:
    """Idempotent on client_uuid. Returns (expense, created).

    An offline-queue replay of an already-applied write returns the
    existing row unchanged - never a duplicate, never an error.
    """
    category = await db.get(Category, body.category_id)
    if category is None or category.household_id != household_id:
        raise NotFoundError("Category not found")

    stmt = (
        pg_insert(Expense)
        .values(
            id=uuid.uuid4(),
            household_id=household_id,
            date=body.date,
            category_id=body.category_id,
            amount=body.amount,
            currency=body.currency,
            amount_bdt=body.amount_bdt if body.amount_bdt is not None else body.amount,
            description=body.description,
            payment_method_id=body.payment_method_id,
            logged_by_user_id=user_id,
            for_member_id=body.for_member_id,
            notes=body.notes,
            client_uuid=body.client_uuid,
        )
        .on_conflict_do_nothing(index_elements=["client_uuid"])
        .returning(Expense.id)
    )
    inserted_id = (await db.execute(stmt)).scalar_one_or_none()
    await db.commit()

    if inserted_id is not None:
        return await _get_out(db, household_id, inserted_id), True

    # Replay: fetch the row this client_uuid already created.
    existing = (
        await db.execute(
            _base_query(household_id).where(Expense.client_uuid == body.client_uuid)
        )
    ).first()
    if existing is None:
        # client_uuid exists but under another household - do not leak it.
        raise NotFoundError("Expense not found")
    return _row_to_out(existing), False


async def list_expenses(
    db: AsyncSession,
    household_id: uuid.UUID,
    date_from: date_type | None = None,
    date_to: date_type | None = None,
    category_id: uuid.UUID | None = None,
    member_id: uuid.UUID | None = None,
    payment_method_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> ExpenseListOut:
    query = _base_query(household_id)
    count_query = select(func.count()).select_from(Expense).where(
        Expense.household_id == household_id
    )

    filters = []
    if date_from is not None:
        filters.append(Expense.date >= date_from)
    if date_to is not None:
        filters.append(Expense.date <= date_to)
    if category_id is not None:
        # A parent category matches itself and all its subcategories.
        sub_ids = select(Category.id).where(Category.parent_id == category_id)
        filters.append(Expense.category_id.in_(sub_ids.union(select(text(f"'{category_id}'::uuid")))))
    if member_id is not None:
        filters.append(Expense.for_member_id == member_id)
    if payment_method_id is not None:
        filters.append(Expense.payment_method_id == payment_method_id)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    query = query.order_by(Expense.date.desc(), Expense.created_at.desc()).limit(limit).offset(offset)
    rows = (await db.execute(query)).all()
    total = (await db.execute(count_query)).scalar_one()
    return ExpenseListOut(items=[_row_to_out(r) for r in rows], total=total)


async def patch(
    db: AsyncSession, household_id: uuid.UUID, expense_id: uuid.UUID, body: ExpensePatch
) -> ExpenseOut:
    expense = await db.get(Expense, expense_id)
    if expense is None or expense.household_id != household_id:
        raise NotFoundError("Expense not found")
    if body.category_id is not None:
        category = await db.get(Category, body.category_id)
        if category is None or category.household_id != household_id:
            raise NotFoundError("Category not found")
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(expense, field, value)
    if "amount" in data and expense.currency == "BDT":
        expense.amount_bdt = expense.amount
    await db.commit()
    return await _get_out(db, household_id, expense_id)


async def delete(db: AsyncSession, household_id: uuid.UUID, expense_id: uuid.UUID) -> None:
    expense = await db.get(Expense, expense_id)
    if expense is None or expense.household_id != household_id:
        raise NotFoundError("Expense not found")
    await db.delete(expense)
    await db.commit()


# Time-of-day buckets for the quick-add ranking (local intent, hour of entry).
def _bucket(hour: int) -> str:
    if 5 <= hour < 11:
        return "morning"
    if 11 <= hour < 16:
        return "midday"
    if 16 <= hour < 21:
        return "evening"
    return "night"


async def recent(
    db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID, now_hour: int
) -> RecentOut:
    last_row = (
        await db.execute(
            _base_query(household_id)
            .where(Expense.logged_by_user_id == user_id)
            .order_by(Expense.created_at.desc())
            .limit(1)
        )
    ).first()

    # Rank subcategories by this household's usage in the current time-of-day
    # bucket over the last 90 days; overall count breaks ties.
    bucket = _bucket(now_hour)
    bucket_ranges = {
        "morning": (5, 11),
        "midday": (11, 16),
        "evening": (16, 21),
    }
    since = datetime.now(timezone.utc) - timedelta(days=90)
    if bucket in bucket_ranges:
        lo, hi = bucket_ranges[bucket]
        bucket_cond = f"EXTRACT(hour FROM e.created_at) >= {lo} AND EXTRACT(hour FROM e.created_at) < {hi}"
    else:  # night wraps midnight
        bucket_cond = "(EXTRACT(hour FROM e.created_at) >= 21 OR EXTRACT(hour FROM e.created_at) < 5)"

    ranking_sql = text(
        f"""
        SELECT e.category_id,
               COUNT(*) FILTER (WHERE {bucket_cond}) AS bucket_count,
               COUNT(*) AS total_count
        FROM expense e
        WHERE e.household_id = :household_id AND e.created_at >= :since
        GROUP BY e.category_id
        ORDER BY bucket_count DESC, total_count DESC
        LIMIT 12
        """
    )
    rows = (
        await db.execute(ranking_sql, {"household_id": household_id, "since": since})
    ).all()

    return RecentOut(
        last=_row_to_out(last_row) if last_row else None,
        category_ranking=[r.category_id for r in rows],
    )


async def description_suggestions(
    db: AsyncSession,
    household_id: uuid.UUID,
    category_id: uuid.UUID | None = None,
    limit: int = 100,
) -> list[SuggestionOut]:
    """Distinct past descriptions, most-used first, recency breaking ties.

    Derived from the expense history itself - no separate suggestion store
    to maintain or drift. Case-insensitive grouping keeps "Bazar" and
    "bazar" as one suggestion (the most recent spelling wins). With
    category_id, narrowed to that category (a parent includes its subs);
    without it, household-wide - each row still carries its category so the
    UI can preselect it.
    """
    category_cond = ""
    params: dict = {"household_id": household_id, "limit": limit}
    if category_id is not None:
        category_cond = (
            "AND (e.category_id = :category_id OR c.parent_id = :category_id)"
        )
        params["category_id"] = category_id

    rows = (
        await db.execute(
            text(f"""
                SELECT DISTINCT ON (lower(trim(e.description)))
                    first_value(trim(e.description)) OVER w AS description,
                    first_value(e.category_id) OVER w AS category_id,
                    COUNT(*) OVER (PARTITION BY lower(trim(e.description))) AS count,
                    MAX(e.date) OVER (PARTITION BY lower(trim(e.description))) AS last_used
                FROM expense e
                JOIN category c ON c.id = e.category_id
                WHERE e.household_id = :household_id
                  AND e.description IS NOT NULL AND trim(e.description) != ''
                  {category_cond}
                WINDOW w AS (
                    PARTITION BY lower(trim(e.description))
                    ORDER BY e.date DESC, e.created_at DESC
                )
                ORDER BY lower(trim(e.description)), count DESC
            """),
            params,
        )
    ).all()
    # count DESC, recency DESC
    ranked = sorted(rows, key=lambda r: (-int(r.count), -r.last_used.toordinal()))
    return [
        SuggestionOut(
            description=r.description,
            category_id=r.category_id,
            count=int(r.count),
            last_used=r.last_used,
        )
        for r in ranked[:limit]
    ]
