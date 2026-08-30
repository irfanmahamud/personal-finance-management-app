"""Password/PIN hashing and JWT issuance.

Token model (see plan §Auth):
- Access token: short-lived JWT carried in memory by the SPA, sent as a
  Bearer header. Claims: sub (user id), hh (household id), type="access".
- Refresh token: opaque random string in an httpOnly cookie path-scoped to
  the refresh endpoint. Only its sha256 lands in the database, so a DB read
  never yields a usable token.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from server.core.config import get_settings

_hasher = PasswordHasher()


def hash_secret(plain: str) -> str:
    return _hasher.hash(plain)


def verify_secret(hashed: str, plain: str) -> bool:
    try:
        return _hasher.verify(hashed, plain)
    except VerifyMismatchError:
        return False


def create_access_token(user_id: uuid.UUID, household_id: uuid.UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "hh": str(household_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def new_refresh_token() -> tuple[str, str, datetime]:
    """Return (plain token for the cookie, sha256 hex for the DB, expiry)."""
    plain = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(plain.encode()).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(
        days=get_settings().refresh_token_ttl_days
    )
    return plain, token_hash, expires


def hash_refresh_token(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()
