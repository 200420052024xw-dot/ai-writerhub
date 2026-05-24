import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field
from typing import AsyncGenerator

from app.core.config import get_settings


class RuntimeModelConfig(BaseModel):
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)


async def call_chat_model(system_prompt: str, user_prompt: str, model_config: RuntimeModelConfig | None = None) -> str:
    settings = get_settings()
    api_key = model_config.api_key if model_config else settings.ai_api_key
    base_url = model_config.base_url if model_config else settings.ai_base_url
    model = model_config.model if model_config else settings.ai_default_model
    timeout_seconds = settings.ai_timeout_seconds

    if not api_key.strip():
        raise HTTPException(status_code=400, detail="AI_API_KEY is not configured in backend/.env")

    url = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Model provider returned {exc.response.status_code}: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Model provider request failed: {exc}") from exc

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="Model provider returned an unexpected response shape") from exc


async def test_chat_model(model_config: RuntimeModelConfig) -> None:
    await call_chat_model("只回复 pong。", "ping", model_config)


async def stream_chat_model(
    messages: list[dict[str, str]],
    model_config: RuntimeModelConfig,
) -> AsyncGenerator[bytes, None]:
    url = f"{model_config.base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model_config.model,
        "stream": True,
        "messages": messages,
    }
    headers = {
        "Authorization": f"Bearer {model_config.api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes():
                if chunk:
                    yield chunk


async def call_vision_model(image_url: str, prompt: str, model_config: RuntimeModelConfig) -> str:
    url = f"{model_config.base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model_config.model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "temperature": 0.1,
    }
    headers = {
        "Authorization": f"Bearer {model_config.api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Vision model returned {exc.response.status_code}: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Vision model request failed: {exc}") from exc

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="Vision model returned an unexpected response shape") from exc
