from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.format import (
    FormatExportDocxRequest,
    FormatOrganizeRequest,
    FormatOrganizeResponse,
    FormatParseRequest,
    FormatParseResponse,
    ModelConnectionTestRequest,
)
from app.services.format_service import build_docx, organize_document, parse_format_config
from app.services.llm_client import RuntimeModelConfig, test_chat_model


router = APIRouter()


@router.post("/format/parse", response_model=FormatParseResponse)
async def parse_format_prompt(payload: FormatParseRequest) -> FormatParseResponse:
    config = await parse_format_config(
        payload.prompt,
        payload.current_config,
        RuntimeModelConfig(
            api_key=payload.api_key,
            base_url=payload.base_url,
            model=payload.model,
        ),
    )
    return FormatParseResponse(config=config)


@router.post("/format/test-model")
async def test_format_model(payload: ModelConnectionTestRequest) -> dict[str, bool]:
    await test_chat_model(
        RuntimeModelConfig(
            api_key=payload.api_key,
            base_url=payload.base_url,
            model=payload.model,
        ),
    )
    return {"ok": True}


@router.post("/format/export/docx")
async def export_format_docx(payload: FormatExportDocxRequest) -> StreamingResponse:
    if not payload.title.strip() and not payload.paragraphs:
        raise HTTPException(status_code=400, detail="document content is required")

    buffer = build_docx(payload)
    filename = "writerhub-formatted.docx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/format/organize", response_model=FormatOrganizeResponse)
async def organize_format_content(payload: FormatOrganizeRequest) -> FormatOrganizeResponse:
    return await organize_document(
        payload.paragraphs,
        payload.config,
        RuntimeModelConfig(
            api_key=payload.api_key,
            base_url=payload.base_url,
            model=payload.model,
        ),
    )
