# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WriterHub (文枢 AI WriterHub) — an AI-assisted document writing, editing, translation, formatting, and knowledge-base Q&A web application. Chinese-language product with frontend/backend separation.

## Development Commands

### Backend
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Requires `.env` file (see `.env.example`). Key vars: `AI_API_KEY`, `AI_BASE_URL`, `AI_DEFAULT_MODEL`.

### Frontend
```bash
cd frontend
npm install
npm run dev       # Vite dev server at 127.0.0.1:5173
npm run build     # TypeScript compile + Vite build -> dist/
npm run preview   # Preview built output at 127.0.0.1:4173
```

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite 7, TipTap 3 for rich text, single `global.css` (~70KB) for all styles
- **Backend**: Python 3.10+ + FastAPI + Uvicorn, SQLite (stdlib `sqlite3`), ChromaDB for RAG vectors
- **LLM**: OpenAI-compatible API (supports DeepSeek, Qwen, ZhiPu, Volcengine, Xiaomi MiMo, MiniMax, custom providers)
- **Streaming**: SSE for translation, assistant chat, and RAG Q&A responses

### Data Flow
```
React component -> services/api.ts -> FastAPI router -> Pydantic schema validation
  -> service layer -> llm_client.py (AI) / document_service.py (SQLite) / rag_service.py (Chroma)
  -> JSON response or SSE stream -> frontend state update
```

### Backend Layer Pattern
- **Routers** (`backend/app/routers/`): HTTP endpoints only, validate with Pydantic schemas, delegate to services
- **Services** (`backend/app/services/`): Business logic layer
- **Schemas** (`backend/app/schemas/`): Pydantic models for request/response validation
- **Prompts** (`backend/app/prompts/`): LLM prompt construction, one module per feature
- **Storage** (`backend/app/storage/`): SQLite DB, uploaded files, Chroma vector store (runtime data, gitignored)

### Key Backend Files
- `services/llm_client.py` — Centralized LLM access: `call_chat_model()`, `stream_chat_model()`, `call_vision_model()`
- `services/document_service.py` — Document CRUD, paragraph storage, SQLite operations
- `core/config.py` — Pydantic-settings config from `.env`

### Frontend Architecture
- **No React Router** — navigation via `activePage` state in `AppShell.tsx`
- **No CSS framework** — all styles in `styles/global.css`
- **localStorage** — model settings, RAG settings, per-page document caches (keys prefixed `writerhub.*`)
- **Custom DOM events** — `writerhub:model-settings-saved`, `writerhub:document-deleted` for cross-component communication
- **TipTap extensions** — custom blocks: `CalloutBlock.ts`, `ToggleBlock.ts`, `StructureFold.ts`

### Document Model
Documents stored as **structured paragraphs** with stable IDs, types (title/heading/paragraph/list/table), levels, and content hashes — not flat text.

## API Endpoints

All under `/api/`. Key routes:

| Endpoint | Purpose |
|---|---|
| `/api/health` | Health check |
| `/api/documents` | Document CRUD (list, create, get, patch, delete) |
| `/api/documents/{id}/paragraphs` | Save structured paragraphs |
| `/api/translate/stream` | Streaming translation (SSE) |
| `/api/assistant/chat` | Editor assistant chat (SSE) |
| `/api/format/parse` | Natural language format requirement parsing |
| `/api/format/organize` | AI content organization |
| `/api/format/export/docx` | Word document export |
| `/api/rag/query/stream` | RAG Q&A (SSE streaming) |

## Important Notes

- AI model configuration is **runtime per-request** from frontend (via `RuntimeModelConfig`), not stored server-side
- `.tmp_brief_interpret/` is a separate standalone microservice, not part of the main app
- The project is in active development — check `数据库存储实际内容.md` for current database schema and known issues
- All code comments and UI text are in Chinese
