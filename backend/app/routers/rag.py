from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.rag import RagQueryRequest
from app.services.llm_client import RuntimeModelConfig
from app.services.rag_service import stream_rag_answer


router = APIRouter()


@router.post("/rag/query/stream")
async def query_rag_stream(payload: RagQueryRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_rag_answer(
            payload.question,
            payload.document_ids,
            payload.rag_config,
            RuntimeModelConfig(
                api_key=payload.chat_config.api_key,
                base_url=payload.chat_config.base_url,
                model=payload.chat_config.model,
            ),
        ),
        media_type="text/event-stream",
    )
