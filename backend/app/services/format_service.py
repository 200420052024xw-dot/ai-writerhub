import json
from io import BytesIO

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt
from fastapi import HTTPException

from app.prompts.format import FORMAT_CONFIG_FIELDS, build_format_parse_prompts
from app.schemas.format import DocumentBlock, FormatConfig, FormatExportDocxRequest
from app.services.llm_client import RuntimeModelConfig, call_chat_model


FONT_SIZE_PT = {
    "八号": 5,
    "七号": 5.5,
    "小六": 6.5,
    "六号": 7.5,
    "五号": 10.5,
    "小四": 12,
    "四号": 14,
    "小三": 15,
    "三号": 16,
}


async def parse_format_config(prompt: str, current_config: FormatConfig, model_config: RuntimeModelConfig) -> FormatConfig:
    system_prompt, user_prompt = build_format_parse_prompts(prompt, current_config.model_dump())
    raw = await call_chat_model(system_prompt, user_prompt, model_config)
    content = raw.strip()
    if content.startswith("```"):
        content = content.strip("`").removeprefix("json").strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="模型未返回有效 JSON") from exc

    current = current_config.model_dump()
    for key in FORMAT_CONFIG_FIELDS:
        value = parsed.get(key)
        if isinstance(value, str) and value.strip():
            current[key] = value.strip()

    return FormatConfig(**current)


def parse_font_size(value: str) -> float:
    for label, size in FONT_SIZE_PT.items():
        if label in value:
            return size
    for token in value.replace("pt", "").replace("（", " ").replace("）", " ").replace("(", " ").replace(")", " ").split():
        try:
            return float(token)
        except ValueError:
            continue
    return 12


def parse_line_spacing(value: str) -> float:
    if "2" in value:
        return 2
    if "1.25" in value:
        return 1.25
    if "1.5" in value:
        return 1.5
    return 1


def paragraph_alignment(value: str):
    if "居中" in value:
        return WD_ALIGN_PARAGRAPH.CENTER
    if "右" in value:
        return WD_ALIGN_PARAGRAPH.RIGHT
    if "两端" in value:
        return WD_ALIGN_PARAGRAPH.JUSTIFY
    return WD_ALIGN_PARAGRAPH.LEFT


def configure_section(document: Document, config: FormatConfig) -> None:
    section = document.sections[0]
    if "A5" in config.paperSize:
        section.page_width = Cm(14.8)
        section.page_height = Cm(21)
    elif "B5" in config.paperSize:
        section.page_width = Cm(17.6)
        section.page_height = Cm(25)
    elif "Letter" in config.paperSize:
        section.page_width = Cm(21.6)
        section.page_height = Cm(27.9)
    else:
        section.page_width = Cm(21)
        section.page_height = Cm(29.7)

    if "窄" in config.extraRequirements:
        section.top_margin = section.bottom_margin = section.left_margin = section.right_margin = Cm(1.27)
    else:
        section.top_margin = section.bottom_margin = Cm(2.54)
        section.left_margin = section.right_margin = Cm(3.18)

    if config.header.strip():
        section.header.paragraphs[0].text = config.header.strip()
    if config.footer.strip():
        section.footer.paragraphs[0].text = config.footer.strip()


def apply_run_style(run, config: FormatConfig, bold: bool = False) -> None:
    run.font.name = config.font or "宋体"
    run.font.size = Pt(parse_font_size(config.fontSize))
    run.bold = bold


def apply_paragraph_style(paragraph, config: FormatConfig) -> None:
    paragraph.alignment = paragraph_alignment(config.align)
    paragraph.paragraph_format.line_spacing = parse_line_spacing(config.lineHeight)
    if "首行" in config.indent:
        paragraph.paragraph_format.first_line_indent = Cm(0.74)


def add_block(document: Document, block: DocumentBlock, config: FormatConfig) -> None:
    if block.type == "heading1":
        paragraph = document.add_heading(block.text, level=1)
        bold = True
    elif block.type == "heading2":
        paragraph = document.add_heading(block.text, level=2)
        bold = True
    elif block.type == "bullet":
        paragraph = document.add_paragraph(style="List Bullet")
        paragraph.add_run(block.text)
        bold = False
    else:
        paragraph = document.add_paragraph()
        paragraph.add_run(block.text)
        bold = False

    apply_paragraph_style(paragraph, config)
    for run in paragraph.runs:
        apply_run_style(run, config, bold=bold)


def build_docx(payload: FormatExportDocxRequest) -> BytesIO:
    document = Document()
    configure_section(document, payload.config)

    title = document.add_heading(payload.title, level=1)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs:
        apply_run_style(run, payload.config, bold=True)

    for block in payload.blocks:
        add_block(document, block, payload.config)

    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer
