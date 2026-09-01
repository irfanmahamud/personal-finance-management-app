import uuid
from datetime import datetime

from pydantic import BaseModel


class ReceiptOut(BaseModel):
    id: uuid.UUID
    mime_type: str
    size_bytes: int
    created_at: datetime
