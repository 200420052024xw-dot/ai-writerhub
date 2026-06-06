import json


FORMAT_CONFIG_FIELDS = [
    "font",
    "fontSize",
    "lineHeight",
    "indent",
    "align",
    "paperSize",
    "headingStyle",
    "margin",
    "header",
    "footer",
    "extraRequirements",
]


def build_format_parse_prompts(prompt: str, current_config: dict) -> tuple[str, str]:
    valid_options = {
        "font": ["宋体（SimSun）", "微软雅黑", "黑体", "仿宋", "楷体"],
        "fontSize": ["五号（10.5pt）", "小四（12pt）", "六号（7.5pt）", "小六（6.5pt）", "七号（5.5pt）", "八号（5pt）"],
        "lineHeight": ["单倍行距", "1.25 倍行距", "1.5 倍行距", "2 倍行距"],
        "indent": ["无缩进", "首行缩进 2 字符", "左缩进 2 字符", "悬挂缩进 2 字符"],
        "align": ["左对齐", "居中对齐", "右对齐", "两端对齐"],
        "paperSize": ["A4（21 × 29.7cm）", "A5（14.8 × 21cm）", "B5（17.6 × 25cm）", "Letter（21.6 × 27.9cm）"],
        "margin": ["普通：上/下 2.54cm，左/右 3.18cm", "窄边距：上/下/左/右 1.27cm"],
    }
    system_prompt = (
        "You parse natural-language document formatting requirements. Return JSON only, without Markdown or explanation. "
        f"The JSON may only contain these fields: {', '.join(FORMAT_CONFIG_FIELDS)}. "
        "Only populate fields explicitly requested by the user; return an empty string for unspecified fields. "
        "For fields with predefined options, choose the closest exact option. "
        "headingStyle, header, footer, and extraRequirements are free text."
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
