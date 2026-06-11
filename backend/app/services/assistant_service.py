import json
from typing import AsyncGenerator

import httpx

from app.prompts.assistant import ASSISTANT_SYSTEM_PROMPT
from app.schemas.assistant import AssistantMessage
from app.services.llm_client import RuntimeModelConfig, stream_chat_model


def error_event(message: str) -> bytes:
    data = {"choices": [{"delta": {"content": message}}]}
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")


async def stream_assistant_reply(
    messages: list[AssistantMessage],
    model_config: RuntimeModelConfig,
    document_context: str = "",
) -> AsyncGenerator[bytes, None]:
    context_prompt = (
        "\n\n当前文档原文如下。回答用户问题时优先参考它；如果用户要求改写、续写、提炼或解释，请基于这份原文处理。\n"
        f"{document_context.strip()}"
    ) if document_context.strip() else ""
    provider_messages = [
        {"role": "system", "content": f"{ASSISTANT_SYSTEM_PROMPT}{context_prompt}"},
        *[message.model_dump() for message in messages],
    ]

    try:
        async for chunk in stream_chat_model(provider_messages, model_config):
            yield chunk
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text or str(exc)
        yield error_event(f"模型请求失败：{detail}")
        yield b"data: [DONE]\n\n"
    except httpx.HTTPError as exc:
        yield error_event(f"模型连接失败：{exc}")
        yield b"data: [DONE]\n\n"
    except Exception as exc:
        yield error_event(f"模型流式响应失败：{exc}")
        yield b"data: [DONE]\n\n"
