from fastapi import HTTPException

from app.core.database import _ConnectionCtx, mysql_datetime
from app.schemas.admin import AdminUserItem, SystemModelConfigResponse
from app.services.auth_service import connect, current_user_id


def require_admin() -> None:
    """Raise 403 if the current user is not an admin."""
    with connect() as conn:
        row = conn.execute(
            "SELECT role FROM users WHERE id = %s",
            (current_user_id(),),
        ).fetchone()
    if not row or row["role"] != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")


def list_users() -> list[AdminUserItem]:
    require_admin()
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, username, nickname, email, role, is_member, created_at FROM users ORDER BY created_at DESC"
        ).fetchall()
    return [
        AdminUserItem(
            id=r["id"],
            username=r["username"],
            nickname=r["nickname"],
            email=r.get("email"),
            role=r["role"],
            is_member=bool(r["is_member"]),
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


def update_user_role(user_id: str, role: str) -> None:
    require_admin()
    if role not in ("user", "admin"):
        raise HTTPException(status_code=422, detail="角色必须为 user 或 admin")
    if user_id == current_user_id():
        raise HTTPException(status_code=400, detail="不能修改自己的角色")
    with connect() as conn:
        result = conn.execute(
            "UPDATE users SET role = %s, updated_at = %s WHERE id = %s",
            (role, mysql_datetime(), user_id),
        )
        if result._cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="用户不存在")


def update_user_member(user_id: str, is_member: bool) -> None:
    require_admin()
    with connect() as conn:
        result = conn.execute(
            "UPDATE users SET is_member = %s, updated_at = %s WHERE id = %s",
            (1 if is_member else 0, mysql_datetime(), user_id),
        )
        if result._cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="用户不存在")


def delete_user(user_id: str) -> None:
    require_admin()
    if user_id == current_user_id():
        raise HTTPException(status_code=400, detail="不能删除自己")
    with connect() as conn:
        # 先删关联数据
        conn.execute("DELETE FROM rag_chunks WHERE document_id IN (SELECT id FROM documents WHERE user_id = %s)", (user_id,))
        conn.execute("DELETE FROM document_translation_versions WHERE document_id IN (SELECT id FROM documents WHERE user_id = %s)", (user_id,))
        conn.execute("DELETE FROM translation_jobs WHERE document_id IN (SELECT id FROM documents WHERE user_id = %s)", (user_id,))
        conn.execute("DELETE FROM document_assistant_messages WHERE document_id IN (SELECT id FROM documents WHERE user_id = %s)", (user_id,))
        conn.execute("DELETE FROM document_paragraphs WHERE document_id IN (SELECT id FROM documents WHERE user_id = %s)", (user_id,))
        conn.execute("DELETE FROM documents WHERE user_id = %s", (user_id,))
        conn.execute("DELETE FROM knowledge_conversations WHERE user_id = %s", (user_id,))
        conn.execute("DELETE FROM user_sessions WHERE user_id = %s", (user_id,))
        result = conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
        if result._cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="用户不存在")


# ── System settings ──

_SYSTEM_SETTING_KEYS = {
    "system_model_provider",
    "system_model_api_key",
    "system_model_base_url",
    "system_model_name",
    "system_model_vision_model",
    "system_rag_embedding_source",
    "system_rag_api_key",
    "system_rag_base_url",
    "system_rag_model",
    "system_rag_enable_rerank",
    "system_rag_rerank_model_path",
}


def get_system_settings() -> dict[str, str]:
    require_admin()
    with connect() as conn:
        rows = conn.execute("SELECT setting_key, setting_value FROM system_settings").fetchall()
    return {r["setting_key"]: r["setting_value"] for r in rows}


def update_system_settings(settings: dict[str, str]) -> None:
    require_admin()
    timestamp = mysql_datetime()
    with connect() as conn:
        for key, value in settings.items():
            if key not in _SYSTEM_SETTING_KEYS:
                continue
            conn.execute(
                """
                INSERT INTO system_settings (setting_key, setting_value, updated_at)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE setting_value = %s, updated_at = %s
                """,
                (key, value, timestamp, value, timestamp),
            )


def get_system_model_config() -> SystemModelConfigResponse:
    """Return system model config for member users (no admin check)."""
    from app.services.auth_service import current_user_id as uid
    with connect() as conn:
        row = conn.execute("SELECT is_member FROM users WHERE id = %s", (uid(),)).fetchone()
        if not row or not row["is_member"]:
            raise HTTPException(status_code=403, detail="需要会员权限")

        rows = conn.execute("SELECT setting_key, setting_value FROM system_settings").fetchall()
    data = {r["setting_key"]: r["setting_value"] for r in rows}
    return SystemModelConfigResponse(
        provider=data.get("system_model_provider", ""),
        api_key="",  # 系统 key 不暴露给前端
        base_url=data.get("system_model_base_url", ""),
        model=data.get("system_model_name", ""),
        vision_model=data.get("system_model_vision_model", ""),
        rag_embedding_source=data.get("system_rag_embedding_source", "local"),
        rag_api_key="",  # 系统 key 不暴露给前端
        rag_base_url=data.get("system_rag_base_url", ""),
        rag_model=data.get("system_rag_model", ""),
        rag_enable_rerank=data.get("system_rag_enable_rerank", "0") == "1",
        rag_rerank_model_path=data.get("system_rag_rerank_model_path", ""),
    )
