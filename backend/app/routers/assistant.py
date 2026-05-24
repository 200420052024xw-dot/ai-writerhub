from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.assistant import AssistantChatRequest
from app.services.assistant_service import stream_assistant_reply
from app.services.llm_client import RuntimeModelConfig


router = APIRouter()


@router.post("/assistant/chat")
async def stream_assistant_chat(payload: AssistantChatRequest) -> StreamingResponse:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    return StreamingResponse(
        stream_assistant_reply(
            payload.messages,
            RuntimeModelConfig(
                api_key=payload.api_key,
                base_url=payload.base_url,
                model=payload.model,
            ),
        ),
        media_type="text/event-stream",
    )
