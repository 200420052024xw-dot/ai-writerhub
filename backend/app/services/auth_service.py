import hashlib
import re
import secrets
import time
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.database import _ConnectionCtx, mysql_datetime, parse_database_datetime
from app.schemas.auth import UserResponse


SESSION_TTL = timedelta(days=7)
SESSION_CACHE_TTL = 30  # seconds
USERNAME_PATTERN = re.compile(r"^[\u3400-\u9fffA-Za-z0-9_]{3,24}$")
_password_hasher = PasswordHasher()
_current_user_id: ContextVar[str | None] = ContextVar("current_user_id", default=None)
_current_session_hash: ContextVar[str | None] = ContextVar("current_session_hash", default=None)

# token_hash -> (timestamp, UserResponse)
_session_cache: dict[str, tuple[float, UserResponse]] = {}


def connect():
    return _ConnectionCtx()


def normalize_username(username: str) -> str:
    return username.strip().casefold()


def validate_username(username: str) -> str:
    value = username.strip()
    if not USERNAME_PATTERN.fullmatch(value):
        raise HTTPException(status_code=422, detail="用户名需为 3-24 位中文、字母、数字或下划线")
    return value


def validate_nickname(nickname: str) -> str:
    value = nickname.strip()
    if not 1 <= len(value) <= 32:
        raise HTTPException(status_code=422, detail="昵称需为 1-32 个字符")
    return value


def validate_password(password: str) -> str:
    if not 8 <= len(password) <= 72:
        raise HTTPException(status_code=422, detail="密码需为 8-72 个字符")
    return password


def user_from_row(row) -> UserResponse:
    return UserResponse(id=row["id"], username=row["username"], nickname=row["nickname"], email=row.get("email"))


def create_user(username: str, nickname: str, password: str, email: str | None = None) -> UserResponse:
    username = validate_username(username)
    nickname = validate_nickname(nickname)
    validate_password(password)
    user_id = uuid.uuid4().hex
    timestamp = mysql_datetime()
    try:
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO users
                (id, username, username_normalized, nickname, email, password_hash, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    username,
                    normalize_username(username),
                    nickname,
                    email,
                    _password_hasher.hash(password),
                    timestamp,
                    timestamp,
                ),
            )
    except Exception as exc:
        if getattr(exc, "args", [None])[0] == 1062:
            raise HTTPException(status_code=409, detail="用户名已存在") from exc
        raise
    return UserResponse(id=user_id, username=username, nickname=nickname, email=email)


def authenticate_user(username: str, password: str) -> UserResponse:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username_normalized = %s",
            (normalize_username(username),),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="账号或密码错误")
    try:
        _password_hasher.verify(row["password_hash"], password)
    except (VerifyMismatchError, InvalidHashError):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    return user_from_row(row)


def create_session(user_id: str) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(UTC) + SESSION_TTL
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO user_sessions (token_hash, user_id, expires_at, created_at)
            VALUES (%s, %s, %s, %s)
            """,
            (token_hash, user_id, mysql_datetime(expires_at), mysql_datetime()),
        )
    return token, expires_at


def _invalidate_session_cache(token_hash: str | None = None, user_id: str | None = None) -> None:
    """清除会话缓存。指定 token_hash 清单条，指定 user_id 清该用户所有会话。"""
    if token_hash:
        _session_cache.pop(token_hash, None)
    elif user_id:
        to_remove = [k for k, (_, u) in _session_cache.items() if u.id == user_id]
        for k in to_remove:
            _session_cache.pop(k, None)
    else:
        _session_cache.clear()


def resolve_session(token: str | None) -> tuple[UserResponse, str] | None:
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # 检查缓存
    cached = _session_cache.get(token_hash)
    if cached and (time.monotonic() - cached[0]) < SESSION_CACHE_TTL:
        return cached[1], token_hash

    with connect() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.username, u.nickname, u.email, s.expires_at
            FROM user_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = %s
            """,
            (token_hash,),
        ).fetchone()
        if not row:
            return None
        if parse_database_datetime(row["expires_at"]) <= datetime.now(UTC):
            conn.execute("DELETE FROM user_sessions WHERE token_hash = %s", (token_hash,))
            return None
    user = user_from_row(row)
    _session_cache[token_hash] = (time.monotonic(), user)
    return user, token_hash


def set_request_auth(user_id: str, session_hash: str):
    return _current_user_id.set(user_id), _current_session_hash.set(session_hash)


def reset_request_auth(tokens) -> None:
    user_token, session_token = tokens
    _current_user_id.reset(user_token)
    _current_session_hash.reset(session_token)


def current_user_id() -> str:
    user_id = _current_user_id.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    return user_id


def current_session_hash() -> str:
    session_hash = _current_session_hash.get()
    if not session_hash:
        raise HTTPException(status_code=401, detail="未登录")
    return session_hash


def get_current_user() -> UserResponse:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, nickname, email FROM users WHERE id = %s",
            (current_user_id(),),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="未登录")
    return user_from_row(row)


def delete_session(session_hash: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM user_sessions WHERE token_hash = %s", (session_hash,))
    _invalidate_session_cache(token_hash=session_hash)


def update_nickname(nickname: str) -> UserResponse:
    nickname = validate_nickname(nickname)
    user_id = current_user_id()
    with connect() as conn:
        conn.execute(
            "UPDATE users SET nickname = %s, updated_at = %s WHERE id = %s",
            (nickname, mysql_datetime(), user_id),
        )
    return get_current_user()


def update_password(old_password: str, new_password: str) -> None:
    validate_password(new_password)
    user_id = current_user_id()
    with connect() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,)).fetchone()
        try:
            _password_hasher.verify(row["password_hash"], old_password)
        except (TypeError, VerifyMismatchError, InvalidHashError):
            raise HTTPException(status_code=400, detail="旧密码错误")
        conn.execute(
            "UPDATE users SET password_hash = %s, updated_at = %s WHERE id = %s",
            (_password_hasher.hash(new_password), mysql_datetime(), user_id),
        )
        conn.execute(
            "DELETE FROM user_sessions WHERE user_id = %s AND token_hash <> %s",
            (user_id, current_session_hash()),
        )
        _invalidate_session_cache(user_id=user_id)


def reset_password_by_email(username: str, email: str, new_password: str) -> None:
    validate_password(new_password)
    with connect() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE username_normalized = %s AND email = %s",
            (normalize_username(username), email),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="用户名或邮箱不匹配")
        user_id = row["id"]
        conn.execute(
            "UPDATE users SET password_hash = %s, updated_at = %s WHERE id = %s",
            (_password_hasher.hash(new_password), mysql_datetime(), user_id),
        )
        conn.execute("DELETE FROM user_sessions WHERE user_id = %s", (user_id,))
        _invalidate_session_cache(user_id=user_id)


def cookie_options(expires_at: datetime) -> dict:
    settings = get_settings()
    return {
        "key": settings.session_cookie_name,
        "httponly": True,
        "samesite": "lax",
        "secure": settings.session_secure_cookie,
        "expires": expires_at,
        "max_age": int(SESSION_TTL.total_seconds()),
        "path": "/",
    }
