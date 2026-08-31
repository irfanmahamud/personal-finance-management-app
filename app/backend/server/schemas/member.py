import uuid

from pydantic import BaseModel


class MemberOut(BaseModel):
    id: uuid.UUID
    name: str
    name_bn: str | None
    relation: str | None
    active: bool

    model_config = {"from_attributes": True}
