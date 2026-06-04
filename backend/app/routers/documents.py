from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.documents import DocumentCreateRequest, DocumentDetail, DocumentListResponse, DocumentParagraphsUpdateRequest, DocumentUpdateRequest
from app.schemas.rag import RagIndexRequest
from app.services.document_service import (
    complete_document_index,
    content_hash,
    create_document,
    delete_document,
    get_document,
    list_documents,
    mark_document_index_failed,
    mark_document_indexing,
    update_document,
    update_document_paragraphs,
    upload_and_parse_document,
)
from app.services.llm_client import RuntimeModelConfig
from app.services.rag_service import index_document_chunks


router = APIRouter()


@router.get("/documents", response_model=DocumentListResponse)
async def documents() -> DocumentListResponse:
    return DocumentListResponse(documents=list_documents())


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
    delete_document(document_id)
    return {"ok": True}


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
) -> DocumentDetail:
    return await upload_and_parse_document(
        file,
        RuntimeModelConfig(api_key=api_key, base_url=base_url, model=model),
    )
