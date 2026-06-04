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
    }
    system_prompt = (
        "你是文档格式配置解析器。只返回 JSON，不要 Markdown，不要解释。\n"
        f"JSON 只能包含这些字段：{', '.join(FORMAT_CONFIG_FIELDS)}。\n"
        "关键规则：\n"
        "1. 只解析用户明确提到的格式要求，未提及的字段必须返回空字符串 \"\"\n"
        "2. 以下字段的值必须从预定义选项中选取最接近的：\n"
        + json.dumps(valid_options, ensure_ascii=False, indent=2) + "\n"
        "3. headingStyle、header、footer 为自由文本字段\n"
        "4. margin 字段从 [\"普通：上/下 2.54cm，左/右 3.18cm\", \"窄边距：上/下/左/右 1.27cm\"] 中选择\n"
        "5. 用户的格式要求中如果有无法归入以上字段的内容，请填入 extraRequirements 字段"
    )
    user_prompt = json.dumps(
        {
            "format_request": prompt,
            "current_config": current_config,
        },
        ensure_ascii=False,
    )
    return system_prompt, user_prompt


def build_format_organize_prompts(raw_text: str, config: dict) -> tuple[str, str]:
    system_prompt = (
        "你是文档结构整理助手。根据原始文本的语义，将内容重新组织为结构化的文档块。"
        "只返回 JSON，不要 Markdown 代码块，不要任何解释。"
        "JSON 格式：{\"blocks\": [{\"type\": \"heading1|heading2|paragraph|bullet\", \"text\": \"...\"}]}"
        "规则：\n"
        "1. 根据语义识别标题层级（heading1 为一级标题，heading2 为二级标题）\n"
        "2. 将碎片化的换行合并为完整段落（paragraph）\n"
        "3. 识别并列结构为列表项（bullet）\n"
        "4. 清理多余空白和空行\n"
        "5. 统一中英文标点（中文用全角，英文用半角）\n"
        "6. 不要改变原文的语义和内容\n"
        "7. 不要将文档总标题作为 block 输出"
    )
    user_prompt = json.dumps(
        {
            "raw_text": raw_text,
            "format_requirements": config,
        },
        ensure_ascii=False,
    )
    return system_prompt, user_prompt
