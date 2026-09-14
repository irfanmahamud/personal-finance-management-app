from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    household_name: str = Field(default="Household", min_length=1, max_length=120)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Populated ONLY for clients that ask for header-less transport
    # (X-Token-Transport: body) - i.e. the native app, which has no reliable
    # cookie jar. Browsers never see it: the web client keeps using the
    # httpOnly, path-scoped refresh cookie.
    refresh_token: str | None = None


class RefreshIn(BaseModel):
    """Optional body for /auth/refresh and /auth/logout. A native client
    sends the refresh token here because it stored it itself; the cookie
    remains the fallback, so the web client is unaffected."""

    refresh_token: str | None = None


class PinVerifyIn(BaseModel):
    pin: str = Field(pattern=r"^\d{6}$")


class PinSetIn(BaseModel):
    password: str = Field(min_length=1)  # re-confirm identity to change the PIN
    pin: str = Field(pattern=r"^\d{6}$")


class PinStatusOut(BaseModel):
    ok: bool


class DeleteAccountIn(BaseModel):
    password: str = Field(min_length=1)  # re-confirm identity for an irreversible action
