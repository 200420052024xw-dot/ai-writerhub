import json
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.translation import (
    ExtractTermsRequest,
    ExtractTermsResponse,
    TranslationGranularity,
    TranslationJob,
    TranslationJobCreate,
    TranslationPreview,
    TranslationWorkspace,
    TranslationPair,
    TranslationSourceParagraph,
)
from app.services.translation_service import extract_terms
from app.services.llm_client import RuntimeModelConfig
from app.services.translation_state_service import list_translation_versions
from app.services.translation_job_service import (
    create_translation_job,
    get_translation_job,
    list_translation_jobs,
    subscribe_job,
    unsubscribe_job,
)
from app.services.document_service import get_document
from app.services.translation_service import build_paragraph_units, build_sentence_units

router = APIRouter()


def runtime_model_config(payload_config) -> RuntimeModelConfig:
    return RuntimeModelConfig(
        api_key=payload_config.api_key,
        base_url=payload_config.base_url,
        model=payload_config.model,
        use_system_model=getattr(payload_config, "use_system_model", False),
    )


@router.post("/translate/extract-terms", response_model=ExtractTermsResponse)
async def extract_terms_endpoint(payload: ExtractTermsRequest) -> ExtractTermsResponse:
    terms = await extract_terms(payload.source_text, payload.direction, runtime_model_config(payload.ai_config))
    return ExtractTermsResponse(terms=terms)


@router.get("/documents/{document_id}/translation-workspace", response_model=TranslationWorkspace)
async def translation_workspace(document_id: str) -> TranslationWorkspace:
    return TranslationWorkspace(
        versions=list_translation_versions(document_id),
        jobs=list_translation_jobs(document_id),
    )


@router.get("/translation-jobs", response_model=list[TranslationJob])
async def active_translation_jobs() -> list[TranslationJob]:
    return list_translation_jobs(active_only=True)


@router.get("/translation-jobs/{job_id}", response_model=TranslationJob)
async def translation_job(job_id: str) -> TranslationJob:
    job = get_translation_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="translation job not found")
    return job


@router.post("/documents/{document_id}/translation-jobs", response_model=TranslationJob)
async def start_translation_job(document_id: str, payload: TranslationJobCreate) -> TranslationJob:
    return create_translation_job(document_id, payload)


@router.get(
    "/documents/{document_id}/translation-preview/{granularity}",
    response_model=TranslationPreview,
)
async def translation_preview(
    document_id: str,
    granularity: TranslationGranularity,
) -> TranslationPreview:
    document = get_document(document_id)
    paragraphs = [
        TranslationSourceParagraph(id=item.id, type=item.type, level=item.level, content=item.content)
        for item in document.paragraphs
        if item.content.strip()
    ]
    units = build_sentence_units(paragraphs) if granularity == "sentence" else build_paragraph_units(paragraphs)
    return TranslationPreview(
        granularity=granularity,
        pairs=[
            TranslationPair(
                source=unit["text"],
                target="",
                paragraph_id=unit["paragraph_id"],
                sentence_index=unit.get("sentence_index"),
            )
            for unit in units
        ],
    )


@router.get("/documents/{document_id}/translation-jobs/{job_id}/stream")
async def stream_translation_job(document_id: str, job_id: str) -> StreamingResponse:
    job = get_translation_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="translation job not found")

    async def event_stream() -> AsyncIterator[str]:
        queue = subscribe_job(job_id)
        try:
            # 如果任务已结束，直接推送终态
            if job.status == "completed":
                yield f"data: {json.dumps({'type': 'completed'}, ensure_ascii=False)}\n\n"
                return
            if job.status == "failed":
                yield f"data: {json.dumps({'type': 'failed', 'error': job.error or '未知错误'}, ensure_ascii=False)}\n\n"
                return
            if job.status == "interrupted":
                yield f"data: {json.dumps({'type': 'failed', 'error': job.error or '任务被中断'}, ensure_ascii=False)}\n\n"
                return

            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event.get("type") in ("completed", "failed"):
                    break
        finally:
            unsubscribe_job(job_id, queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
