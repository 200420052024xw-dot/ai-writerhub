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


LONG_TEXT_THRESHOLD = 1200
CHUNK_TARGET_SIZE = 1600
CHUNK_HARD_LIMIT = 2200
LONG_PARAGRAPH_SIZE = 900


def split_paragraphs(text: str) -> list[str]:
    normalized = text.replace("\r\n", "\n").strip()
    if not normalized:
        return []
    paragraphs: list[str] = []
    current: list[str] = []
    for line in normalized.split("\n"):
        if line.strip():
            current.append(line.rstrip())
            continue
        if current:
            paragraphs.append("\n".join(current).strip())
            current = []
    if current:
        paragraphs.append("\n".join(current).strip())
    if len(paragraphs) <= 1:
        line_paragraphs = [line.strip() for line in normalized.split("\n") if line.strip()]
        if len(line_paragraphs) > 1:
            return line_paragraphs
    return paragraphs


def split_blank_paragraphs(text: str) -> list[str]:
    normalized = text.replace("\r\n", "\n").strip()
    if not normalized:
        return []
    return [paragraph.strip() for paragraph in re.split(r"\n\s*\n+", normalized) if paragraph.strip()]


def split_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text.strip())
    if not normalized:
        return []
    sentences = re.findall(r"[^。！？!?；;.]+[。！？!?；;.]?", normalized)
    return [sentence.strip() for sentence in sentences if sentence.strip()]


def should_use_long_text_strategy(text: str) -> bool:
    units = split_translation_units(text)
    return len(text.strip()) > LONG_TEXT_THRESHOLD or len(units) >= 6 or any(len(unit) > LONG_PARAGRAPH_SIZE for unit in units)


def chunk_text(text: str, target_size: int = CHUNK_TARGET_SIZE) -> list[str]:
    units = split_translation_units(text)
    if not units:
        return []

    chunks: list[str] = []
    current = ""

    for unit in units:
        candidate = f"{current}\n\n{unit}".strip() if current else unit
        if (len(candidate) > target_size or len(candidate) > CHUNK_HARD_LIMIT) and current:
            chunks.append(current)
            current = unit
        else:
            current = candidate

    if current:
        chunks.append(current)

    return chunks


def split_long_paragraph(paragraph: str, target_size: int = LONG_PARAGRAPH_SIZE) -> list[str]:
    if len(paragraph) <= target_size:
        return [paragraph]
    sentences = split_sentences(paragraph)
    if len(sentences) <= 1:
        return [paragraph[index : index + target_size].strip() for index in range(0, len(paragraph), target_size) if paragraph[index : index + target_size].strip()]
    parts: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current}{sentence}".strip() if current else sentence
        if len(candidate) > target_size and current:
            parts.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        parts.append(current)
    return parts


def split_translation_units(text: str) -> list[str]:
    units: list[str] = []
    for paragraph in split_paragraphs(text):
        units.extend(split_long_paragraph(paragraph))
    return units


def align_pairs(source_units: list[str], target_text: str) -> list[TranslationPair]:
    source_blank_paragraphs = split_blank_paragraphs("\n\n".join(source_units))
    target_blank_paragraphs = split_blank_paragraphs(target_text)
    if source_blank_paragraphs and len(source_blank_paragraphs) == len(target_blank_paragraphs):
        return [TranslationPair(source=source, target=target) for source, target in zip(source_blank_paragraphs, target_blank_paragraphs)]
    targets = split_paragraphs(target_text)
    if len(targets) == len(source_units):
        return [TranslationPair(source=source, target=target) for source, target in zip(source_units, targets)]
    if len(source_units) == 1:
        return [TranslationPair(source=source_units[0], target=target_text.strip())]
    return [TranslationPair(source="\n\n".join(source_units), target=target_text.strip())]


def sentence_pairs_from_paragraph_pairs(paragraph_pairs: list[TranslationPair]) -> list[TranslationPair]:
    pairs: list[TranslationPair] = []
    for pair in paragraph_pairs:
        source_sentences = split_sentences(pair.source)
        target_sentences = split_sentences(pair.target)
        if len(source_sentences) == len(target_sentences):
            pairs.extend(TranslationPair(source=source, target=target) for source, target in zip(source_sentences, target_sentences))
    return pairs


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
            paragraph_pairs = align_pairs(split_translation_units(chunk), translated)
            translated_chunks.append(
                TranslationChunk(
                    index=index,
                    source=chunk,
                    target=translated,
                    paragraph_pairs=paragraph_pairs,
                    sentence_pairs=sentence_pairs_from_paragraph_pairs(paragraph_pairs),
                )
            )

        target_text = "\n\n".join(chunk.target for chunk in translated_chunks)
        return target_text, context_summary, True, translated_chunks

    target_text = await translate_text(text, direction, options, glossary=glossary, model_config=model_config)
    paragraph_pairs = align_pairs(split_translation_units(text), target_text)
    chunk = (
        TranslationChunk(
            index=1,
            source=text,
            target=target_text,
            paragraph_pairs=paragraph_pairs,
            sentence_pairs=sentence_pairs_from_paragraph_pairs(paragraph_pairs),
        )
        if text.strip()
        else None
    )
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
            paragraph_pairs = align_pairs(split_translation_units(chunk_src), translated)
            chunk = TranslationChunk(
                index=index,
                source=chunk_src,
                target=translated,
                paragraph_pairs=paragraph_pairs,
                sentence_pairs=sentence_pairs_from_paragraph_pairs(paragraph_pairs),
            )
            translated_chunks.append(chunk)
            yield {
                "type": "chunk",
                "index": index,
                "source": chunk_src,
                "target": translated,
                "paragraph_pairs": [pair.model_dump() for pair in chunk.paragraph_pairs],
                "sentence_pairs": [pair.model_dump() for pair in chunk.sentence_pairs],
            }

        target_text = "\n\n".join(c.target for c in translated_chunks)
        paragraph_pairs = [pair for chunk in translated_chunks for pair in chunk.paragraph_pairs]
        sentence_pairs = [pair for chunk in translated_chunks for pair in chunk.sentence_pairs]
        yield {
            "type": "complete",
            "target_text": target_text,
            "context_summary": context_summary,
            "chunks": [c.model_dump() for c in translated_chunks],
            "paragraph_pairs": [pair.model_dump() for pair in paragraph_pairs],
            "sentence_pairs": [pair.model_dump() for pair in sentence_pairs],
        }
    else:
        yield {"type": "start", "total_chunks": 1, "used_context": False}

        target_text = await translate_text(text, direction, options, glossary=glossary, model_config=model_config)
        paragraph_pairs = align_pairs(split_translation_units(text), target_text)
        chunk = TranslationChunk(
            index=1,
            source=text,
            target=target_text,
            paragraph_pairs=paragraph_pairs,
            sentence_pairs=sentence_pairs_from_paragraph_pairs(paragraph_pairs),
        )
        yield {
            "type": "chunk",
            "index": 1,
            "source": text,
            "target": target_text,
            "paragraph_pairs": [pair.model_dump() for pair in chunk.paragraph_pairs],
            "sentence_pairs": [pair.model_dump() for pair in chunk.sentence_pairs],
        }
        yield {
            "type": "complete",
            "target_text": target_text,
            "context_summary": "",
            "chunks": [chunk.model_dump()],
            "paragraph_pairs": [pair.model_dump() for pair in chunk.paragraph_pairs],
            "sentence_pairs": [pair.model_dump() for pair in chunk.sentence_pairs],
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
