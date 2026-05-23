from typing import Literal

from pydantic import BaseModel, Field

TranslationDirection = Literal["zh-en", "en-zh"]
TranslationDisplayMode = Literal["split", "paragraph", "sentence"]


class TranslationOptions(BaseModel):
    academic_style: bool = True
    business_style: bool = True
    natural_tone: bool = True
    unified_terms: bool = True
    preserve_names: bool = True


class TranslationRequest(BaseModel):
    source_text: str = Field(default="")
    direction: TranslationDirection = "zh-en"
    display_mode: TranslationDisplayMode = "split"
    options: TranslationOptions = Field(default_factory=TranslationOptions)


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
