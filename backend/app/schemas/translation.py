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


class TranslationRequest(BaseModel):
    source_text: str = Field(default="")
    direction: TranslationDirection = "zh-en"
    display_mode: TranslationDisplayMode = "split"
    options: TranslationOptions = Field(default_factory=TranslationOptions)
    glossary: list[GlossaryEntry] = Field(default_factory=list)
    ai_config: AIModelConfig | None = None


class ExtractTermsRequest(BaseModel):
    source_text: str
    direction: TranslationDirection = "zh-en"
    ai_config: AIModelConfig | None = None


class ExtractTermsResponse(BaseModel):
    terms: list[GlossaryEntry]


class TranslationPair(BaseModel):
    source: str
    target: str


class TranslationChunk(BaseModel):
    index: int
    source: str
    target: str


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
