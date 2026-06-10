from pydantic import BaseModel


class AdminUserItem(BaseModel):
    id: str
    username: str
    nickname: str
    email: str | None = None
    role: str
    is_member: bool
    created_at: str


class AdminUserListResponse(BaseModel):
    users: list[AdminUserItem]


class RoleUpdateRequest(BaseModel):
    role: str


class MemberUpdateRequest(BaseModel):
    is_member: bool


class SystemSettingsResponse(BaseModel):
    settings: dict[str, str]


class SystemSettingsUpdateRequest(BaseModel):
    settings: dict[str, str]


class SystemModelTestRequest(BaseModel):
    api_key: str
    base_url: str
    model: str


class SystemModelConfigResponse(BaseModel):
    provider: str = ""
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    vision_model: str = ""
    rag_embedding_source: str = "local"
    rag_api_key: str = ""
    rag_base_url: str = ""
    rag_model: str = ""
    rag_enable_rerank: bool = False
    rag_rerank_model_path: str = ""
