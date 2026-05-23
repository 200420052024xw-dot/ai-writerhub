from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter()


class AiRuntimeConfigResponse(BaseModel):
    provider: str
    base_url: str
    default_model: str
    timeout_seconds: int
    has_api_key: bool


@router.get("/config/ai", response_model=AiRuntimeConfigResponse)
async def get_ai_runtime_config() -> AiRuntimeConfigResponse:
    settings = get_settings()
    return AiRuntimeConfigResponse(
        provider=settings.ai_provider,
        base_url=settings.ai_base_url,
        default_model=settings.ai_default_model,
        timeout_seconds=settings.ai_timeout_seconds,
        has_api_key=settings.has_ai_key,
    )
