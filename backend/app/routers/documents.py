from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.documents import DocumentCreateRequest, DocumentDetail, DocumentListResponse, DocumentUpdateRequest
from app.services.document_service import (
    complete_document_index,
    content_hash,
    create_document,
    delete_document,
    get_document,
    list_documents,
    mark_document_indexing,
    update_document,
    upload_and_parse_document,
)
from app.services.llm_client import RuntimeModelConfig


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


@router.delete("/documents/{document_id}")
async def remove_document(document_id: str) -> dict[str, bool]:
    delete_document(document_id)
    return {"ok": True}


@router.post("/documents/{document_id}/index", response_model=DocumentDetail)
async def index_document(document_id: str) -> DocumentDetail:
    document = mark_document_indexing(document_id)
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
