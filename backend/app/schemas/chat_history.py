from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.rag import RagSearchResult


class ChatMessage(BaseModel):
    role: str
    content: str


class KnowledgeConversation(BaseModel):
    id: str
    title: str
    document_ids: list[str] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(default_factory=list)
    search_results: list[RagSearchResult] = Field(default_factory=list)
    turn_search_results: list[list[RagSearchResult]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class KnowledgeConversationCreate(BaseModel):
    title: str = "未命名对话"
    document_ids: list[str] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(default_factory=list)
    search_results: list[RagSearchResult] = Field(default_factory=list)
    turn_search_results: list[list[RagSearchResult]] = Field(default_factory=list)


class KnowledgeConversationUpdate(BaseModel):
    title: str


class KnowledgeConversationContentUpdate(BaseModel):
    title: str | None = None
    document_ids: list[str] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(default_factory=list)
    search_results: list[RagSearchResult] = Field(default_factory=list)
    turn_search_results: list[list[RagSearchResult]] = Field(default_factory=list)


class KnowledgeConversationList(BaseModel):
    conversations: list[KnowledgeConversation]


class DocumentAssistantHistory(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
