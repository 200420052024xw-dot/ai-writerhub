from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import assistant, config, documents, format, health, markdown, rag, translation


def create_app() -> FastAPI:
    app = FastAPI(
        title="文枢 AI WriterHub API",
        version="0.1.0",
        description="FastAPI backend for 文枢 AI WriterHub.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(config.router, prefix="/api", tags=["config"])
    app.include_router(markdown.router, prefix="/api", tags=["markdown"])
    app.include_router(translation.router, prefix="/api", tags=["translation"])
    app.include_router(assistant.router, prefix="/api", tags=["assistant"])
    app.include_router(format.router, prefix="/api", tags=["format"])
    app.include_router(documents.router, prefix="/api", tags=["documents"])
    app.include_router(rag.router, prefix="/api", tags=["rag"])

    return app


app = create_app()
