import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.translation import (
    ExtractTermsRequest,
    ExtractTermsResponse,
    TranslationPair,
    TranslationRequest,
    TranslationResponse,
)
from app.services.translation_service import (
    build_pairs,
    extract_terms,
    split_paragraphs,
    split_sentences,
    translate_with_strategy,
    translate_with_strategy_stream,
)
from app.services.llm_client import RuntimeModelConfig

router = APIRouter()


def runtime_model_config(payload_config) -> RuntimeModelConfig | None:
    if payload_config is None:
        return None
    return RuntimeModelConfig(
        api_key=payload_config.api_key,
        base_url=payload_config.base_url,
        model=payload_config.model,
    )


@router.post("/translate", response_model=TranslationResponse)
async def translate(payload: TranslationRequest) -> TranslationResponse:
    target_text, context_summary, used_context_summary, chunks = await translate_with_strategy(
        payload.source_text,
        payload.direction,
        payload.options,
        payload.glossary or None,
        runtime_model_config(payload.ai_config),
    )
    paragraphs = split_paragraphs(payload.source_text)
    sentences = split_sentences(payload.source_text)
    single_chunk = chunks[0] if len(chunks) == 1 else None
    can_reuse_single_translation = single_chunk is not None and single_chunk.source.strip() == payload.source_text.strip()
    reused_pair = TranslationPair(source=single_chunk.source, target=single_chunk.target) if single_chunk else None

    return TranslationResponse(
        source_text=payload.source_text,
        target_text=target_text,
        direction=payload.direction,
        display_mode=payload.display_mode,
        context_summary=context_summary,
        used_context_summary=used_context_summary,
        chunk_count=len(chunks),
        chunks=chunks,
        paragraph_pairs=(
            [reused_pair] if can_reuse_single_translation and reused_pair else await build_pairs(paragraphs, payload.direction, payload.options, context_summary, payload.glossary or None, runtime_model_config(payload.ai_config))
        ),
        sentence_pairs=(
            [reused_pair] if can_reuse_single_translation and reused_pair else await build_pairs(sentences, payload.direction, payload.options, context_summary, payload.glossary or None, runtime_model_config(payload.ai_config))
        ),
        applied_options=payload.options,
    )


@router.post("/translate/stream")
async def translate_stream(payload: TranslationRequest) -> StreamingResponse:
    async def event_stream():
        try:
            async for event in translate_with_strategy_stream(
                payload.source_text,
                payload.direction,
                payload.options,
                payload.glossary or None,
                runtime_model_config(payload.ai_config),
            ):
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
