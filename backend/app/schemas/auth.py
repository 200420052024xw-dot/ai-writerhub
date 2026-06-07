import re

from pydantic import BaseModel, Field, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserResponse(BaseModel):
    id: str
    username: str
    nickname: str
    email: str | None = None


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=24)
    nickname: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=8, max_length=72)
    email: str | None = Field(default=None, max_length=191)

    @field_validator("username", "nickname")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if not _EMAIL_RE.match(value):
            raise ValueError("邮箱格式不正确")
        return value


class LoginRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def strip_username(cls, value: str) -> str:
        return value.strip()


class ProfileUpdateRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=32)

    @field_validator("nickname")
    @classmethod
    def strip_nickname(cls, value: str) -> str:
        return value.strip()


class PasswordUpdateRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=72)


class ForgotPasswordRequest(BaseModel):
    username: str
    email: str
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("username")
    @classmethod
    def strip_username(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def strip_email(cls, value: str) -> str:
        return value.strip()
