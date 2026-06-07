from pathlib import Path
import shutil

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import ensure_database, ensure_tables, run_user_isolation_migration, run_add_email_migration
from app.routers import assistant, auth, chat_history, config, documents, format, health, markdown, rag, translation
from app.services.auth_service import resolve_session, set_request_auth
from app.services.translation_job_service import mark_interrupted_jobs


def create_app() -> FastAPI:
    ensure_database()
    ensure_tables()
    migrated = run_user_isolation_migration()
    run_add_email_migration()
    if migrated:
        storage_root = Path(__file__).resolve().parent / "storage"
        for path in (storage_root / "chroma", storage_root / "documents"):
            if path.exists():
                shutil.rmtree(path)
    mark_interrupted_jobs()
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

    public_api_routes = {
        ("GET", "/api/health"),
        ("POST", "/api/auth/register"),
        ("POST", "/api/auth/login"),
        ("POST", "/api/auth/forgot-password"),
    }

    @app.middleware("http")
    async def authenticate_api_request(request: Request, call_next):
        if (
            not request.url.path.startswith("/api")
            or request.method == "OPTIONS"
            or (request.method, request.url.path) in public_api_routes
        ):
            return await call_next(request)

        resolved = resolve_session(request.cookies.get(settings.session_cookie_name))
        if not resolved:
            return JSONResponse(status_code=401, content={"detail": "未登录"})
        user, session_hash = resolved
        request.state.user = user
        set_request_auth(user.id, session_hash)
        return await call_next(request)

    # API 路由
    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(auth.router, prefix="/api", tags=["auth"])
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
            # 挂载整个 dist 目录为静态文件（assets、图片等都能直接访问）
            app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static-frontend")

            # SPA fallback middleware：静态文件返回 404 时回退到 index.html
            @app.middleware("http")
            async def spa_fallback(request: Request, call_next):
                response = await call_next(request)
                if response.status_code == 404 and not request.url.path.startswith("/api"):
                    return FileResponse(str(static_path / "index.html"))
                return response

    return app


app = create_app()
