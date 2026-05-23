import httpx
from fastapi import HTTPException

from app.core.config import get_settings


async def call_chat_model(system_prompt: str, user_prompt: str) -> str:
    settings = get_settings()
    if not settings.has_ai_key:
        raise HTTPException(status_code=400, detail="AI_API_KEY is not configured in backend/.env")

    url = f"{settings.ai_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.ai_default_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
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
