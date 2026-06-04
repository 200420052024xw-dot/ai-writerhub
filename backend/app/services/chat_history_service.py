import json
import uuid
from datetime import UTC, datetime

from app.schemas.chat_history import (
    ChatMessage,
    DocumentAssistantHistory,
    KnowledgeConversation,
    KnowledgeConversationContentUpdate,
    KnowledgeConversationCreate,
)
from app.schemas.rag import RagSearchResult
from app.services.document_service import connect, ensure_storage, get_document


def now_utc() -> datetime:
    return datetime.now(UTC)


def ensure_chat_history_tables() -> None:
    ensure_storage()
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS knowledge_conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                document_ids_json TEXT NOT NULL,
                messages_json TEXT NOT NULL,
                search_results_json TEXT NOT NULL,
                turn_search_results_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(knowledge_conversations)").fetchall()}
        if "turn_search_results_json" not in columns:
            conn.execute("ALTER TABLE knowledge_conversations ADD COLUMN turn_search_results_json TEXT NOT NULL DEFAULT '[]'")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS document_assistant_messages (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def _messages_from_json(value: str) -> list[ChatMessage]:
    try:
        return [ChatMessage(**item) for item in json.loads(value or "[]")]
    except (json.JSONDecodeError, TypeError):
        return []


def _results_from_json(value: str) -> list[RagSearchResult]:
    try:
        return [RagSearchResult(**item) for item in json.loads(value or "[]")]
    except (json.JSONDecodeError, TypeError):
        return []


def _turn_results_from_json(value: str) -> list[list[RagSearchResult]]:
    try:
        rows = json.loads(value or "[]")
        if not isinstance(rows, list):
            return []
        return [[RagSearchResult(**item) for item in row] for row in rows if isinstance(row, list)]
    except (json.JSONDecodeError, TypeError):
        return []


def _conversation_from_row(row) -> KnowledgeConversation:
    try:
        document_ids = json.loads(row["document_ids_json"] or "[]")
    except (json.JSONDecodeError, TypeError):
        document_ids = []
    return KnowledgeConversation(
        id=row["id"],
        title=row["title"],
        document_ids=document_ids,
        messages=_messages_from_json(row["messages_json"]),
        search_results=_results_from_json(row["search_results_json"]),
        turn_search_results=_turn_results_from_json(row["turn_search_results_json"] if "turn_search_results_json" in row.keys() else "[]"),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def list_knowledge_conversations() -> list[KnowledgeConversation]:
    ensure_chat_history_tables()
    with connect() as conn:
        rows = conn.execute("SELECT * FROM knowledge_conversations ORDER BY updated_at DESC").fetchall()
    return [_conversation_from_row(row) for row in rows]


def create_knowledge_conversation(payload: KnowledgeConversationCreate) -> KnowledgeConversation:
    ensure_chat_history_tables()
    conversation_id = uuid.uuid4().hex
    timestamp = now_utc().isoformat()
    title = payload.title.strip() or "未命名对话"
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO knowledge_conversations
            (id, title, document_ids_json, messages_json, search_results_json, turn_search_results_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                conversation_id,
                title,
                json.dumps(payload.document_ids, ensure_ascii=False),
                json.dumps([message.model_dump() for message in payload.messages], ensure_ascii=False),
                json.dumps([result.model_dump() for result in payload.search_results], ensure_ascii=False),
                json.dumps([[result.model_dump() for result in row] for row in payload.turn_search_results], ensure_ascii=False),
                timestamp,
                timestamp,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM knowledge_conversations WHERE id = ?", (conversation_id,)).fetchone()
    return _conversation_from_row(row)


def update_knowledge_conversation_content(conversation_id: str, payload: KnowledgeConversationContentUpdate) -> KnowledgeConversation:
    ensure_chat_history_tables()
    timestamp = now_utc().isoformat()
    title = payload.title.strip() if payload.title else None
    with connect() as conn:
        current = conn.execute("SELECT title FROM knowledge_conversations WHERE id = ?", (conversation_id,)).fetchone()
        if current is None:
            raise ValueError("Conversation not found")
        conn.execute(
            """
            UPDATE knowledge_conversations
            SET title = ?, document_ids_json = ?, messages_json = ?, search_results_json = ?, turn_search_results_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                title or current["title"],
                json.dumps(payload.document_ids, ensure_ascii=False),
                json.dumps([message.model_dump() for message in payload.messages], ensure_ascii=False),
                json.dumps([result.model_dump() for result in payload.search_results], ensure_ascii=False),
                json.dumps([[result.model_dump() for result in row] for row in payload.turn_search_results], ensure_ascii=False),
                timestamp,
                conversation_id,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM knowledge_conversations WHERE id = ?", (conversation_id,)).fetchone()
    return _conversation_from_row(row)


def rename_knowledge_conversation(conversation_id: str, title: str) -> KnowledgeConversation:
    ensure_chat_history_tables()
    timestamp = now_utc().isoformat()
    with connect() as conn:
        conn.execute(
            "UPDATE knowledge_conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title.strip() or "未命名对话", timestamp, conversation_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM knowledge_conversations WHERE id = ?", (conversation_id,)).fetchone()
    return _conversation_from_row(row)


def delete_knowledge_conversation(conversation_id: str) -> None:
    ensure_chat_history_tables()
    with connect() as conn:
        conn.execute("DELETE FROM knowledge_conversations WHERE id = ?", (conversation_id,))
        conn.commit()


def get_document_assistant_history(document_id: str) -> DocumentAssistantHistory:
    ensure_chat_history_tables()
    get_document(document_id)
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM document_assistant_messages WHERE document_id = ? ORDER BY created_at ASC",
            (document_id,),
        ).fetchall()
    return DocumentAssistantHistory(messages=[ChatMessage(role=row["role"], content=row["content"]) for row in rows])


def replace_document_assistant_history(document_id: str, history: DocumentAssistantHistory) -> DocumentAssistantHistory:
    ensure_chat_history_tables()
    get_document(document_id)
    timestamp = now_utc().isoformat()
    with connect() as conn:
        conn.execute("DELETE FROM document_assistant_messages WHERE document_id = ?", (document_id,))
        for index, message in enumerate(history.messages):
            conn.execute(
                """
                INSERT INTO document_assistant_messages (id, document_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (uuid.uuid4().hex, document_id, message.role, message.content, f"{timestamp}-{index:04d}"),
            )
        conn.commit()
    return get_document_assistant_history(document_id)
