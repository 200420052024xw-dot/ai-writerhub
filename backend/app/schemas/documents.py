from datetime import datetime
from typing import Literal

from pydantic import BaseModel


DocumentFileType = Literal["txt", "md", "doc", "docx", "pdf", "ppt", "pptx"]
RagStatus = Literal["not_indexed", "indexed", "outdated", "indexing", "failed"]


class DocumentSummary(BaseModel):
    id: str
    title: str
    content_hash: str
    rag_status: RagStatus
    last_saved_at: datetime
    last_indexed_at: datetime | None = None


class DocumentDetail(DocumentSummary):
    content: str


class DocumentCreateRequest(BaseModel):
    title: str = "无标题文档"
    content: str = ""


class DocumentUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]
