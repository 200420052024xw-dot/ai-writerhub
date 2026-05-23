from fastapi import APIRouter

from app.schemas.translation import TranslationPair, TranslationRequest, TranslationResponse
from app.services.translation_service import build_pairs, split_paragraphs, split_sentences, translate_with_strategy

router = APIRouter()


@router.post("/translate", response_model=TranslationResponse)
async def translate(payload: TranslationRequest) -> TranslationResponse:
    target_text, context_summary, used_context_summary, chunks = await translate_with_strategy(
        payload.source_text,
        payload.direction,
        payload.options,
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
            [reused_pair] if can_reuse_single_translation and reused_pair else await build_pairs(paragraphs, payload.direction, payload.options, context_summary)
        ),
        sentence_pairs=(
            [reused_pair] if can_reuse_single_translation and reused_pair else await build_pairs(sentences, payload.direction, payload.options, context_summary)
        ),
        applied_options=payload.options,
    )
