from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import ensure_database, ensure_tables
from app.routers import assistant, chat_history, config, documents, format, health, markdown, rag, translation
from app.services.translation_job_service import mark_interrupted_jobs


def create_app() -> FastAPI:
    ensure_database()
    ensure_tables()
    mark_interrupted_jobs()
    try:
        from app.services.document_service import purge_expired_trash
        purge_expired_trash()
    except Exception:
        pass
    app = FastAPI(
        title="文枢 AI WriterHub API",
        version="0.1.0",
        description="FastAPI backend for 文枢 AI WriterHub.",
    )

    settings = get_settings()

    # CORS — 从环境变量读取允许的来源
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API 路由
    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(config.router, prefix="/api", tags=["config"])
    app.include_router(markdown.router, prefix="/api", tags=["markdown"])
    app.include_router(translation.router, prefix="/api", tags=["translation"])
    app.include_router(assistant.router, prefix="/api", tags=["assistant"])
    app.include_router(format.router, prefix="/api", tags=["format"])
    app.include_router(documents.router, prefix="/api", tags=["documents"])
    app.include_router(rag.router, prefix="/api", tags=["rag"])
    app.include_router(chat_history.router, prefix="/api", tags=["chat-history"])

    # 前端静态文件（部署时生效，开发时不挂载）
    static_dir = settings.static_dir.strip()
    if static_dir:
        static_path = Path(static_dir)
        if static_path.is_dir():
            assets_path = static_path / "assets"
            if assets_path.is_dir():
                app.mount("/assets", StaticFiles(directory=str(assets_path)), name="static-assets")

            @app.get("/{full_path:path}")
            async def serve_spa(request: Request, full_path: str):
                """SPA fallback — 非 /api 请求返回 index.html，支持前端路由"""
                file_path = static_path / full_path
                if file_path.is_file():
                    return FileResponse(str(file_path))
                return FileResponse(str(static_path / "index.html"))

    return app


app = create_app()
