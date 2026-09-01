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


class PinVerifyIn(BaseModel):
    pin: str = Field(pattern=r"^\d{6}$")


class PinSetIn(BaseModel):
    password: str = Field(min_length=1)  # re-confirm identity to change the PIN
    pin: str = Field(pattern=r"^\d{6}$")


class PinStatusOut(BaseModel):
    ok: bool
