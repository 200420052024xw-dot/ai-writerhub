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
from app.services.document_service import connect, ensure_storage, get_document


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


def ensure_translation_tables() -> None:
    ensure_storage()
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS document_translation_versions (
                document_id TEXT NOT NULL,
                direction TEXT NOT NULL,
                granularity TEXT NOT NULL,
                source_text TEXT NOT NULL,
                source_hash TEXT NOT NULL,
                target_text TEXT NOT NULL,
                context_summary TEXT NOT NULL,
                used_context_summary INTEGER NOT NULL,
                chunks_json TEXT NOT NULL,
                paragraph_pairs_json TEXT NOT NULL,
                sentence_pairs_json TEXT NOT NULL,
                options_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (document_id, direction, granularity)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS translation_jobs (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                direction TEXT NOT NULL,
                granularity TEXT NOT NULL,
                status TEXT NOT NULL,
                total_chunks INTEGER NOT NULL,
                completed_chunks INTEGER NOT NULL,
                error TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT
            )
            """
        )
        legacy = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'document_translation_states'"
        ).fetchone()
        if legacy:
            rows = conn.execute("SELECT * FROM document_translation_states").fetchall()
            for row in rows:
                granularity = "sentence" if row["display_mode"] == "sentence" else "paragraph"
                source_hash = hashlib.sha256(row["source_text"].encode("utf-8")).hexdigest()
                conn.execute(
                    """
                    INSERT OR IGNORE INTO document_translation_versions
                    (document_id, direction, granularity, source_text, source_hash, target_text,
                     context_summary, used_context_summary, chunks_json, paragraph_pairs_json,
                     sentence_pairs_json, options_json, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["document_id"],
                        row["direction"],
                        granularity,
                        row["source_text"],
                        source_hash,
                        row["target_text"],
                        row["context_summary"],
                        row["used_context_summary"],
                        row["chunks_json"],
                        row["paragraph_pairs_json"],
                        row["sentence_pairs_json"],
                        row["options_json"],
                        row["updated_at"],
                    ),
                )
            conn.execute("DROP TABLE document_translation_states")
        conn.commit()


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
    ensure_translation_tables()
    document = get_document(document_id)
    current_hash = source_hash_for_document(document)
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM document_translation_versions WHERE document_id = ? ORDER BY updated_at DESC",
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
    ensure_translation_tables()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO document_translation_versions
            (document_id, direction, granularity, source_text, source_hash, target_text,
             context_summary, used_context_summary, chunks_json, paragraph_pairs_json,
             sentence_pairs_json, options_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id, direction, granularity) DO UPDATE SET
                source_text = excluded.source_text,
                source_hash = excluded.source_hash,
                target_text = excluded.target_text,
                context_summary = excluded.context_summary,
                used_context_summary = excluded.used_context_summary,
                chunks_json = excluded.chunks_json,
                paragraph_pairs_json = excluded.paragraph_pairs_json,
                sentence_pairs_json = excluded.sentence_pairs_json,
                options_json = excluded.options_json,
                updated_at = excluded.updated_at
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
        conn.commit()
