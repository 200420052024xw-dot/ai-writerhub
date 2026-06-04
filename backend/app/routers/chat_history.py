from fastapi import APIRouter, HTTPException

from app.schemas.chat_history import (
    DocumentAssistantHistory,
    KnowledgeConversation,
    KnowledgeConversationContentUpdate,
    KnowledgeConversationCreate,
    KnowledgeConversationList,
    KnowledgeConversationUpdate,
)
from app.services.chat_history_service import (
    create_knowledge_conversation,
    delete_knowledge_conversation,
    get_document_assistant_history,
    list_knowledge_conversations,
    rename_knowledge_conversation,
    replace_document_assistant_history,
    update_knowledge_conversation_content,
)


router = APIRouter()


@router.get("/knowledge/conversations", response_model=KnowledgeConversationList)
async def knowledge_conversations() -> KnowledgeConversationList:
    return KnowledgeConversationList(conversations=list_knowledge_conversations())


@router.post("/knowledge/conversations", response_model=KnowledgeConversation)
async def save_knowledge_conversation(payload: KnowledgeConversationCreate) -> KnowledgeConversation:
    return create_knowledge_conversation(payload)


@router.patch("/knowledge/conversations/{conversation_id}", response_model=KnowledgeConversation)
async def rename_conversation(conversation_id: str, payload: KnowledgeConversationUpdate) -> KnowledgeConversation:
    return rename_knowledge_conversation(conversation_id, payload.title)


@router.put("/knowledge/conversations/{conversation_id}", response_model=KnowledgeConversation)
async def update_conversation_content(conversation_id: str, payload: KnowledgeConversationContentUpdate) -> KnowledgeConversation:
    try:
        return update_knowledge_conversation_content(conversation_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/knowledge/conversations/{conversation_id}")
async def remove_conversation(conversation_id: str) -> dict[str, bool]:
    delete_knowledge_conversation(conversation_id)
    return {"ok": True}


@router.get("/documents/{document_id}/assistant-history", response_model=DocumentAssistantHistory)
async def document_assistant_history(document_id: str) -> DocumentAssistantHistory:
    return get_document_assistant_history(document_id)


@router.put("/documents/{document_id}/assistant-history", response_model=DocumentAssistantHistory)
async def save_document_assistant_history(document_id: str, payload: DocumentAssistantHistory) -> DocumentAssistantHistory:
    return replace_document_assistant_history(document_id, payload)
