import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import DomainValidationError, NotFoundError
from server.db.models import Category, PaymentMethod
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
