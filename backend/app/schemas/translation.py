from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TranslationDirection = Literal["zh-en", "en-zh"]
TranslationDisplayMode = Literal["split", "paragraph", "sentence"]
TranslationGranularity = Literal["paragraph", "sentence"]
TranslationJobStatus = Literal["queued", "running", "completed", "failed", "interrupted"]
TranslationStyle = Literal["default", "academic", "business", "natural"]


class GlossaryEntry(BaseModel):
    source: str
    target: str


class TranslationOptions(BaseModel):
    style: TranslationStyle = "default"
    unified_terms: bool = True
    preserve_names: bool = True
    custom_requirements: str = ""


class AIModelConfig(BaseModel):
    api_key: str = ""
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)
    use_system_model: bool = False


class TranslationSourceParagraph(BaseModel):
    id: str
    type: Literal["title", "heading", "paragraph", "list", "table"] = "paragraph"
    level: int = 0
    content: str = ""


class ExtractTermsRequest(BaseModel):
    source_text: str
    direction: TranslationDirection = "zh-en"
    ai_config: AIModelConfig


class ExtractTermsResponse(BaseModel):
    terms: list[GlossaryEntry]


class TranslationPair(BaseModel):
    source: str
    target: str
    paragraph_id: str | None = None
    sentence_index: int | None = None


class TranslationChunk(BaseModel):
    index: int
    source: str
    target: str
    paragraph_pairs: list[TranslationPair] = Field(default_factory=list)
    sentence_pairs: list[TranslationPair] = Field(default_factory=list)


class TranslationPreview(BaseModel):
    granularity: TranslationGranularity
    pairs: list[TranslationPair]


class TranslationVersion(BaseModel):
    document_id: str
    direction: TranslationDirection
    granularity: TranslationGranularity
    source_text: str
    source_hash: str
    current_source_hash: str
    is_stale: bool
    target_text: str
    context_summary: str = ""
    used_context_summary: bool = False
    chunks: list[TranslationChunk] = Field(default_factory=list)
    paragraph_pairs: list[TranslationPair] = Field(default_factory=list)
    sentence_pairs: list[TranslationPair] = Field(default_factory=list)
    options: TranslationOptions = Field(default_factory=TranslationOptions)
    updated_at: datetime


class TranslationJobCreate(BaseModel):
    direction: TranslationDirection
    granularity: TranslationGranularity
    options: TranslationOptions = Field(default_factory=TranslationOptions)
    glossary: list[GlossaryEntry] = Field(default_factory=list)
    ai_config: AIModelConfig


class TranslationJob(BaseModel):
    id: str
    document_id: str
    direction: TranslationDirection
    granularity: TranslationGranularity
    status: TranslationJobStatus
    total_chunks: int = 0
    completed_chunks: int = 0
    error: str = ""
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class TranslationWorkspace(BaseModel):
    versions: list[TranslationVersion] = Field(default_factory=list)
    jobs: list[TranslationJob] = Field(default_factory=list)
