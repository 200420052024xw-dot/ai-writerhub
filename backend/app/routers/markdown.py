from fastapi import APIRouter

from app.schemas.markdown import MarkdownDetectRequest, MarkdownDetectResponse
from app.services.markdown_service import detect_markdown

router = APIRouter()


@router.post("/markdown/detect", response_model=MarkdownDetectResponse)
async def detect_markdown_content(payload: MarkdownDetectRequest) -> MarkdownDetectResponse:
    is_markdown, features, score = detect_markdown(payload.content)
    return MarkdownDetectResponse(is_markdown=is_markdown, features=features, score=score)
