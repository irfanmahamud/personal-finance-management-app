from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Cookie, Header, Request, Response

from server.core.errors import AuthError
from server.core.ratelimit import check_rate_limit

from server.core.config import get_settings
from server.core.deps import ActiveUser, DbSession
from server.schemas.auth import (
    DeleteAccountIn,
    LoginIn,
    PinSetIn,
    PinStatusOut,
    PinVerifyIn,
    RefreshIn,
    SignupIn,
    TokenOut,
)
from server.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
# Path-scoped so the cookie is only ever sent to the refresh/logout endpoints.
REFRESH_PATH = "/api/v1/auth"


def _client_key(request: Request, identity: str) -> str:
    """ip + identity: throttles one attacker without locking a whole NAT out
    of their own accounts, and one target account without needing the ip."""
    ip = request.client.host if request.client else "unknown"
    return f"{ip}:{identity.lower()}"

# A native client has no dependable cookie jar, so it opts into carrying the
# refresh token itself: it sends this header on login/signup to get the token
# in the response body, and sends it back in the request body on
# refresh/logout. Purely additive - a browser sends neither, and keeps the
# httpOnly cookie path unchanged.
TOKEN_TRANSPORT_HEADER = "X-Token-Transport"
BODY_TRANSPORT = "body"

TokenTransport = Annotated[str | None, Header(alias=TOKEN_TRANSPORT_HEADER)]


def _wants_body_transport(transport: str | None) -> bool:
    return (transport or "").lower() == BODY_TRANSPORT


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


@router.post("/signup", response_model=TokenOut, status_code=201)
async def signup(
    body: SignupIn,
    request: Request,
    response: Response,
    db: DbSession,
    x_token_transport: TokenTransport = None,
) -> TokenOut:
    check_rate_limit("signup", _client_key(request, body.email))
    access, refresh_plain, expires, _user = await auth_service.signup(
        db, body.email, body.password, body.household_name
    )
    max_age = int((expires - datetime.now(timezone.utc)).total_seconds())
    _set_refresh_cookie(response, refresh_plain, max_age)
    return TokenOut(
        access_token=access,
        refresh_token=refresh_plain if _wants_body_transport(x_token_transport) else None,
    )


@router.post("/login", response_model=TokenOut)
async def login(
    body: LoginIn,
    request: Request,
    response: Response,
    db: DbSession,
    x_token_transport: TokenTransport = None,
) -> TokenOut:
    check_rate_limit("login", _client_key(request, body.email))
    access, refresh_plain, expires, _user = await auth_service.login(
        db, body.email, body.password
    )
    max_age = int((expires - datetime.now(timezone.utc)).total_seconds())
    _set_refresh_cookie(response, refresh_plain, max_age)
    return TokenOut(
        access_token=access,
        refresh_token=refresh_plain if _wants_body_transport(x_token_transport) else None,
    )


@router.post("/refresh", response_model=TokenOut)
async def refresh(
    request: Request,
    response: Response,
    db: DbSession,
    body: RefreshIn | None = None,
    refresh_token: Annotated[str | None, Cookie()] = None,
    x_token_transport: TokenTransport = None,
) -> TokenOut:
    # Body takes precedence over the cookie: a native client always sends it,
    # and nothing else can be carrying a stale one.
    presented = (body.refresh_token if body else None) or refresh_token
    if presented is None:
        raise AuthError("No refresh token")
    check_rate_limit("refresh", _client_key(request, ""))
    access, new_plain, expires = await auth_service.refresh(db, presented)
    max_age = int((expires - datetime.now(timezone.utc)).total_seconds())
    _set_refresh_cookie(response, new_plain, max_age)
    return TokenOut(
        access_token=access,
        refresh_token=new_plain if _wants_body_transport(x_token_transport) else None,
    )


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    db: DbSession,
    body: RefreshIn | None = None,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> None:
    await auth_service.logout(db, (body.refresh_token if body else None) or refresh_token)
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


@router.delete("/account", status_code=204)
async def delete_account(
    body: DeleteAccountIn, response: Response, db: DbSession, user: ActiveUser
) -> None:
    await auth_service.delete_account(db, user.user_id, user.household_id, body.password)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)
