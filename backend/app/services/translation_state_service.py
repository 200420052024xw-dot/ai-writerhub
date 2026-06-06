import hashlib
import json
from datetime import UTC, datetime

from app.schemas.documents import DocumentDetail
from app.schemas.translation import (
    TranslationChunk,
    TranslationGranularity,
    TranslationOptions,
    TranslationPair,
    TranslationVersion,
)
from app.services.document_service import connect, get_document


def _now() -> str:
    return datetime.now(UTC).isoformat()


def source_hash_for_document(document: DocumentDetail) -> str:
    payload = json.dumps(
        [
            {
                "id": paragraph.id,
                "type": paragraph.type,
                "level": paragraph.level,
                "content": paragraph.content,
            }
            for paragraph in document.paragraphs
        ],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _chunks(value: str) -> list[TranslationChunk]:
    try:
        return [TranslationChunk(**item) for item in json.loads(value or "[]")]
    except (json.JSONDecodeError, TypeError, ValueError):
        return []


def _pairs(value: str) -> list[TranslationPair]:
    try:
        return [TranslationPair(**item) for item in json.loads(value or "[]")]
    except (json.JSONDecodeError, TypeError, ValueError):
        return []


def _version_from_row(row, current_hash: str) -> TranslationVersion:
    return TranslationVersion(
        document_id=row["document_id"],
        direction=row["direction"],
        granularity=row["granularity"],
        source_text=row["source_text"],
        source_hash=row["source_hash"],
        current_source_hash=current_hash,
        is_stale=row["source_hash"] != current_hash,
        target_text=row["target_text"],
        context_summary=row["context_summary"],
        used_context_summary=bool(row["used_context_summary"]),
        chunks=_chunks(row["chunks_json"]),
        paragraph_pairs=_pairs(row["paragraph_pairs_json"]),
        sentence_pairs=_pairs(row["sentence_pairs_json"]),
        options=json.loads(row["options_json"] or "{}"),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def list_translation_versions(document_id: str) -> list[TranslationVersion]:
    document = get_document(document_id)
    current_hash = source_hash_for_document(document)
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM document_translation_versions WHERE document_id = %s ORDER BY updated_at DESC",
            (document_id,),
        ).fetchall()
    return [_version_from_row(row, current_hash) for row in rows]


def get_translation_version(
    document_id: str,
    direction: str,
    granularity: TranslationGranularity,
) -> TranslationVersion | None:
    return next(
        (
            version
            for version in list_translation_versions(document_id)
            if version.direction == direction and version.granularity == granularity
        ),
        None,
    )


def save_translation_version(
    *,
    document_id: str,
    direction: str,
    granularity: str,
    source_text: str,
    source_hash: str,
    target_text: str,
    context_summary: str,
    used_context_summary: bool,
    chunks: list[TranslationChunk],
    paragraph_pairs: list[TranslationPair],
    sentence_pairs: list[TranslationPair],
    options: TranslationOptions,
) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO document_translation_versions
            (document_id, direction, granularity, source_text, source_hash, target_text,
             context_summary, used_context_summary, chunks_json, paragraph_pairs_json,
             sentence_pairs_json, options_json, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                source_text = VALUES(source_text),
                source_hash = VALUES(source_hash),
                target_text = VALUES(target_text),
                context_summary = VALUES(context_summary),
                used_context_summary = VALUES(used_context_summary),
                chunks_json = VALUES(chunks_json),
                paragraph_pairs_json = VALUES(paragraph_pairs_json),
                sentence_pairs_json = VALUES(sentence_pairs_json),
                options_json = VALUES(options_json),
                updated_at = VALUES(updated_at)
            """,
            (
                document_id,
                direction,
                granularity,
                source_text,
                source_hash,
                target_text,
                context_summary,
                1 if used_context_summary else 0,
                json.dumps([chunk.model_dump() for chunk in chunks], ensure_ascii=False),
                json.dumps([pair.model_dump() for pair in paragraph_pairs], ensure_ascii=False),
                json.dumps([pair.model_dump() for pair in sentence_pairs], ensure_ascii=False),
                options.model_dump_json(),
                _now(),
            ),
        )
