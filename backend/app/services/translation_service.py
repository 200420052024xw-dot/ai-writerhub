import json
import re
from collections import defaultdict

from app.prompts.translation import build_extract_terms_prompt, build_structured_translation_prompts, build_summary_prompts
from app.schemas.translation import (
    GlossaryEntry,
    TranslationChunk,
    TranslationDirection,
    TranslationOptions,
    TranslationPair,
    TranslationSourceParagraph,
)
from app.services.llm_client import RuntimeModelConfig, call_chat_model


LONG_TEXT_THRESHOLD = 1200
CHUNK_TARGET_SIZE = 1600
CHUNK_HARD_LIMIT = 2200
LONG_PARAGRAPH_SIZE = 900
STRUCTURED_UNIT_TARGET_SIZE = 1800


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


def paragraph_to_text(paragraph: TranslationSourceParagraph) -> str:
    content = paragraph.content.strip()
    if not content:
        return ""
    if paragraph.type == "title":
        return f"# {content}".strip()
    if paragraph.type == "heading":
        return f"{'#' * max(2, min(5, paragraph.level + 1))} {content}".strip()
    return content


def source_text_from_paragraphs(paragraphs: list[TranslationSourceParagraph]) -> str:
    return "\n\n".join(text for text in (paragraph_to_text(paragraph) for paragraph in paragraphs) if text.strip())


def split_sentences_stable(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text.strip())
    if not normalized:
        return []
    sentences = re.findall(r"[^。！？!?；;?.]+[。！？!?；;?.]?", normalized)
    return [sentence.strip() for sentence in sentences if sentence.strip()]


def chunk_structured_units(units: list[dict], target_size: int = STRUCTURED_UNIT_TARGET_SIZE) -> list[list[dict]]:
    chunks: list[list[dict]] = []
    current: list[dict] = []
    current_size = 0
    for unit in units:
        text_size = len(unit.get("text", ""))
        if current and current_size + text_size > target_size:
            chunks.append(current)
            current = [unit]
            current_size = text_size
        else:
            current.append(unit)
            current_size += text_size
    if current:
        chunks.append(current)
    return chunks


def build_paragraph_units(paragraphs: list[TranslationSourceParagraph]) -> list[dict]:
    units: list[dict] = []
    for paragraph in paragraphs:
        text = paragraph_to_text(paragraph)
        if not text.strip():
            continue
        units.append(
            {
                "id": paragraph.id,
                "paragraph_id": paragraph.id,
                "type": paragraph.type,
                "level": paragraph.level,
                "text": text,
            }
        )
    return units


def build_sentence_units(paragraphs: list[TranslationSourceParagraph]) -> list[dict]:
    units: list[dict] = []
    for paragraph in paragraphs:
        text = paragraph_to_text(paragraph)
        if not text.strip():
            continue
        sentences = split_sentences_stable(text) or [text]
        for index, sentence in enumerate(sentences):
            units.append(
                {
                    "id": f"{paragraph.id}:{index}",
                    "paragraph_id": paragraph.id,
                    "sentence_index": index,
                    "type": paragraph.type,
                    "level": paragraph.level,
                    "text": sentence,
                }
            )
    return units


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
            pairs.extend(
                TranslationPair(source=source, target=target, paragraph_id=pair.paragraph_id, sentence_index=index)
                for index, (source, target) in enumerate(zip(source_sentences, target_sentences))
            )
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


def extract_json_array(raw: str) -> list[dict]:
    content = raw.strip()
    if content.startswith("```"):
        content = content.strip("`").removeprefix("json").strip()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        start = content.find("[")
        end = content.rfind("]")
        if start < 0 or end < start:
            raise
        data = json.loads(content[start : end + 1])
    if not isinstance(data, list):
        raise ValueError("structured translation response must be a JSON array")
    return [item for item in data if isinstance(item, dict)]


async def translate_structured_unit_chunk(
    units: list[dict],
    direction: TranslationDirection,
    options: TranslationOptions,
    context_summary: str = "",
    glossary: list[GlossaryEntry] | None = None,
    model_config: RuntimeModelConfig | None = None,
) -> dict[str, str]:
    if not units:
        return {}
    system_prompt, user_prompt = build_structured_translation_prompts(units, direction, options, context_summary, glossary)
    raw = await call_chat_model(system_prompt, user_prompt, model_config)
    items = extract_json_array(raw)
    translated: dict[str, str] = {}
    for item in items:
        unit_id = str(item.get("id", "")).strip()
        text = item.get("text")
        if unit_id and isinstance(text, str):
            translated[unit_id] = text.strip()
    missing_ids = [unit["id"] for unit in units if unit["id"] not in translated]
    if missing_ids:
        raise ValueError(f"structured translation response missed ids: {', '.join(missing_ids)}")
    return translated


def paragraph_pairs_from_structured_units(units: list[dict], translated: dict[str, str]) -> list[TranslationPair]:
    return [
        TranslationPair(
            source=unit["text"],
            target=translated.get(unit["id"], ""),
            paragraph_id=unit["paragraph_id"],
        )
        for unit in units
    ]


def sentence_pairs_from_structured_units(units: list[dict], translated: dict[str, str]) -> list[TranslationPair]:
    return [
        TranslationPair(
            source=unit["text"],
            target=translated.get(unit["id"], ""),
            paragraph_id=unit["paragraph_id"],
            sentence_index=unit["sentence_index"],
        )
        for unit in units
    ]


def paragraph_pairs_from_sentence_pairs(
    paragraphs: list[TranslationSourceParagraph],
    sentence_pairs: list[TranslationPair],
) -> list[TranslationPair]:
    pairs_by_paragraph: dict[str, list[TranslationPair]] = defaultdict(list)
    for pair in sentence_pairs:
        if pair.paragraph_id:
            pairs_by_paragraph[pair.paragraph_id].append(pair)

    paragraph_pairs: list[TranslationPair] = []
    for paragraph in paragraphs:
        source = paragraph_to_text(paragraph)
        if not source.strip():
            continue
        pairs = sorted(pairs_by_paragraph.get(paragraph.id, []), key=lambda item: item.sentence_index if item.sentence_index is not None else 0)
        target = "".join(pair.target for pair in pairs).strip()
        paragraph_pairs.append(TranslationPair(source=source, target=target, paragraph_id=paragraph.id))
    return paragraph_pairs




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
