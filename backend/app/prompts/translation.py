from app.schemas.translation import TranslationDirection, TranslationOptions


def target_language(direction: TranslationDirection) -> str:
    return "英文" if direction == "zh-en" else "中文"


def source_language(direction: TranslationDirection) -> str:
    return "中文" if direction == "zh-en" else "英文"


def translation_style_instruction(options: TranslationOptions) -> str:
    instructions: list[str] = []
    if options.academic_style:
        instructions.append("在适合的地方使用学术、准确、严谨的表达")
    if options.business_style:
        instructions.append("商务和产品术语保持专业")
    if options.natural_tone:
        instructions.append("译文自然流畅，符合目标语言表达习惯")
    if options.unified_terms:
        instructions.append("全文术语保持一致")
    if options.preserve_names:
        instructions.append("保留产品名、专有名词、Markdown 结构、标题、列表和代码块")
    return "；".join(instructions) or "准确翻译原文"


def build_summary_prompts(text: str, direction: TranslationDirection, options: TranslationOptions) -> tuple[str, str]:
    system_prompt = (
        "你是翻译规划助手。你的任务是通读全文，为后续分块翻译生成上下文概要。"
        "只输出概要，不要翻译全文，不要解释过程。"
    )
    user_prompt = (
        f"请通读以下{source_language(direction)}文本，提炼其主题、关键术语、语气、专有名词、上下文关系，"
        f"并给出后续翻译为{target_language(direction)}时必须遵守的约束。\n"
        f"翻译风格要求：{translation_style_instruction(options)}。\n\n"
        f"全文如下：\n{text}"
    )
    return system_prompt, user_prompt


def build_translation_prompts(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
    context_summary: str = "",
) -> tuple[str, str]:
    system_prompt = (
        f"你是专业翻译。请将{source_language(direction)}翻译为{target_language(direction)}。"
        "只输出译文，不要解释，不要添加说明。必须保留 Markdown 结构。"
    )
    context_part = f"全文上下文概要，用于保持术语和语气一致：\n{context_summary}\n\n" if context_summary else ""
    user_prompt = (
        f"{context_part}"
        f"翻译要求：{translation_style_instruction(options)}。\n\n"
        f"待翻译文本：\n{text}"
    )
    return system_prompt, user_prompt
