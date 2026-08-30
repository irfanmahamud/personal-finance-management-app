from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Cookie, Response

from server.core.errors import AuthError

from server.core.config import get_settings
from server.core.deps import ActiveUser, DbSession
from server.schemas.auth import LoginIn, PinSetIn, PinStatusOut, PinVerifyIn, TokenOut
from server.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
# Path-scoped so the cookie is only ever sent to the refresh/logout endpoints.
REFRESH_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_secure,
        path=REFRESH_PATH,
    )


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, response: Response, db: DbSession) -> TokenOut:
    access, refresh_plain, expires, _user = await auth_service.login(
        db, body.email, body.password
    )
    max_age = int((expires - datetime.now(timezone.utc)).total_seconds())
    _set_refresh_cookie(response, refresh_plain, max_age)
    return TokenOut(access_token=access)


@router.post("/refresh", response_model=TokenOut)
async def refresh(
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> TokenOut:
    if refresh_token is None:
        raise AuthError("No refresh token")
    access, new_plain, expires = await auth_service.refresh(db, refresh_token)
    max_age = int((expires - datetime.now(timezone.utc)).total_seconds())
    _set_refresh_cookie(response, new_plain, max_age)
    return TokenOut(access_token=access)


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> None:
    await auth_service.logout(db, refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)


@router.post("/pin/verify", response_model=PinStatusOut)
async def verify_pin(
    body: PinVerifyIn, db: DbSession, user: ActiveUser
) -> PinStatusOut:
    ok = await auth_service.verify_pin(db, user.user_id, body.pin)
    return PinStatusOut(ok=ok)


@router.put("/pin", response_model=PinStatusOut)
async def set_pin(body: PinSetIn, db: DbSession, user: ActiveUser) -> PinStatusOut:
    await auth_service.set_pin(db, user.user_id, body.password, body.pin)
    return PinStatusOut(ok=True)
