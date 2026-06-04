import json
from datetime import UTC, datetime

from app.schemas.translation import DocumentTranslationState, DocumentTranslationStateSave, TranslationChunk, TranslationPair
from app.services.document_service import connect, ensure_storage, get_document


def ensure_translation_state_table() -> None:
    ensure_storage()
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS document_translation_states (
                document_id TEXT PRIMARY KEY,
                source_text TEXT NOT NULL,
                target_text TEXT NOT NULL,
                direction TEXT NOT NULL,
                display_mode TEXT NOT NULL,
                context_summary TEXT NOT NULL,
                used_context_summary INTEGER NOT NULL,
                chunks_json TEXT NOT NULL,
                paragraph_pairs_json TEXT NOT NULL,
                sentence_pairs_json TEXT NOT NULL,
                options_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def _chunks_from_json(value: str) -> list[TranslationChunk]:
    try:
        return [TranslationChunk(**item) for item in json.loads(value or "[]")]
    except (json.JSONDecodeError, TypeError):
        return []


def _pairs_from_json(value: str) -> list[TranslationPair]:
    try:
        return [TranslationPair(**item) for item in json.loads(value or "[]")]
    except (json.JSONDecodeError, TypeError):
        return []


def get_document_translation_state(document_id: str) -> DocumentTranslationState | None:
    ensure_translation_state_table()
    get_document(document_id)
    with connect() as conn:
        row = conn.execute("SELECT * FROM document_translation_states WHERE document_id = ?", (document_id,)).fetchone()
    if row is None:
        return None
    return DocumentTranslationState(
        document_id=row["document_id"],
        source_text=row["source_text"],
        target_text=row["target_text"],
        direction=row["direction"],
        display_mode=row["display_mode"],
        context_summary=row["context_summary"],
        used_context_summary=bool(row["used_context_summary"]),
        chunks=_chunks_from_json(row["chunks_json"]),
        paragraph_pairs=_pairs_from_json(row["paragraph_pairs_json"]),
        sentence_pairs=_pairs_from_json(row["sentence_pairs_json"]),
        options=json.loads(row["options_json"] or "{}"),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def save_document_translation_state(document_id: str, payload: DocumentTranslationStateSave) -> DocumentTranslationState:
    ensure_translation_state_table()
    get_document(document_id)
    timestamp = datetime.now(UTC).isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO document_translation_states
            (document_id, source_text, target_text, direction, display_mode, context_summary, used_context_summary,
             chunks_json, paragraph_pairs_json, sentence_pairs_json, options_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
                source_text = excluded.source_text,
                target_text = excluded.target_text,
                direction = excluded.direction,
                display_mode = excluded.display_mode,
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
                payload.source_text,
                payload.target_text,
                payload.direction,
                payload.display_mode,
                payload.context_summary,
                1 if payload.used_context_summary else 0,
                json.dumps([chunk.model_dump() for chunk in payload.chunks], ensure_ascii=False),
                json.dumps([pair.model_dump() for pair in payload.paragraph_pairs], ensure_ascii=False),
                json.dumps([pair.model_dump() for pair in payload.sentence_pairs], ensure_ascii=False),
                payload.options.model_dump_json(),
                timestamp,
            ),
        )
        conn.commit()
    state = get_document_translation_state(document_id)
    if state is None:
        raise RuntimeError("Translation state save failed")
    return state
