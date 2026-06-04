from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TranslationDirection = Literal["zh-en", "en-zh"]
TranslationDisplayMode = Literal["split", "paragraph", "sentence"]
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
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)


class TranslationSourceParagraph(BaseModel):
    id: str
    type: Literal["title", "heading", "paragraph", "list", "table"] = "paragraph"
    level: int = 0
    content: str = ""


class TranslationRequest(BaseModel):
    source_text: str = Field(default="")
    source_paragraphs: list[TranslationSourceParagraph]
    direction: TranslationDirection = "zh-en"
    display_mode: TranslationDisplayMode = "split"
    options: TranslationOptions = Field(default_factory=TranslationOptions)
    glossary: list[GlossaryEntry] = Field(default_factory=list)
    ai_config: AIModelConfig


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


class TranslationResponse(BaseModel):
    source_text: str
    target_text: str
    direction: TranslationDirection
    display_mode: TranslationDisplayMode
    context_summary: str
    used_context_summary: bool
    chunk_count: int
    chunks: list[TranslationChunk]
    paragraph_pairs: list[TranslationPair]
    sentence_pairs: list[TranslationPair]
    applied_options: TranslationOptions


class DocumentTranslationState(BaseModel):
    document_id: str
    source_text: str = ""
    target_text: str = ""
    direction: TranslationDirection = "zh-en"
    display_mode: TranslationDisplayMode = "split"
    context_summary: str = ""
    used_context_summary: bool = False
    chunks: list[TranslationChunk] = Field(default_factory=list)
    paragraph_pairs: list[TranslationPair] = Field(default_factory=list)
    sentence_pairs: list[TranslationPair] = Field(default_factory=list)
    options: TranslationOptions = Field(default_factory=TranslationOptions)
    updated_at: datetime | None = None


class DocumentTranslationStateSave(BaseModel):
    source_text: str = ""
    target_text: str = ""
    direction: TranslationDirection = "zh-en"
    display_mode: TranslationDisplayMode = "split"
    context_summary: str = ""
    used_context_summary: bool = False
    chunks: list[TranslationChunk] = Field(default_factory=list)
    paragraph_pairs: list[TranslationPair] = Field(default_factory=list)
    sentence_pairs: list[TranslationPair] = Field(default_factory=list)
    options: TranslationOptions = Field(default_factory=TranslationOptions)
