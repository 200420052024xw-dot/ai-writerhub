from pydantic import BaseModel, Field


class MarkdownDetectRequest(BaseModel):
    content: str = Field(default="")


class MarkdownDetectResponse(BaseModel):
    is_markdown: bool
    features: list[str]
    score: int
