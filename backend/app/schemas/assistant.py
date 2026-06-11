from typing import Literal

from pydantic import BaseModel, Field


class AssistantMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AssistantChatRequest(BaseModel):
    api_key: str = ""
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)
    use_system_model: bool = False
    document_context: str = ""
    messages: list[AssistantMessage]
