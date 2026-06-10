from fastapi import APIRouter

from app.schemas.admin import (
    AdminUserListResponse,
    MemberUpdateRequest,
    RoleUpdateRequest,
    SystemModelConfigResponse,
    SystemModelTestRequest,
    SystemSettingsResponse,
    SystemSettingsUpdateRequest,
)
from app.services.admin_service import (
    delete_user,
    get_system_model_config,
    get_system_settings,
    list_users,
    update_system_settings,
    update_user_member,
    update_user_role,
)
from app.services.llm_client import RuntimeModelConfig, test_chat_model

router = APIRouter()


@router.get("/admin/users", response_model=AdminUserListResponse)
async def admin_list_users() -> AdminUserListResponse:
    return AdminUserListResponse(users=list_users())


@router.patch("/admin/users/{user_id}/role")
async def admin_update_role(user_id: str, payload: RoleUpdateRequest) -> dict[str, bool]:
    update_user_role(user_id, payload.role)
    return {"ok": True}


@router.patch("/admin/users/{user_id}/member")
async def admin_update_member(user_id: str, payload: MemberUpdateRequest) -> dict[str, bool]:
    update_user_member(user_id, payload.is_member)
    return {"ok": True}


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str) -> dict[str, bool]:
    delete_user(user_id)
    return {"ok": True}


@router.get("/admin/system-settings", response_model=SystemSettingsResponse)
async def admin_get_settings() -> SystemSettingsResponse:
    return SystemSettingsResponse(settings=get_system_settings())


@router.put("/admin/system-settings")
async def admin_update_settings(payload: SystemSettingsUpdateRequest) -> dict[str, bool]:
    update_system_settings(payload.settings)
    return {"ok": True}


@router.post("/admin/system-settings/test-model")
async def admin_test_model(payload: SystemModelTestRequest) -> dict[str, bool]:
    from app.services.admin_service import require_admin
    require_admin()
    config = RuntimeModelConfig(api_key=payload.api_key, base_url=payload.base_url, model=payload.model)
    await test_chat_model(config)
    return {"ok": True}


@router.get("/system/model-config", response_model=SystemModelConfigResponse)
async def system_model_config() -> SystemModelConfigResponse:
    return get_system_model_config()
