"""Receipt photo upload - storage only, no OCR (spec §3.4 "Files" note).
Stored as Postgres bytea rather than S3/Supabase Storage: no bucket to
provision for a dev setup, and the household's receipt volume is small.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from server.core.errors import DomainValidationError, NotFoundError
from server.db.models import Receipt
from server.schemas.receipt import ReceiptOut

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 8 * 1024 * 1024  # 8MB


def _to_out(receipt: Receipt) -> ReceiptOut:
    return ReceiptOut(
        id=receipt.id,
        mime_type=receipt.mime_type,
        size_bytes=receipt.size_bytes,
        created_at=receipt.created_at,
    )


async def upload(
    db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID, mime_type: str, data: bytes
) -> ReceiptOut:
    if mime_type not in ALLOWED_MIME_TYPES:
        raise DomainValidationError("Only JPEG, PNG, or WEBP receipt photos are supported")
    if len(data) == 0:
        raise DomainValidationError("Empty file")
    if len(data) > MAX_SIZE_BYTES:
        raise DomainValidationError("Receipt photo is too large (max 8MB)")

    receipt = Receipt(
        household_id=household_id,
        mime_type=mime_type,
        data=data,
        size_bytes=len(data),
        uploaded_by_user_id=user_id,
    )
    db.add(receipt)
    await db.commit()
    await db.refresh(receipt)
    return _to_out(receipt)


async def get_owned(db: AsyncSession, household_id: uuid.UUID, receipt_id: uuid.UUID) -> Receipt:
    receipt = await db.get(Receipt, receipt_id)
    if receipt is None or receipt.household_id != household_id:
        raise NotFoundError("Receipt not found")
    return receipt


async def delete(db: AsyncSession, household_id: uuid.UUID, receipt_id: uuid.UUID) -> None:
    receipt = await get_owned(db, household_id, receipt_id)
    await db.delete(receipt)
    await db.commit()
