import json
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


router = APIRouter()


class AssistantMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AssistantChatRequest(BaseModel):
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)
    messages: list[AssistantMessage]


@router.post("/assistant/chat")
async def stream_assistant_chat(payload: AssistantChatRequest) -> StreamingResponse:
    url = f"{payload.base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {payload.api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": payload.model,
        "stream": True,
        "messages": [
            {
                "role": "system",
                "content": "你是文枢助手，帮助用户围绕写作、编辑、创作和头脑风暴展开对话。回答简洁、具体，优先给可执行建议。",
            },
            *[message.model_dump() for message in payload.messages],
        ],
    }

    async def event_stream():
        def error_event(message: str) -> bytes:
            data = {"choices": [{"delta": {"content": message}}]}
            return f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")

        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", url, headers=headers, json=body) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        if chunk:
                            yield chunk
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text or str(exc)
            yield error_event(f"模型请求失败：{detail}")
            yield b"data: [DONE]\n\n"
        except httpx.HTTPError as exc:
            yield error_event(f"模型连接失败：{exc}")
            yield b"data: [DONE]\n\n"

    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    return StreamingResponse(event_stream(), media_type="text/event-stream")
