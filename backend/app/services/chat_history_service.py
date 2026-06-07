import json
import uuid
from datetime import UTC, datetime, timedelta

from app.core.database import mysql_datetime, parse_database_datetime
from app.schemas.chat_history import (
    ChatMessage,
    DocumentAssistantHistory,
    KnowledgeConversation,
    KnowledgeConversationContentUpdate,
    KnowledgeConversationCreate,
)
from app.schemas.rag import RagSearchResult
from app.services.auth_service import current_user_id
from app.services.document_service import connect, get_document


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
        turn_search_results=_turn_results_from_json(row.get("turn_search_results_json", "[]")),
        created_at=parse_database_datetime(row["created_at"]),
        updated_at=parse_database_datetime(row["updated_at"]),
    )


def _validate_document_ids(document_ids: list[str]) -> None:
    for document_id in set(document_ids):
        get_document(document_id)


def _validate_conversation_payload(payload) -> None:
    document_ids = set(payload.document_ids)
    document_ids.update(result.document_id for result in payload.search_results)
    for row in payload.turn_search_results:
        document_ids.update(result.document_id for result in row)
    _validate_document_ids(list(document_ids))


def list_knowledge_conversations() -> list[KnowledgeConversation]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM knowledge_conversations WHERE user_id = %s ORDER BY updated_at DESC",
            (current_user_id(),),
        ).fetchall()
    return [_conversation_from_row(row) for row in rows]


def create_knowledge_conversation(payload: KnowledgeConversationCreate) -> KnowledgeConversation:
    _validate_conversation_payload(payload)
    conversation_id = uuid.uuid4().hex
    timestamp = mysql_datetime()
    title = payload.title.strip() or "未命名对话"
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO knowledge_conversations
            (id, user_id, title, document_ids_json, messages_json, search_results_json, turn_search_results_json, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                conversation_id,
                current_user_id(),
                title,
                json.dumps(payload.document_ids, ensure_ascii=False),
                json.dumps([message.model_dump() for message in payload.messages], ensure_ascii=False),
                json.dumps([result.model_dump() for result in payload.search_results], ensure_ascii=False),
                json.dumps([[result.model_dump() for result in row] for row in payload.turn_search_results], ensure_ascii=False),
                timestamp,
                timestamp,
            ),
        )
        row = conn.execute(
            "SELECT * FROM knowledge_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, current_user_id()),
        ).fetchone()
    return _conversation_from_row(row)


def update_knowledge_conversation_content(conversation_id: str, payload: KnowledgeConversationContentUpdate) -> KnowledgeConversation:
    _validate_conversation_payload(payload)
    timestamp = mysql_datetime()
    title = payload.title.strip() if payload.title else None
    with connect() as conn:
        current = conn.execute(
            "SELECT title FROM knowledge_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, current_user_id()),
        ).fetchone()
        if current is None:
            raise ValueError("Conversation not found")
        conn.execute(
            """
            UPDATE knowledge_conversations
            SET title = %s, document_ids_json = %s, messages_json = %s, search_results_json = %s, turn_search_results_json = %s, updated_at = %s
            WHERE id = %s AND user_id = %s
            """,
            (
                title or current["title"],
                json.dumps(payload.document_ids, ensure_ascii=False),
                json.dumps([message.model_dump() for message in payload.messages], ensure_ascii=False),
                json.dumps([result.model_dump() for result in payload.search_results], ensure_ascii=False),
                json.dumps([[result.model_dump() for result in row] for row in payload.turn_search_results], ensure_ascii=False),
                timestamp,
                conversation_id,
                current_user_id(),
            ),
        )
        row = conn.execute(
            "SELECT * FROM knowledge_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, current_user_id()),
        ).fetchone()
    return _conversation_from_row(row)


def rename_knowledge_conversation(conversation_id: str, title: str) -> KnowledgeConversation:
    timestamp = mysql_datetime()
    with connect() as conn:
        conn.execute(
            "UPDATE knowledge_conversations SET title = %s, updated_at = %s WHERE id = %s AND user_id = %s",
            (title.strip() or "未命名对话", timestamp, conversation_id, current_user_id()),
        )
        row = conn.execute(
            "SELECT * FROM knowledge_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, current_user_id()),
        ).fetchone()
    if not row:
        raise ValueError("Conversation not found")
    return _conversation_from_row(row)


def delete_knowledge_conversation(conversation_id: str) -> None:
    with connect() as conn:
        result = conn.execute(
            "DELETE FROM knowledge_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, current_user_id()),
        )
        if result._cur.rowcount == 0:
            raise ValueError("Conversation not found")


def get_document_assistant_history(document_id: str) -> DocumentAssistantHistory:
    get_document(document_id)
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM document_assistant_messages WHERE document_id = %s ORDER BY created_at ASC",
            (document_id,),
        ).fetchall()
    return DocumentAssistantHistory(messages=[ChatMessage(role=row["role"], content=row["content"]) for row in rows])


def replace_document_assistant_history(document_id: str, history: DocumentAssistantHistory) -> DocumentAssistantHistory:
    get_document(document_id)
    timestamp = datetime.now(UTC)
    with connect() as conn:
        conn.execute("DELETE FROM document_assistant_messages WHERE document_id = %s", (document_id,))
        for index, message in enumerate(history.messages):
            conn.execute(
                """
                INSERT INTO document_assistant_messages (id, document_id, role, content, created_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    uuid.uuid4().hex,
                    document_id,
                    message.role,
                    message.content,
                    mysql_datetime(timestamp + timedelta(seconds=index)),
                ),
            )
    return get_document_assistant_history(document_id)
