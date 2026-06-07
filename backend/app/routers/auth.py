from fastapi import APIRouter, Response

from app.core.config import get_settings
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    PasswordUpdateRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    cookie_options,
    create_session,
    create_user,
    current_session_hash,
    delete_session,
    get_current_user,
    reset_password_by_email,
    update_nickname,
    update_password,
)


router = APIRouter()


def set_session_cookie(response: Response, user_id: str) -> None:
    token, expires_at = create_session(user_id)
    response.set_cookie(value=token, **cookie_options(expires_at))


@router.post("/auth/register", response_model=UserResponse)
async def register(payload: RegisterRequest, response: Response) -> UserResponse:
    user = create_user(payload.username, payload.nickname, payload.password, payload.email)
    set_session_cookie(response, user.id)
    return user


@router.post("/auth/login", response_model=UserResponse)
async def login(payload: LoginRequest, response: Response) -> UserResponse:
    user = authenticate_user(payload.username, payload.password)
    set_session_cookie(response, user.id)
    return user


@router.post("/auth/logout")
async def logout(response: Response) -> dict[str, bool]:
    delete_session(current_session_hash())
    response.delete_cookie(get_settings().session_cookie_name, path="/")
    return {"ok": True}


@router.get("/auth/me", response_model=UserResponse)
async def me() -> UserResponse:
    return get_current_user()


@router.patch("/account/profile", response_model=UserResponse)
async def profile(payload: ProfileUpdateRequest) -> UserResponse:
    return update_nickname(payload.nickname)


@router.post("/account/password")
async def password(payload: PasswordUpdateRequest) -> dict[str, bool]:
    update_password(payload.old_password, payload.new_password)
    return {"ok": True}


@router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest) -> dict[str, bool]:
    reset_password_by_email(payload.username, payload.email, payload.new_password)
    return {"ok": True}
