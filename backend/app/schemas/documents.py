from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.translation import GlossaryEntry


DocumentFileType = Literal["txt", "md", "doc", "docx", "pdf", "ppt", "pptx"]
RagStatus = Literal["not_indexed", "indexed", "outdated", "indexing", "failed"]
DocumentParagraphType = Literal["title", "heading", "paragraph", "list", "table"]
DocumentLanguage = Literal["zh", "en"]


class DocumentSummary(BaseModel):
    id: str
    title: str
    content_hash: str
    rag_status: RagStatus
    language: DocumentLanguage = "zh"
    last_saved_at: datetime
    last_indexed_at: datetime | None = None
    deleted_at: datetime | None = None


class DocumentParagraph(BaseModel):
    id: str
    document_id: str | None = None
    paragraph_index: int = 0
    type: DocumentParagraphType = "paragraph"
    level: int = 0
    content: str = ""
    content_hash: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DocumentParagraphInput(BaseModel):
    id: str | None = None
    type: DocumentParagraphType = "paragraph"
    level: int = 0
    content: str = ""


class DocumentDetail(DocumentSummary):
    content: str
    paragraphs: list[DocumentParagraph] = Field(default_factory=list)
    glossary: list[GlossaryEntry] = Field(default_factory=list)


class DocumentCreateRequest(BaseModel):
    title: str = "无标题文档"
    content: str = ""
    glossary: list[GlossaryEntry] = Field(default_factory=list)
    language: DocumentLanguage | None = None


class DocumentUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    glossary: list[GlossaryEntry] | None = None
    language: DocumentLanguage | None = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]


class DocumentParagraphsUpdateRequest(BaseModel):
    paragraphs: list[DocumentParagraphInput] = Field(default_factory=list)


class TrashListResponse(BaseModel):
    documents: list[DocumentSummary]


class TrashPurgeResponse(BaseModel):
    purged: int
