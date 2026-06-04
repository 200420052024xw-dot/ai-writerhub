import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.translation import (
    ExtractTermsRequest,
    ExtractTermsResponse,
    DocumentTranslationState,
    DocumentTranslationStateSave,
    TranslationRequest,
    TranslationResponse,
)
from app.services.translation_service import (
    extract_terms,
    translate_structured_with_strategy,
    translate_structured_with_strategy_stream,
)
from app.services.llm_client import RuntimeModelConfig
from app.services.translation_state_service import get_document_translation_state, save_document_translation_state

router = APIRouter()


def runtime_model_config(payload_config) -> RuntimeModelConfig:
    return RuntimeModelConfig(
        api_key=payload_config.api_key,
        base_url=payload_config.base_url,
        model=payload_config.model,
    )


@router.post("/translate", response_model=TranslationResponse)
async def translate(payload: TranslationRequest) -> TranslationResponse:
    if not payload.source_paragraphs:
        raise HTTPException(status_code=400, detail="translation requires stored document paragraphs")
    target_text, context_summary, used_context_summary, chunks = await translate_structured_with_strategy(
        payload.source_paragraphs,
        payload.direction,
        payload.display_mode,
        payload.options,
        payload.glossary or None,
        runtime_model_config(payload.ai_config),
    )
    source_text = "\n\n".join(paragraph.content for paragraph in payload.source_paragraphs if paragraph.content.strip())
    paragraph_pairs = [pair for chunk in chunks for pair in chunk.paragraph_pairs]
    sentence_pairs = [pair for chunk in chunks for pair in chunk.sentence_pairs]

    return TranslationResponse(
        source_text=source_text,
        target_text=target_text,
        direction=payload.direction,
        display_mode=payload.display_mode,
        context_summary=context_summary,
        used_context_summary=used_context_summary,
        chunk_count=len(chunks),
        chunks=chunks,
        paragraph_pairs=paragraph_pairs,
        sentence_pairs=sentence_pairs,
        applied_options=payload.options,
    )


@router.post("/translate/stream")
async def translate_stream(payload: TranslationRequest) -> StreamingResponse:
    async def event_stream():
        try:
            if not payload.source_paragraphs:
                raise HTTPException(status_code=400, detail="translation requires stored document paragraphs")
            stream = translate_structured_with_strategy_stream(
                payload.source_paragraphs,
                payload.direction,
                payload.display_mode,
                payload.options,
                payload.glossary or None,
                runtime_model_config(payload.ai_config),
            )
            async for event in stream:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/translate/extract-terms", response_model=ExtractTermsResponse)
async def extract_terms_endpoint(payload: ExtractTermsRequest) -> ExtractTermsResponse:
    terms = await extract_terms(payload.source_text, payload.direction, runtime_model_config(payload.ai_config))
    return ExtractTermsResponse(terms=terms)


@router.get("/documents/{document_id}/translation-state", response_model=DocumentTranslationState | None)
async def document_translation_state(document_id: str) -> DocumentTranslationState | None:
    return get_document_translation_state(document_id)


@router.put("/documents/{document_id}/translation-state", response_model=DocumentTranslationState)
async def put_document_translation_state(document_id: str, payload: DocumentTranslationStateSave) -> DocumentTranslationState:
    return save_document_translation_state(document_id, payload)
