import uuid

from fastapi import APIRouter, UploadFile
from fastapi.responses import Response

from server.core.deps import ActiveUser, DbSession
from server.schemas.receipt import ReceiptOut
from server.services import receipts as service

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post("", response_model=ReceiptOut, status_code=201)
async def upload_receipt(file: UploadFile, db: DbSession, user: ActiveUser) -> ReceiptOut:
    data = await file.read()
    return await service.upload(db, user.household_id, user.user_id, file.content_type or "", data)


@router.get("/{receipt_id}")
async def get_receipt(receipt_id: uuid.UUID, db: DbSession, user: ActiveUser) -> Response:
    receipt = await service.get_owned(db, user.household_id, receipt_id)
    return Response(content=receipt.data, media_type=receipt.mime_type)


@router.delete("/{receipt_id}", status_code=204)
async def delete_receipt(receipt_id: uuid.UUID, db: DbSession, user: ActiveUser) -> None:
    await service.delete(db, user.household_id, receipt_id)
