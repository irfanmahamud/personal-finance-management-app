import uuid

from fastapi import APIRouter

from server.core.deps import ActiveUser, DbSession
from server.schemas.category import (
    CategoryCreate,
    CategoryOut,
    CategoryPatch,
    CategoryTreeOut,
    PaymentMethodCreate,
    PaymentMethodOut,
)
from server.services import categories as service

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[CategoryTreeOut])
async def list_categories(
    db: DbSession, user: ActiveUser, include_archived: bool = False
) -> list[CategoryTreeOut]:
    return await service.get_tree(db, user.household_id, include_archived)


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def create_category(
    body: CategoryCreate, db: DbSession, user: ActiveUser
) -> CategoryOut:
    return await service.create(db, user.household_id, body)


@router.patch("/categories/{category_id}", response_model=CategoryOut)
async def patch_category(
    category_id: uuid.UUID, body: CategoryPatch, db: DbSession, user: ActiveUser
) -> CategoryOut:
    return await service.patch(db, user.household_id, category_id, body)


@router.get("/payment-methods", response_model=list[PaymentMethodOut])
async def list_payment_methods(db: DbSession, user: ActiveUser) -> list[PaymentMethodOut]:
    return await service.list_payment_methods(db, user.household_id)


@router.post("/payment-methods", response_model=PaymentMethodOut, status_code=201)
async def create_payment_method(
    body: PaymentMethodCreate, db: DbSession, user: ActiveUser
) -> PaymentMethodOut:
    return await service.create_payment_method(db, user.household_id, body)
