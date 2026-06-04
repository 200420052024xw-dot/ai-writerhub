from typing import Literal

from pydantic import BaseModel, Field


EmbeddingSource = Literal["local", "api"]
RecallStrategy = Literal["vector", "hybrid"]


class RagRuntimeConfig(BaseModel):
    embedding_source: EmbeddingSource = "local"
    local_model_path: str = r"F:\hf_cache\model"
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    recall_strategy: RecallStrategy = "vector"
    enable_rerank: bool = False
    rerank_model_path: str = r"F:\hf_cache\models--Qwen--Qwen3-Reranker-0.6B\snapshots\e61197ed45024b0ed8a2d74b80b4d909f1255473"


class RagChatConfig(BaseModel):
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)


class RagIndexRequest(BaseModel):
    rag_config: RagRuntimeConfig | None = None


class RagQueryRequest(BaseModel):
    question: str = Field(min_length=1)
    document_ids: list[str] = Field(default_factory=list)
    rag_config: RagRuntimeConfig | None = None
    chat_config: RagChatConfig


class RagSearchResult(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    paragraph_id: str | None = None
    paragraph_index: int | None = None
    chunk_index: int
    content: str
    score: float
    source: str
