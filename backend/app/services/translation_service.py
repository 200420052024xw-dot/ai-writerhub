import re

from app.prompts.translation import build_summary_prompts, build_translation_prompts
from app.schemas.translation import TranslationChunk, TranslationDirection, TranslationOptions, TranslationPair
from app.services.llm_client import call_chat_model


LONG_TEXT_THRESHOLD = 700
CHUNK_TARGET_SIZE = 1200


def split_paragraphs(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"\n\s*\n", text.strip()) if part.strip()]


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[。！？.!?])\s+|(?<=[。！？])", text.strip())
    return [part.strip() for part in parts if part.strip()]


def should_use_long_text_strategy(text: str) -> bool:
    return len(text.strip()) >= LONG_TEXT_THRESHOLD or len(split_paragraphs(text)) >= 4


def chunk_text(text: str, target_size: int = CHUNK_TARGET_SIZE) -> list[str]:
    paragraphs = split_paragraphs(text)
    if not paragraphs:
        return []

    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) > target_size and current:
            chunks.append(current)
            current = paragraph
        else:
            current = candidate

    if current:
        chunks.append(current)

    return chunks


async def summarize_for_context(text: str, direction: TranslationDirection, options: TranslationOptions) -> str:
    system_prompt, user_prompt = build_summary_prompts(text, direction, options)
    return await call_chat_model(system_prompt, user_prompt)


async def translate_text(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
    context_summary: str = "",
) -> str:
    if not text.strip():
        return ""

    system_prompt, user_prompt = build_translation_prompts(text, direction, options, context_summary)
    return await call_chat_model(system_prompt, user_prompt)


async def translate_with_strategy(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
) -> tuple[str, str, bool, list[TranslationChunk]]:
    use_context = should_use_long_text_strategy(text)

    if use_context:
        context_summary = await summarize_for_context(text, direction, options)
        translated_chunks: list[TranslationChunk] = []

        for index, chunk in enumerate(chunk_text(text), start=1):
            translated = await translate_text(chunk, direction, options, context_summary)
            translated_chunks.append(TranslationChunk(index=index, source=chunk, target=translated))

        target_text = "\n\n".join(chunk.target for chunk in translated_chunks)
        return target_text, context_summary, True, translated_chunks

    target_text = await translate_text(text, direction, options)
    chunk = TranslationChunk(index=1, source=text, target=target_text) if text.strip() else None
    return target_text, "", False, [chunk] if chunk else []


async def build_pairs(
    items: list[str],
    direction: TranslationDirection,
    options: TranslationOptions,
    context_summary: str = "",
) -> list[TranslationPair]:
    pairs: list[TranslationPair] = []
    for item in items:
        pairs.append(TranslationPair(source=item, target=await translate_text(item, direction, options, context_summary)))
    return pairs
