import json


FONT_OPTIONS = ["宋体（SimSun）", "微软雅黑", "黑体", "仿宋", "楷体"]
FONT_SIZE_OPTIONS = [
    "初号（42pt）", "小初（36pt）", "一号（26pt）", "小一（24pt）",
    "二号（22pt）", "小二（18pt）", "三号（16pt）", "小三（15pt）",
    "四号（14pt）", "小四（12pt）", "五号（10.5pt）", "小五（9pt）",
    "六号（7.5pt）", "小六（6.5pt）", "七号（5.5pt）", "八号（5pt）",
]

# String fields that can be parsed from natural language
FORMAT_STRING_FIELDS = [
    "bodyFont", "bodyFontSize",
    "titleFont", "titleFontSize",
    "h1Font", "h1FontSize",
    "h2Font", "h2FontSize",
    "h3Font", "h3FontSize",
    "lineHeight", "indent", "align",
    "paperSize", "orientation", "margin",
    "header", "footer", "extraRequirements",
]

# Boolean fields for bold toggles
FORMAT_BOOL_FIELDS = ["bodyBold", "titleBold", "h1Bold", "h2Bold", "h3Bold"]


def build_format_parse_prompts(prompt: str, current_config: dict) -> tuple[str, str]:
    valid_options = {
        "font": FONT_OPTIONS,
        "fontSize": FONT_SIZE_OPTIONS,
        "lineHeight": ["单倍行距", "1.25 倍行距", "1.5 倍行距", "2 倍行距"],
        "indent": ["无缩进", "首行缩进 2 字符", "左缩进 2 字符", "悬挂缩进 2 字符"],
        "align": ["左对齐", "居中对齐", "右对齐", "两端对齐"],
        "paperSize": ["A4（21 × 29.7cm）", "A5（14.8 × 21cm）", "B5（17.6 × 25cm）", "Letter（21.6 × 27.9cm）"],
        "orientation": ["纵向", "横向"],
        "margin": ["普通：上/下 2.54cm，左/右 3.18cm", "窄边距：上/下/左/右 1.27cm"],
    }
    system_prompt = (
        "You parse natural-language document formatting requirements into a structured config. "
        "Return JSON only, no Markdown.\n\n"
        "The config has these groups:\n"
        "- body: bodyFont (font name), bodyFontSize (size label), bodyBold (boolean)\n"
        "- title: titleFont, titleFontSize, titleBold (boolean) - for the document main title\n"
        "- h1: h1Font, h1FontSize, h1Bold (boolean) - for level-1 headings\n"
        "- h2: h2Font, h2FontSize, h2Bold (boolean) - for level-2 headings\n"
        "- h3: h3Font, h3FontSize, h3Bold (boolean) - for level-3 headings\n"
        "- page: lineHeight, indent, align, paperSize, margin, header, footer, extraRequirements\n\n"
        "Font options: 宋体（SimSun）, 微软雅黑, 黑体, 仿宋, 楷体\n"
        "Font size options: 初号（42pt）, 小初（36pt）, 一号（26pt）, 小一（24pt）, 二号（22pt）, 小二（18pt）, 三号（16pt）, 小三（15pt）, 四号（14pt）, 小四（12pt）, 五号（10.5pt）, 小五（9pt）, 六号（7.5pt）, 小六（6.5pt）, 七号（5.5pt）, 八号（5pt）\n"
        "LineHeight options: 单倍行距, 1.25 倍行距, 1.5 倍行距, 2 倍行距\n"
        "Indent options: 无缩进, 首行缩进 2 字符, 左缩进 2 字符, 悬挂缩进 2 字符\n"
        "Align options: 左对齐, 居中对齐, 右对齐, 两端对齐\n"
        "PaperSize options: A4（21 × 29.7cm）, A5（14.8 × 21cm）, B5（17.6 × 25cm）, Letter（21.6 × 27.9cm）\n"
        "Margin options: 普通：上/下 2.54cm，左/右 3.18cm, 窄边距：上/下/左/右 1.27cm\n\n"
        "Only populate fields the user explicitly mentioned. "
        "For font/size fields, return empty string if not mentioned. "
        "For bold fields, return true/false only if the user mentioned bold/加粗 for that level. "
        "For header/footer/extraRequirements, they are free text."
    )
    user_prompt = json.dumps(
        {
            "format_request": prompt,
            "current_config": current_config,
            "valid_options": valid_options,
        },
        ensure_ascii=False,
    )
    return system_prompt, user_prompt


def build_format_organize_prompts(paragraphs: list[dict], config: dict) -> tuple[str, str]:
    system_prompt = (
        "You are a document structure organizer. The input is an ordered JSON array of stored document paragraphs. "
        "Return ONLY valid JSON with this shape: "
        '{"paragraphs":[{"paragraph_id":"...","type":"title|heading|paragraph|list|table","level":0,"content":"..."}]}. '
        "Every input paragraph_id must appear exactly once in the output. Preserve the exact IDs and input order. "
        "Do not add, delete, merge, split, duplicate, or reorder paragraphs. "
        "You may correct paragraph type and heading level, remove redundant whitespace, normalize punctuation, and lightly clean content "
        "without changing meaning. title uses level 0; heading uses level 1-4; other types retain their current section level. "
        "Return no Markdown fences and no explanation."
    )
    user_prompt = json.dumps(
        {
            "paragraphs": paragraphs,
            "format_requirements": config,
        },
        ensure_ascii=False,
    )
    return system_prompt, user_prompt
