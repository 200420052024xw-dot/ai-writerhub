import json
from io import BytesIO

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt
from fastapi import HTTPException

from app.prompts.format import FORMAT_CONFIG_FIELDS, build_format_organize_prompts, build_format_parse_prompts
from app.schemas.format import FormatConfig, FormatDocumentParagraph, FormatExportDocxRequest, FormatOrganizeResponse
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

# Mapping from UI select options to canonical keys for normalization
UI_OPTIONS = {
    "font": {
        "宋体": "宋体（SimSun）", "simsun": "宋体（SimSun）", "宋体（simsun）": "宋体（SimSun）",
        "微软雅黑": "微软雅黑", "雅黑": "微软雅黑",
        "黑体": "黑体",
        "仿宋": "仿宋",
        "楷体": "楷体",
    },
    "fontSize": {
        "五号": "五号（10.5pt）", "10.5pt": "五号（10.5pt）", "10.5": "五号（10.5pt）",
        "小四": "小四（12pt）", "12pt": "小四（12pt）", "12": "小四（12pt）",
        "六号": "六号（7.5pt）", "7.5pt": "六号（7.5pt）", "7.5": "六号（7.5pt）",
        "小六": "小六（6.5pt）", "6.5pt": "小六（6.5pt）", "6.5": "小六（6.5pt）",
        "七号": "七号（5.5pt）", "5.5pt": "七号（5.5pt）", "5.5": "七号（5.5pt）",
        "八号": "八号（5pt）", "5pt": "八号（5pt）", "5": "八号（5pt）",
        "三号": "三号（16pt）", "16pt": "三号（16pt）", "16": "三号（16pt）",
        "四号": "四号（14pt）", "14pt": "四号（14pt）", "14": "四号（14pt）",
    },
    "lineHeight": {
        "单倍": "单倍行距", "1": "单倍行距", "1.0": "单倍行距",
        "1.25": "1.25 倍行距",
        "1.5": "1.5 倍行距",
        "双倍": "2 倍行距", "2": "2 倍行距", "2.0": "2 倍行距",
    },
    "indent": {
        "无": "无缩进", "不缩进": "无缩进",
        "首行": "首行缩进 2 字符", "首行缩进": "首行缩进 2 字符", "2字符": "首行缩进 2 字符",
        "左缩进": "左缩进 2 字符",
        "悬挂": "悬挂缩进 2 字符", "悬挂缩进": "悬挂缩进 2 字符",
    },
    "align": {
        "左": "左对齐",
        "居中": "居中对齐", "中间": "居中对齐",
        "右": "右对齐",
        "两端": "两端对齐", "分散": "两端对齐",
    },
    "paperSize": {
        "a4": "A4（21 × 29.7cm）", "A4": "A4（21 × 29.7cm）",
        "a5": "A5（14.8 × 21cm）", "A5": "A5（14.8 × 21cm）",
        "b5": "B5（17.6 × 25cm）", "B5": "B5（17.6 × 25cm）",
        "letter": "Letter（21.6 × 27.9cm）", "Letter": "Letter（21.6 × 27.9cm）",
    },
    "margin": {
        "普通": "普通：上/下 2.54cm，左/右 3.18cm", "标准": "普通：上/下 2.54cm，左/右 3.18cm",
        "默认": "普通：上/下 2.54cm，左/右 3.18cm",
        "窄": "窄边距：上/下/左/右 1.27cm", "窄边距": "窄边距：上/下/左/右 1.27cm",
        "小": "窄边距：上/下/左/右 1.27cm",
    },
}


def _normalize_field(key: str, value: str) -> str:
    """Map LLM free-form value to the closest UI option string."""
    options = UI_OPTIONS.get(key)
    if not options or not isinstance(options, dict):
        return value

    # Direct match (case-insensitive)
    value_lower = value.strip().lower()
    for k, v in options.items():
        if k.lower() == value_lower:
            return v

    # Substring match
    for k, v in options.items():
        if k.lower() in value_lower or value_lower in k.lower():
            return v

    return value


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
    extra_parts: list[str] = []
    existing_extra = current.get("extraRequirements", "")
    if existing_extra:
        extra_parts.append(existing_extra)

    for key in FORMAT_CONFIG_FIELDS:
        value = parsed.get(key)
        if not isinstance(value, str) or not value.strip():
            continue

        normalized = _normalize_field(key, value.strip())

        # For select-based fields, only accept if normalized value matches a known option
        if key in UI_OPTIONS:
            options = UI_OPTIONS[key]
            if normalized in options.values():
                current[key] = normalized
            else:
                # Value doesn't match any option, add to extraRequirements
                extra_parts.append(f"{key}: {value.strip()}")
        elif key == "extraRequirements":
            extra_parts.append(value.strip())
        else:
            # Free-text fields: headingStyle, header, footer
            current[key] = normalized

    if extra_parts:
        current["extraRequirements"] = "；".join(extra_parts)

    return FormatConfig(**current)


def normalize_east_asia_font(value: str) -> str:
    """Normalize frontend font name to standard Chinese font name for OOXML w:eastAsia."""
    if not value:
        return "宋体"

    value = value.strip()

    if "宋体" in value or "SimSun" in value or "simsun" in value:
        return "宋体"
    if "微软雅黑" in value or "雅黑" in value:
        return "微软雅黑"
    if "黑体" in value:
        return "黑体"
    if "仿宋" in value:
        return "仿宋"
    if "楷体" in value:
        return "楷体"

    return "宋体"


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

    if "窄" in config.margin or "窄" in config.extraRequirements:
        section.top_margin = section.bottom_margin = section.left_margin = section.right_margin = Cm(1.27)
    else:
        section.top_margin = section.bottom_margin = Cm(2.54)
        section.left_margin = section.right_margin = Cm(3.18)

    if config.header.strip():
        section.header.paragraphs[0].text = config.header.strip()
    if config.footer.strip():
        section.footer.paragraphs[0].text = config.footer.strip()


def apply_run_font(run, east_asia_font: str, ascii_font: str, size_pt: float, bold: bool = False) -> None:
    """Set run font with full OOXML control for both Chinese and Western characters."""
    run.font.name = ascii_font
    run.font.size = Pt(size_pt)
    run.bold = bold

    r_pr = run._element.get_or_add_rPr()
    r_fonts = r_pr.rFonts
    if r_fonts is None:
        r_fonts = r_pr.get_or_add_rFonts()

    r_fonts.set(qn("w:eastAsia"), east_asia_font)
    r_fonts.set(qn("w:ascii"), ascii_font)
    r_fonts.set(qn("w:hAnsi"), ascii_font)
    r_fonts.set(qn("w:cs"), ascii_font)


def apply_paragraph_style(paragraph, config: FormatConfig) -> None:
    paragraph.alignment = paragraph_alignment(config.align)
    paragraph.paragraph_format.line_spacing = parse_line_spacing(config.lineHeight)
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)

    indent = config.indent or ""
    if "首行" in indent:
        paragraph.paragraph_format.first_line_indent = Cm(0.74)
    elif "左缩进" in indent:
        paragraph.paragraph_format.left_indent = Cm(0.74)
    elif "悬挂" in indent:
        paragraph.paragraph_format.first_line_indent = Cm(-0.74)
        paragraph.paragraph_format.left_indent = Cm(0.74)


def add_heading_paragraph(document: Document, block: FormatDocumentParagraph) -> None:
    """Add a heading paragraph with manual formatting (no built-in heading style)."""
    paragraph = document.add_paragraph()
    run = paragraph.add_run(block.content or "")

    level = max(1, min(4, block.level or 1))

    if level == 1:
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        size_pt = 16
    elif level == 2:
        paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
        size_pt = 14
    else:
        paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
        size_pt = 12

    paragraph.paragraph_format.space_before = Pt(12)
    paragraph.paragraph_format.space_after = Pt(6)

    apply_run_font(run, east_asia_font="黑体", ascii_font="Times New Roman", size_pt=size_pt, bold=True)


def add_paragraph(document: Document, block: FormatDocumentParagraph, config: FormatConfig) -> None:
    if block.type == "title":
        return

    if block.type == "heading":
        add_heading_paragraph(document, block)
        return

    if block.type == "list":
        paragraph = document.add_paragraph(style="List Bullet")
        run = paragraph.add_run(block.content or "")
        apply_paragraph_style(paragraph, config)
        east_asia_font = normalize_east_asia_font(config.font)
        size_pt = parse_font_size(config.fontSize)
        apply_run_font(run, east_asia_font, "Times New Roman", size_pt, bold=False)
        return

    # paragraph / table / default
    paragraph = document.add_paragraph()
    run = paragraph.add_run(block.content or "")
    apply_paragraph_style(paragraph, config)
    east_asia_font = normalize_east_asia_font(config.font)
    size_pt = parse_font_size(config.fontSize)
    apply_run_font(run, east_asia_font, "Times New Roman", size_pt, bold=False)


async def organize_document(
    paragraphs: list[FormatDocumentParagraph],
    config: FormatConfig,
    model_config: RuntimeModelConfig,
) -> FormatOrganizeResponse:
    system_prompt, user_prompt = build_format_organize_prompts(
        [paragraph.model_dump() for paragraph in paragraphs],
        config.model_dump(),
    )
    raw = await call_chat_model(system_prompt, user_prompt, model_config)
    content = raw.strip()
    if content.startswith("```"):
        content = content.strip("`").removeprefix("json").strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="模型未返回有效 JSON") from exc

    paragraph_data = parsed.get("paragraphs", [])
    if not isinstance(paragraph_data, list):
        raise HTTPException(status_code=502, detail="Model response is missing the paragraphs array")
    try:
        organized = [FormatDocumentParagraph(**item) for item in paragraph_data]
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Model returned invalid structured paragraphs") from exc

    expected_ids = [paragraph.paragraph_id for paragraph in paragraphs]
    returned_ids = [paragraph.paragraph_id for paragraph in organized]
    if returned_ids != expected_ids:
        raise HTTPException(status_code=502, detail="Model changed paragraph IDs or paragraph order")
    if len(set(returned_ids)) != len(returned_ids):
        raise HTTPException(status_code=502, detail="Model returned duplicate paragraph IDs")
    for paragraph in organized:
        if paragraph.type == "title" and paragraph.level != 0:
            raise HTTPException(status_code=502, detail="Model returned an invalid title level")
        if paragraph.type == "heading" and paragraph.level == 0:
            raise HTTPException(status_code=502, detail="Model returned an invalid heading level")
    return FormatOrganizeResponse(paragraphs=organized)


def build_docx(payload: FormatExportDocxRequest) -> BytesIO:
    document = Document()
    configure_section(document, payload.config)

    # Document title: centered, bold, 黑体, Times New Roman, 16pt
    title_para = document.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_para.paragraph_format.space_before = Pt(12)
    title_para.paragraph_format.space_after = Pt(6)
    title_run = title_para.add_run(payload.title)
    apply_run_font(title_run, east_asia_font="黑体", ascii_font="Times New Roman", size_pt=16, bold=True)

    for paragraph in payload.paragraphs:
        add_paragraph(document, paragraph, payload.config)

    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer
