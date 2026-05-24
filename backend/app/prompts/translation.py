from app.schemas.translation import GlossaryEntry, TranslationDirection, TranslationOptions


def target_language(direction: TranslationDirection) -> str:
    return "英文" if direction == "zh-en" else "中文"


def source_language(direction: TranslationDirection) -> str:
    return "中文" if direction == "zh-en" else "英文"


def glossary_instruction(glossary: list[GlossaryEntry]) -> str:
    if not glossary:
        return ""
    lines = [f"  {entry.source} → {entry.target}" for entry in glossary]
    return "以下术语必须使用指定译法：\n" + "\n".join(lines)


def translation_style_instruction(options: TranslationOptions, glossary: list[GlossaryEntry] | None = None) -> str:
    instructions: list[str] = []
    if options.style == "academic":
        instructions.append("在适合的地方使用学术、准确、严谨的表达")
    elif options.style == "business":
        instructions.append("商务和产品术语保持专业")
    elif options.style == "natural":
        instructions.append("译文自然流畅，符合目标语言表达习惯")
    if options.unified_terms:
        instructions.append("全文术语保持一致")
    if options.preserve_names:
        instructions.append("保留产品名、专有名词、Markdown 结构、标题、列表和代码块")
    if options.custom_requirements.strip():
        instructions.append(options.custom_requirements.strip())
    if glossary:
        instructions.append(glossary_instruction(glossary))
    return "；".join(instructions) or "准确翻译原文"


def build_summary_prompts(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
    glossary: list[GlossaryEntry] | None = None,
) -> tuple[str, str]:
    system_prompt = (
        "你是翻译规划助手。你的任务是通读全文，为后续分块翻译生成上下文概要。"
        "只输出概要，不要翻译全文，不要解释过程。"
    )
    user_prompt = (
        f"请通读以下{source_language(direction)}文本，提炼其主题、关键术语、语气、专有名词、上下文关系，"
        f"并给出后续翻译为{target_language(direction)}时必须遵守的约束。\n"
        f"翻译风格要求：{translation_style_instruction(options, glossary)}。\n\n"
        f"全文如下：\n{text}"
    )
    return system_prompt, user_prompt


def build_translation_prompts(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
    context_summary: str = "",
    glossary: list[GlossaryEntry] | None = None,
) -> tuple[str, str]:
    system_prompt = (
        f"你是专业翻译。请将{source_language(direction)}翻译为{target_language(direction)}。"
        "只输出译文，不要解释，不要添加说明。必须保留 Markdown 结构。"
    )
    context_part = f"全文上下文概要，用于保持术语和语气一致：\n{context_summary}\n\n" if context_summary else ""
    user_prompt = (
        f"{context_part}"
        f"翻译要求：{translation_style_instruction(options, glossary)}。\n\n"
        f"待翻译文本：\n{text}"
    )
    return system_prompt, user_prompt


def build_extract_terms_prompt(text: str, direction: TranslationDirection) -> tuple[str, str]:
    system_prompt = (
        "你是术语分析助手。你的任务是从文本中提取专业术语和固定表达，并给出它们的标准译法。"
        "只输出 JSON 格式的术语列表，不要解释。"
    )
    user_prompt = (
        f"请从以下{source_language(direction)}文本中提取专业术语、行业用语、固定表达，"
        f"并给出对应的{target_language(direction)}译法。\n"
        f"输出格式为 JSON 数组，每项包含 source 和 target 字段。例如：\n"
        f'[{{"source": "产品需求文档", "target": "PRD"}}]\n\n'
        f"只输出 JSON 数组，不要其他内容。\n\n"
        f"文本如下：\n{text}"
    )
    return system_prompt, user_prompt
