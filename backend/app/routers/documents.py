import re

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.documents import (
    DocumentCreateRequest,
    DocumentDetail,
    DocumentListResponse,
    DocumentParagraphsUpdateRequest,
    DocumentUpdateRequest,
    TrashListResponse,
    TrashPurgeResponse,
)
from app.schemas.rag import RagIndexRequest
from app.services.document_service import (
    complete_document_index,
    content_hash,
    create_document,
    delete_document,
    get_document,
    list_documents,
    list_trashed_documents,
    mark_document_index_failed,
    mark_document_indexing,
    permanent_delete_document,
    purge_expired_trash,
    quick_upload_document,
    recognize_document,
    restore_document,
    trash_document,
    update_document,
    update_document_paragraphs,
    upload_and_parse_document,
)
from app.services.format_service import build_docx, build_pdf
from app.services.llm_client import RuntimeModelConfig
from app.services.rag_service import index_document_chunks
from app.schemas.format import FormatConfig, FormatDocumentParagraph, FormatExportDocxRequest


router = APIRouter()


@router.get("/documents", response_model=DocumentListResponse)
async def documents() -> DocumentListResponse:
    return DocumentListResponse(documents=list_documents())


@router.get("/documents/trash", response_model=TrashListResponse)
async def trashed_documents() -> TrashListResponse:
    return TrashListResponse(documents=list_trashed_documents())


@router.get("/documents/{document_id}", response_model=DocumentDetail)
async def document_detail(document_id: str) -> DocumentDetail:
    return get_document(document_id)


@router.post("/documents/new", response_model=DocumentDetail)
async def new_document(payload: DocumentCreateRequest) -> DocumentDetail:
    return create_document(payload)


@router.patch("/documents/{document_id}", response_model=DocumentDetail)
async def save_document(document_id: str, payload: DocumentUpdateRequest) -> DocumentDetail:
    return update_document(document_id, payload)


@router.put("/documents/{document_id}/paragraphs", response_model=DocumentDetail)
async def save_document_paragraphs(document_id: str, payload: DocumentParagraphsUpdateRequest) -> DocumentDetail:
    return update_document_paragraphs(document_id, payload.paragraphs)


@router.delete("/documents/{document_id}")
async def remove_document(document_id: str) -> dict[str, bool]:
    trash_document(document_id)
    return {"ok": True}


@router.post("/documents/{document_id}/restore")
async def restore_trashed_document(document_id: str) -> dict[str, bool]:
    restore_document(document_id)
    return {"ok": True}


@router.delete("/documents/{document_id}/permanent")
async def permanently_delete_document(document_id: str) -> dict[str, bool]:
    permanent_delete_document(document_id)
    return {"ok": True}


@router.post("/documents/trash/purge", response_model=TrashPurgeResponse)
async def purge_trash() -> TrashPurgeResponse:
    purged = purge_expired_trash()
    return TrashPurgeResponse(purged=purged)


@router.post("/documents/{document_id}/index", response_model=DocumentDetail)
async def index_document(document_id: str, payload: RagIndexRequest | None = None) -> DocumentDetail:
    document = mark_document_indexing(document_id)
    try:
        chunk_count = await index_document_chunks(document, payload.rag_config if payload else None)
        if chunk_count == 0:
            mark_document_index_failed(document_id)
            raise HTTPException(status_code=400, detail="文档内容为空，无法生成知识库索引")
    except Exception:
        mark_document_index_failed(document_id)
        raise
    return complete_document_index(document_id, content_hash(document.content))


@router.post("/documents/upload", response_model=DocumentDetail)
async def upload_document(
    file: UploadFile = File(...),
    api_key: str = Form(...),
    base_url: str = Form(...),
    model: str = Form(...),
    vision_model: str | None = Form(None),
) -> DocumentDetail:
    return await upload_and_parse_document(
        file,
        RuntimeModelConfig(api_key=api_key, base_url=base_url, model=model, vision_model=vision_model),
    )


@router.post("/documents/upload/quick", response_model=DocumentDetail)
async def upload_quick(
    file: UploadFile = File(...),
) -> DocumentDetail:
    return await quick_upload_document(file)


@router.post("/documents/{document_id}/recognize", response_model=DocumentDetail)
async def recognize(
    document_id: str,
    api_key: str = Form(...),
    base_url: str = Form(...),
    model: str = Form(...),
    vision_model: str | None = Form(None),
) -> DocumentDetail:
    return await recognize_document(
        document_id,
        RuntimeModelConfig(api_key=api_key, base_url=base_url, model=model, vision_model=vision_model),
    )


# --------------- Document export ---------------

_DEFAULT_EXPORT_CONFIG = FormatConfig(
    bodyFont="宋体（SimSun）",
    bodyFontSize="小四（12pt）",
    bodyBold=False,
    lineHeight="1.5 倍行距",
    indent="首行缩进 2 字符",
    align="两端对齐",
    titleFont="黑体",
    titleFontSize="三号（16pt）",
    titleBold=True,
    h1Font="黑体",
    h1FontSize="三号（16pt）",
    h1Bold=True,
    h2Font="黑体",
    h2FontSize="四号（14pt）",
    h2Bold=True,
    h3Font="黑体",
    h3FontSize="小四（12pt）",
    h3Bold=True,
    paperSize="A4（21 × 29.7cm）",
    orientation="纵向",
    margin="普通：上/下 2.54cm，左/右 3.18cm",
)


def _paragraphs_to_format(doc_paragraphs) -> list[FormatDocumentParagraph]:
    return [
        FormatDocumentParagraph(
            paragraph_id=p.id,
            type=p.type,
            level=p.level,
            content=p.content,
        )
        for p in doc_paragraphs
    ]


@router.get("/documents/{document_id}/export/docx")
async def export_docx(document_id: str) -> StreamingResponse:
    doc = get_document(document_id)
    paragraphs = _paragraphs_to_format(doc.paragraphs)
    title = doc.title.strip() or "无标题文档"
    payload = FormatExportDocxRequest(title=title, paragraphs=paragraphs, config=_DEFAULT_EXPORT_CONFIG)
    buffer = build_docx(payload)
    safe_title = re.sub(r'[\\/:*?"<>|]', '', title)[:50] or "文档"
    filename = f"{safe_title}.docx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/documents/{document_id}/export/pdf")
async def export_pdf(document_id: str) -> StreamingResponse:
    doc = get_document(document_id)
    paragraphs = _paragraphs_to_format(doc.paragraphs)
    title = doc.title.strip() or "无标题文档"
    buffer = build_pdf(title, paragraphs, _DEFAULT_EXPORT_CONFIG)
    safe_title = re.sub(r'[\\/:*?"<>|]', '', title)[:50] or "文档"
    filename = f"{safe_title}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
