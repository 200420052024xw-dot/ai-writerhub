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


class DocumentBlock(BaseModel):
    type: Literal["heading1", "heading2", "paragraph", "bullet"]
    text: str


class FormatExportDocxRequest(BaseModel):
    title: str
    blocks: list[DocumentBlock]
    config: FormatConfig


class ModelConnectionTestRequest(BaseModel):
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)


class FormatOrganizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)
    config: FormatConfig
    api_key: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1)


class FormatOrganizeResponse(BaseModel):
    blocks: list[DocumentBlock]
