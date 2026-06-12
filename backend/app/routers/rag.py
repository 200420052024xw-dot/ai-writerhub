import json
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.rag import RagQueryRequest, RagRuntimeConfig
from app.services.llm_client import RuntimeModelConfig
from app.services.document_service import get_document
from app.services.rag_service import stream_rag_answer, test_embedding_model


router = APIRouter()


async def safe_event_stream(stream: AsyncIterator[str]) -> AsyncIterator[str]:
    try:
        async for event in stream:
            yield event
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail, ensure_ascii=False)
        yield f"data: {json.dumps({'type': 'error', 'message': detail}, ensure_ascii=False)}\n\n"
        yield "data: {\"type\":\"complete\"}\n\n"
    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'message': f'RAG request failed: {exc}'}, ensure_ascii=False)}\n\n"
        yield "data: {\"type\":\"complete\"}\n\n"


@router.post("/rag/test-embedding")
async def test_rag_embedding(payload: RagRuntimeConfig) -> dict[str, bool]:
    await test_embedding_model(payload)
    return {"ok": True}


@router.post("/rag/query/stream")
async def query_rag_stream(payload: RagQueryRequest) -> StreamingResponse:
    for document_id in set(payload.document_ids):
        get_document(document_id)
    return StreamingResponse(
        safe_event_stream(stream_rag_answer(
            payload.question,
            payload.document_ids,
            payload.rag_config,
            RuntimeModelConfig(
                api_key=payload.chat_config.api_key,
                base_url=payload.chat_config.base_url,
                model=payload.chat_config.model,
                use_system_model=payload.chat_config.use_system_model,
            ),
        )),
        media_type="text/event-stream",
    )
