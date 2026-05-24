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
    system_prompt = (
        "你是文档格式配置解析器。只返回 JSON，不要 Markdown，不要解释。"
        f"JSON 只能包含这些字段：{', '.join(FORMAT_CONFIG_FIELDS)}。"
        "根据用户描述抽取文档格式配置；无法确定的字段返回空字符串。"
        "常用中文文档格式可以使用：宋体（SimSun）、小四（12pt）、1.5 倍行距、首行缩进 2 字符、两端对齐、A4（21 × 29.7cm）。"
    )
    user_prompt = json.dumps(
        {
            "format_request": prompt,
            "current_config": current_config,
        },
        ensure_ascii=False,
    )
    return system_prompt, user_prompt
