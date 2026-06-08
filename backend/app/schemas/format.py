from typing import Literal

from pydantic import BaseModel, Field


class FormatConfig(BaseModel):
    # 基础设置 - 正文
    bodyFont: str = ""
    bodyFontSize: str = ""
    bodyBold: bool = False
    lineHeight: str = ""
    indent: str = ""
    align: str = ""
    # 高级设置 - 大标题
    titleFont: str = ""
    titleFontSize: str = ""
    titleBold: bool = True
    # 高级设置 - 1级标题
    h1Font: str = ""
    h1FontSize: str = ""
    h1Bold: bool = True
    # 高级设置 - 2级标题
    h2Font: str = ""
    h2FontSize: str = ""
    h2Bold: bool = True
    # 高级设置 - 3级标题
    h3Font: str = ""
    h3FontSize: str = ""
    h3Bold: bool = True
    # 高级设置 - 页面
    paperSize: str = ""
    orientation: str = ""
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
