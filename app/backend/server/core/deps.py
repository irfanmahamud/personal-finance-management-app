"""Shared FastAPI dependencies.

Rule 1 of the backend: household_id comes from the authenticated token,
NEVER from a request body or query string. Every router gets it through
CurrentUser; services take it as an explicit argument.
"""

import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.config import get_settings
from server.core.errors import AuthError
from server.db.session import get_db

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    user_id: uuid.UUID
    household_id: uuid.UUID


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    if credentials is None:
        raise AuthError()
    try:
        payload = jwt.decode(
            credentials.credentials,
            get_settings().jwt_secret,
            algorithms=["HS256"],
        )
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid or expired token") from exc
    if payload.get("type") != "access":
        raise AuthError("Wrong token type")
    return CurrentUser(
        user_id=uuid.UUID(payload["sub"]),
        household_id=uuid.UUID(payload["hh"]),
    )


DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_user)]
