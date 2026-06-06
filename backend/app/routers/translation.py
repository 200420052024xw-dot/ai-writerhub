from fastapi import APIRouter, HTTPException

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
from app.services.translation_job_service import create_translation_job, get_translation_job, list_translation_jobs
from app.services.document_service import get_document
from app.services.translation_service import build_paragraph_units, build_sentence_units

router = APIRouter()


def runtime_model_config(payload_config) -> RuntimeModelConfig:
    return RuntimeModelConfig(
        api_key=payload_config.api_key,
        base_url=payload_config.base_url,
        model=payload_config.model,
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
