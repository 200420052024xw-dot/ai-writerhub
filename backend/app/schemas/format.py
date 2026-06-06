from typing import Literal

from pydantic import BaseModel, Field


class FormatConfig(BaseModel):
    font: str = ""
    fontSize: str = ""
    lineHeight: str = ""
    indent: str = ""
    align: str = ""
    paperSize: str = ""
    headingStyle: str = ""
    margin: str = ""
    header: str = ""
    footer: str = ""
    extraRequirements: str = ""


class FormatParseRequest(BaseModel):
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)
    prompt: str = Field(min_length=1, max_length=1000)
    current_config: FormatConfig


class FormatParseResponse(BaseModel):
    config: FormatConfig


class FormatDocumentParagraph(BaseModel):
    paragraph_id: str = Field(min_length=1)
    type: Literal["title", "heading", "paragraph", "list", "table"]
    level: int = Field(default=0, ge=0, le=4)
    content: str = ""


class FormatExportDocxRequest(BaseModel):
    title: str
    paragraphs: list[FormatDocumentParagraph]
    config: FormatConfig


class ModelConnectionTestRequest(BaseModel):
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)


class FormatOrganizeRequest(BaseModel):
    paragraphs: list[FormatDocumentParagraph] = Field(min_length=1)
    config: FormatConfig
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)


class FormatOrganizeResponse(BaseModel):
    paragraphs: list[FormatDocumentParagraph]
