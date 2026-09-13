import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import DomainValidationError, NotFoundError
from server.db.models import BudgetLine, Category, Expense, PaymentMethod, RecurringRule
from server.schemas.category import (
    CategoryCreate,
    CategoryOut,
    CategoryPatch,
    CategoryTreeOut,
    PaymentMethodCreate,
)


async def get_tree(
    db: AsyncSession, household_id: uuid.UUID, include_archived: bool = False
) -> list[CategoryTreeOut]:
    stmt = (
        select(Category)
        .where(Category.household_id == household_id)
        .order_by(Category.sort_order, Category.name_en)
    )
    if not include_archived:
        stmt = stmt.where(Category.archived.is_(False))
    rows = (await db.execute(stmt)).scalars().all()

    parents = [CategoryTreeOut.model_validate(c) for c in rows if c.parent_id is None]
    by_id = {p.id: p for p in parents}
    for c in rows:
        if c.parent_id is not None and c.parent_id in by_id:
            by_id[c.parent_id].children.append(CategoryOut.model_validate(c))
    return parents


async def create(
    db: AsyncSession, household_id: uuid.UUID, body: CategoryCreate
) -> Category:
    if body.parent_id is not None:
        parent = await db.get(Category, body.parent_id)
        if parent is None or parent.household_id != household_id:
            raise NotFoundError("Parent category not found")
        if parent.parent_id is not None:
            # Two levels only in v1 (spec §3.3.2).
            raise DomainValidationError("Categories can only be nested one level deep")

    max_sort = (
        await db.execute(
            select(func.coalesce(func.max(Category.sort_order), -1)).where(
                Category.household_id == household_id,
                Category.parent_id.is_(body.parent_id)
                if body.parent_id is None
                else Category.parent_id == body.parent_id,
            )
        )
    ).scalar_one()

    category = Category(
        household_id=household_id,
        parent_id=body.parent_id,
        name_en=body.name_en,
        name_bn=body.name_bn,
        icon=body.icon,
        sort_order=max_sort + 1,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def patch(
    db: AsyncSession, household_id: uuid.UUID, category_id: uuid.UUID, body: CategoryPatch
) -> Category:
    category = await db.get(Category, category_id)
    if category is None or category.household_id != household_id:
        raise NotFoundError("Category not found")
    for field in ("name_en", "name_bn", "icon", "sort_order", "archived", "need_want_save"):
        value = getattr(body, field)
        if value is not None:
            setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


async def delete(db: AsyncSession, household_id: uuid.UUID, category_id: uuid.UUID) -> None:
    """Hard-delete a sub-category. Top-level categories are archived, not
    deleted (they may have sub-categories of their own to reassign first) -
    this is deliberately narrower than that. Any expense logged under the
    sub-category has its category_id set to NULL rather than being blocked
    or cascaded away - it shows as "Uncategorized" from then on."""
    category = await db.get(Category, category_id)
    if category is None or category.household_id != household_id:
        raise NotFoundError("Category not found")
    if category.parent_id is None:
        raise DomainValidationError("Only sub-categories can be deleted - archive a top-level category instead")

    # Budget lines and recurring rules hold a required (NOT NULL) FK to a
    # category - unlike Expense, there's no sensible "uncategorized" for
    # either of those, so block the delete with a clear message instead of
    # letting the FK constraint raise a raw IntegrityError.
    in_use_budget = (
        await db.execute(select(BudgetLine.id).where(BudgetLine.category_id == category_id).limit(1))
    ).first()
    if in_use_budget is not None:
        raise DomainValidationError("This category is used in a budget - remove it from the budget first")
    in_use_recurring = (
        await db.execute(select(RecurringRule.id).where(RecurringRule.category_id == category_id).limit(1))
    ).first()
    if in_use_recurring is not None:
        raise DomainValidationError("This category is used by a recurring rule - remove or reassign it first")

    await db.execute(
        update(Expense).where(Expense.category_id == category_id).values(category_id=None)
    )
    await db.delete(category)
    await db.commit()


async def list_payment_methods(
    db: AsyncSession, household_id: uuid.UUID
) -> list[PaymentMethod]:
    return list(
        (
            await db.execute(
                select(PaymentMethod)
                .where(PaymentMethod.household_id == household_id)
                .order_by(PaymentMethod.sort_order)
            )
        )
        .scalars()
        .all()
    )


async def create_payment_method(
    db: AsyncSession, household_id: uuid.UUID, body: PaymentMethodCreate
) -> PaymentMethod:
    max_sort = (
        await db.execute(
            select(func.coalesce(func.max(PaymentMethod.sort_order), -1)).where(
                PaymentMethod.household_id == household_id
            )
        )
    ).scalar_one()
    pm = PaymentMethod(
        household_id=household_id,
        name=body.name,
        name_bn=body.name_bn,
        icon=body.icon,
        sort_order=max_sort + 1,
    )
    db.add(pm)
    await db.commit()
    await db.refresh(pm)
    return pm
