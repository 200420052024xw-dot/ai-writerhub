import json

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field
from typing import AsyncGenerator

class RuntimeModelConfig(BaseModel):
    api_key: str = Field(default="", max_length=2048)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)
    vision_api_key: str | None = None
    vision_base_url: str | None = None
    vision_model: str | None = None
    use_system_model: bool = False


def _get_system_setting(key: str) -> str:
    from app.core.database import _ConnectionCtx
    with _ConnectionCtx() as conn:
        row = conn.execute(
            "SELECT setting_value FROM system_settings WHERE setting_key = %s",
            (key,),
        ).fetchone()
    return row["setting_value"] if row else ""


def _get_system_api_key() -> str:
    """从 system_settings 表读取系统 API Key"""
    return _get_system_setting("system_model_api_key")


def ensure_runtime_model_config(model_config: RuntimeModelConfig | None) -> RuntimeModelConfig:
    if model_config is None:
        raise HTTPException(status_code=400, detail="请先在设置页配置 API Key、Base URL 和模型名称")
    api_key = model_config.api_key.strip()

    # 如果使用系统模型，从数据库读取系统 key（不暴露给前端）
    if model_config.use_system_model or not api_key:
        system_key = _get_system_api_key()
        if system_key:
            api_key = system_key

    model_config = model_config.model_copy(
        update={
            "api_key": api_key,
            "base_url": normalize_base_url(model_config.base_url),
            "model": model_config.model.strip(),
        }
    )
    if not model_config.api_key or not model_config.base_url or not model_config.model:
        raise HTTPException(status_code=400, detail="请先在设置页配置 API Key、Base URL 和模型名称")
    return model_config


def normalize_base_url(base_url: str) -> str:
    return base_url.strip().rstrip("/} \t\r\n")


def model_auth_headers(model_config: RuntimeModelConfig) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if "xiaomimimo.com" in model_config.base_url.lower():
        headers["api-key"] = model_config.api_key
        headers["Authorization"] = f"Bearer {model_config.api_key}"
    else:
        headers["Authorization"] = f"Bearer {model_config.api_key}"
    return headers


def chat_completions_url(base_url: str) -> str:
    url = normalize_base_url(base_url)
    if url.endswith("/chat/completions"):
        return url
    return f"{url}/chat/completions"


async def call_chat_model(system_prompt: str, user_prompt: str, model_config: RuntimeModelConfig | None) -> str:
    model_config = ensure_runtime_model_config(model_config)
    url = chat_completions_url(model_config.base_url)
    payload = {
        "model": model_config.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    if "xiaomimimo.com" in model_config.base_url.lower():
        payload.update({"max_completion_tokens": 1024, "temperature": 1.0, "top_p": 0.95})
    headers = model_auth_headers(model_config)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
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
    model_config = ensure_runtime_model_config(model_config)
    if "xiaomimimo.com" in model_config.base_url.lower():
        content = await call_chat_messages(messages, model_config)
        data = {"choices": [{"delta": {"content": content}}]}
        yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")
        yield b"data: [DONE]\n\n"
        return

    url = chat_completions_url(model_config.base_url)
    payload = {
        "model": model_config.model,
        "stream": True,
        "messages": messages,
    }
    headers = model_auth_headers(model_config)

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes():
                if chunk:
                    yield chunk


async def call_chat_messages(messages: list[dict[str, str]], model_config: RuntimeModelConfig | None) -> str:
    model_config = ensure_runtime_model_config(model_config)
    url = chat_completions_url(model_config.base_url)
    payload = {
        "model": model_config.model,
        "messages": messages,
        "temperature": 0.2,
    }
    if "xiaomimimo.com" in model_config.base_url.lower():
        payload.update({"max_completion_tokens": 1024, "temperature": 1.0, "top_p": 0.95})
    headers = model_auth_headers(model_config)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
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


async def call_vision_model(image_url: str, prompt: str, model_config: RuntimeModelConfig) -> str:
    vision_api_key = (model_config.vision_api_key or model_config.api_key).strip()
    if model_config.use_system_model and model_config.vision_base_url and not vision_api_key:
        vision_api_key = _get_system_setting("system_model_vision_api_key").strip()
    if model_config.use_system_model and not vision_api_key:
        vision_api_key = _get_system_api_key()
    vision_config = model_config.model_copy(
        update={
            "api_key": vision_api_key,
            "base_url": normalize_base_url(model_config.vision_base_url or model_config.base_url),
            "model": (model_config.vision_model or model_config.model).strip(),
        }
    )
    if not vision_config.api_key or not vision_config.base_url or not vision_config.model:
        raise HTTPException(status_code=400, detail="请先在设置页配置视觉模型 API Key、Base URL 和模型名称")
    url = chat_completions_url(vision_config.base_url)
    payload = {
        "model": vision_config.model,
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
    headers = model_auth_headers(vision_config)

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
