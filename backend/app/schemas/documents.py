from datetime import datetime
from typing import Literal

from pydantic import BaseModel


DocumentFileType = Literal["txt", "md", "doc", "docx", "pdf", "ppt", "pptx"]


class DocumentSummary(BaseModel):
    id: str
    title: str
    filename: str
    file_type: DocumentFileType | Literal["new"]
    uploaded_at: datetime
    updated_at: datetime
    parse_method: Literal["vision", "manual"]


class DocumentDetail(DocumentSummary):
    content: str


class DocumentCreateRequest(BaseModel):
    title: str = "无标题文档"
    content: str = ""


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]
