import re

from app.prompts.translation import build_extract_terms_prompt, build_summary_prompts, build_translation_prompts
from app.schemas.translation import (
    GlossaryEntry,
    TranslationChunk,
    TranslationDirection,
    TranslationOptions,
    TranslationPair,
)
from app.services.llm_client import RuntimeModelConfig, call_chat_model


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


async def summarize_for_context(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
    glossary: list[GlossaryEntry] | None = None,
    model_config: RuntimeModelConfig | None = None,
) -> str:
    system_prompt, user_prompt = build_summary_prompts(text, direction, options, glossary)
    return await call_chat_model(system_prompt, user_prompt, model_config)


async def translate_text(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
    context_summary: str = "",
    glossary: list[GlossaryEntry] | None = None,
    model_config: RuntimeModelConfig | None = None,
) -> str:
    if not text.strip():
        return ""

    system_prompt, user_prompt = build_translation_prompts(text, direction, options, context_summary, glossary)
    return await call_chat_model(system_prompt, user_prompt, model_config)


async def translate_with_strategy(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
    glossary: list[GlossaryEntry] | None = None,
    model_config: RuntimeModelConfig | None = None,
) -> tuple[str, str, bool, list[TranslationChunk]]:
    use_context = should_use_long_text_strategy(text)

    if use_context:
        context_summary = await summarize_for_context(text, direction, options, glossary, model_config)
        translated_chunks: list[TranslationChunk] = []

        for index, chunk in enumerate(chunk_text(text), start=1):
            translated = await translate_text(chunk, direction, options, context_summary, glossary, model_config)
            translated_chunks.append(TranslationChunk(index=index, source=chunk, target=translated))

        target_text = "\n\n".join(chunk.target for chunk in translated_chunks)
        return target_text, context_summary, True, translated_chunks

    target_text = await translate_text(text, direction, options, glossary=glossary, model_config=model_config)
    chunk = TranslationChunk(index=1, source=text, target=target_text) if text.strip() else None
    return target_text, "", False, [chunk] if chunk else []


from typing import AsyncGenerator


async def translate_with_strategy_stream(
    text: str,
    direction: TranslationDirection,
    options: TranslationOptions,
    glossary: list[GlossaryEntry] | None = None,
    model_config: RuntimeModelConfig | None = None,
) -> AsyncGenerator[dict, None]:
    use_context = should_use_long_text_strategy(text)

    if use_context:
        chunks_text = chunk_text(text)
        total = len(chunks_text)
        yield {"type": "start", "total_chunks": total, "used_context": True}

        context_summary = await summarize_for_context(text, direction, options, glossary, model_config)
        yield {"type": "context_summary", "summary": context_summary}

        translated_chunks: list[TranslationChunk] = []
        for index, chunk_src in enumerate(chunks_text, start=1):
            translated = await translate_text(chunk_src, direction, options, context_summary, glossary, model_config)
            chunk = TranslationChunk(index=index, source=chunk_src, target=translated)
            translated_chunks.append(chunk)
            yield {"type": "chunk", "index": index, "source": chunk_src, "target": translated}

        target_text = "\n\n".join(c.target for c in translated_chunks)
        yield {
            "type": "complete",
            "target_text": target_text,
            "context_summary": context_summary,
            "chunks": [c.model_dump() for c in translated_chunks],
        }
    else:
        yield {"type": "start", "total_chunks": 1, "used_context": False}

        target_text = await translate_text(text, direction, options, glossary=glossary, model_config=model_config)
        chunk = TranslationChunk(index=1, source=text, target=target_text)
        yield {"type": "chunk", "index": 1, "source": text, "target": target_text}
        yield {
            "type": "complete",
            "target_text": target_text,
            "context_summary": "",
            "chunks": [chunk.model_dump()],
        }


async def build_pairs(
    items: list[str],
    direction: TranslationDirection,
    options: TranslationOptions,
    context_summary: str = "",
    glossary: list[GlossaryEntry] | None = None,
    model_config: RuntimeModelConfig | None = None,
) -> list[TranslationPair]:
    pairs: list[TranslationPair] = []
    for item in items:
        pairs.append(TranslationPair(source=item, target=await translate_text(item, direction, options, context_summary, glossary, model_config)))
    return pairs


async def extract_terms(text: str, direction: TranslationDirection, model_config: RuntimeModelConfig | None = None) -> list[GlossaryEntry]:
    system_prompt, user_prompt = build_extract_terms_prompt(text, direction)
    raw = await call_chat_model(system_prompt, user_prompt, model_config)
    import json

    try:
        data = json.loads(raw.strip())
        if isinstance(data, list):
            return [GlossaryEntry(source=item["source"], target=item["target"]) for item in data if "source" in item and "target" in item]
    except (json.JSONDecodeError, KeyError, TypeError):
        pass
    return []
