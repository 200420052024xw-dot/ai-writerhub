# 文枢 AI WriterHub 当前项目上下文

更新时间：2026-05-27

## Resume Prompt

请先阅读 `F:\text_editor\editorai_project\next_context_current.md`，再继续开发 WriterHub。重点注意：当前工作区有未提交改动，不要回滚用户或前序 Agent 的改动；后端改动后必须实际调用接口验证，不要只看端口是否监听。

## Project Paths

- Root: `F:\text_editor`
- Frontend: `F:\text_editor\frontend`
- Backend: `F:\text_editor\backend`
- Project docs/logs: `F:\text_editor\editorai_project`
- Frontend public assets: `F:\text_editor\frontend\public`
- Reference images: `F:\text_editor\fronted_picture`
- Frontend URL: `http://127.0.0.1:5173`
- Backend URL: `http://127.0.0.1:8000`

## Stack

- Frontend: React + Vite + TypeScript
- Backend: FastAPI
- Main storage: SQLite at `backend/app/storage/documents/documents.sqlite3`
- RAG vector store: Chroma at `backend/app/storage/chroma`
- Local embedding model default: `F:\hf_cache\model`
- Icons: lucide-react
- Editor: Tiptap

## Current Product Shape

WriterHub is a local document workspace with these main modules:

- Home document workspace
- Editor
- Translation
- Knowledge base Q&A
- Format cleanup
- Settings

The user is very sensitive to UI details. Prefer clean, practical UI; no fake demo data; no backend English status exposed directly in UI; avoid abrupt toast-only interactions when a dropdown or inline state is more natural.

## Current Git / Worktree State

There are many uncommitted changes. Do not reset or revert unrelated files.

Known modified/added areas from latest `git status --short`:

- Backend modified: `config.py`, `main.py`, documents/translation/RAG schemas and routers, assistant/document/LLM/RAG/translation services.
- Backend added: `backend/app/routers/chat_history.py`, `backend/app/schemas/chat_history.py`, `backend/app/services/chat_history_service.py`.
- Frontend modified: `AppShell.tsx`, `DocumentsPage.tsx`, `EditorPage.tsx`, `SettingsPage.tsx`, `TranslatePage.tsx`, `api.ts`, `global.css`.
- Storage added/changed: `backend/app/storage/chroma/`.
- Docs added: `editorai_project/rag_fix_2026-05-27.md`.

## Validation Commands

Frontend:

```powershell
cd F:\text_editor\frontend
npm run build
```

Backend:

```powershell
cd F:\text_editor\backend
python -m compileall app
```

Restart services:

```powershell
netstat -ano | findstr ":8000 :5173"
Get-Process python,uvicorn,node,powershell -ErrorAction SilentlyContinue
```

If old processes are still serving stale code, stop them explicitly, then:

```powershell
Start-Process -FilePath python -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--log-level','info') -WorkingDirectory 'F:\text_editor\backend' -WindowStyle Hidden
Start-Process -FilePath npm -ArgumentList @('run','dev','--','--host','127.0.0.1') -WorkingDirectory 'F:\text_editor\frontend' -WindowStyle Hidden
```

Important: after backend changes, directly call the relevant API to verify behavior. Do not rely only on port listening.

## Home Page

Important files:

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/styles/global.css`
- `frontend/src/services/api.ts`
- `backend/app/routers/documents.py`
- `backend/app/services/document_service.py`

Current behavior:

- Home can create new documents and open documents into editor.
- Deleting a document should clear any module localStorage that references it and dispatch `writerhub:document-deleted`.
- Upload supports common text/document formats, not Excel.
- Home brand uses `frontend/public/logo-calligraphy.svg` through an image element.
- The user asked for the attached calligraphy logo to replace the text title; current project uses the SVG asset.

## Top File Button / Navigation

Important files:

- `frontend/src/layouts/AppShell.tsx`
- `frontend/src/styles/global.css`

Rules:

- Navigation order: Home, Editor, Translation, Knowledge Base, Format Cleanup.
- Settings entry remains separate at lower left.
- Top hamburger/file button opens file selection only for Editor, Translation, and Format Cleanup.
- Home and Knowledge Base should treat that button as disabled/no-op.
- Editor, Translation, and Format Cleanup keep independent current-file state.
- The label beside the button shows the selected file name; if none, show “未选择文件”.
- File dropdown bottom should include “新建文档”.

## Editor Page

Important files:

- `frontend/src/pages/EditorPage.tsx`
- `frontend/src/styles/global.css`
- `backend/app/services/document_service.py`

Current behavior:

- Tiptap editor with title/body split.
- Must not reload or overwrite active typing on autosave.
- Empty lines are valid content and must not be removed.
- Reopening a document must not show literal tags such as `<span style="color: rgb(51, 51, 51)">`.
- Editor has a document-bound AI assistant panel on the right.
- Assistant chat history is saved per document through backend chat-history APIs.
- Editor right assistant panel is resizable; if too narrow it collapses.
- Collapsed “文枢助手” button was simplified to a small icon-style button.

Document assistant storage:

- Table: `document_assistant_messages`
- API:
  - `GET /api/documents/{document_id}/assistant-history`
  - `PUT /api/documents/{document_id}/assistant-history`

## Translation Page

Important files:

- `frontend/src/pages/TranslatePage.tsx`
- `backend/app/routers/translation.py`
- `backend/app/services/translation_service.py`
- `backend/app/prompts/translation.py`

Current behavior:

- Translation supports split view, paragraph alternating view, and sentence-by-sentence view.
- Translation page state is persisted so switching pages should not clear result/content.
- Paragraph/sentence display has frontend fallback pairing so old cached translation results without `paragraph_pairs`/`sentence_pairs` do not blank the page.
- Translation result output should scroll vertically.
- Direction switch should keep previous result visible and show stale direction indicators if needed.
- Glossary belongs to the document when a source document exists; stored in `documents.glossary_json`.
- Glossary preview can show several entries, with a “显示更多” button.
- “保存翻译” has selectable save formats:
  - target only
  - paragraph source(target)
  - paragraph target(source)
  - sentence source(target)
  - sentence target(source)

Known caution:

- The current segmentation strategy is still pragmatic, not perfect. For short text, model may translate in one call; long text is chunked. If user complains again, inspect both backend segmentation and frontend fallback display.

## Knowledge Base Page

Important files:

- `frontend/src/pages/DocumentsPage.tsx`
- `frontend/src/styles/global.css`
- `frontend/src/services/api.ts`
- `backend/app/routers/documents.py`
- `backend/app/routers/rag.py`
- `backend/app/services/rag_service.py`
- `backend/app/services/document_service.py`

Current behavior:

- Knowledge Base is the document Q&A page.
- Left side has history conversations and Top retrieval sources.
- Chat supports multi-turn turns; asking a new question should not erase previous turns.
- “新建对话” saves the current complete Q&A to history first, then clears current chat window.
- History list stores conversation title only; no time display.
- History items have a three-dot menu for rename/delete.
- Top retrieval area is grouped by document name. Click a document to open a modal showing its related evidence items, e.g. `[1]`, `[2]`.
- Answer citations like `[1]` and `[2]` are small clickable inline buttons. Clicking opens the specific evidence modal.
- Document selector is a dropdown, not a permanent right-side column.
- Clicking outside the selector closes it.
- Selector shows only usable/updateable/retryable docs:
  - `indexed`
  - `outdated`
  - `failed`
- `failed` docs appear with “解析失败” and a “重试解析” button.
- `outdated` docs appear with “待更新” and “立即更新”.
- During indexing, UI shows “解析中”, spinner, and disables duplicate clicking.
- Selector header shows the actual current RAG strategy: default/API embedding model, default/hybrid recall, rerank enabled or not.

Knowledge conversation storage:

- Table: `knowledge_conversations`
- API:
  - `GET /api/knowledge/conversations`
  - `POST /api/knowledge/conversations`
  - `PATCH /api/knowledge/conversations/{conversation_id}`
  - `DELETE /api/knowledge/conversations/{conversation_id}`

## RAG Backend

Important files:

- `backend/app/schemas/rag.py`
- `backend/app/services/rag_service.py`
- `backend/app/routers/rag.py`
- `backend/app/routers/documents.py`
- `backend/app/services/document_service.py`
- `backend/app/main.py`
- `backend/requirements.txt`

Current implementation:

- Document indexing endpoint: `POST /api/documents/{document_id}/index`
- Query endpoint streams retrieval and answer chunks.
- SQLite tables include `rag_chunks` and `rag_chunks_fts`.
- Chroma collection persists under `backend/app/storage/chroma`.
- Deleting a document clears its RAG index.
- Default recall strategy is vector/default recall.
- Hybrid strategy combines BM25/FTS and vector retrieval.
- Rerank is currently lightweight lexical rerank, not a true Qwen reranker.

RAG statuses:

- `not_indexed`
- `indexed`
- `outdated`
- `indexing`
- `failed`

Rules:

- SQLite document content is source of truth.
- Chroma and `rag_chunks` are derived indexes.
- Editing an indexed/outdated/failed document marks it `outdated` if content hash changes.
- Editing a never-indexed document should keep `not_indexed`.

## 2026-05-27 RAG Fix

Detailed note: `F:\text_editor\editorai_project\rag_fix_2026-05-27.md`

Bug:

- `关于组织学生选课（预选）的通知` had length about 1001 chars but indexing returned:
  `{"detail":"文档内容为空，无法生成知识库索引"}`

Root cause:

- `split_document_chunks` skipped the first block if the first block was longer than `TARGET_CHUNK_SIZE` and `current_chunk` was empty.

Fix:

- In `backend/app/services/rag_service.py`, when `current_chunk` is empty and the current block is too long, assign `current_chunk = block` before the long chunk loop.

Verified:

- Local split now returns 2 chunks for the failed document.
- After killing stale backend process and restarting, direct call succeeded:
  `POST http://127.0.0.1:8000/api/documents/c4ee88fccd8449f9a57cb88d3f3a614f/index`
- Response was HTTP `200`, and document status became `indexed`.

Critical pitfall:

- A stale/orphan Python backend process may keep serving old code on port 8000. Always verify with a real API call after backend changes.

## Settings Page

Important files:

- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/services/modelSettings.ts`
- `frontend/src/services/ragSettings.ts`
- `frontend/src/styles/global.css`
- `backend/app/services/llm_client.py`

Current product requirements:

- Settings sections are collapsible.
- Large model settings are separate from RAG settings.
- Large model settings save independently and support connectivity test.
- RAG settings save independently.
- “默认模型” is not called “本地模型” in UI.
- If default model is selected, hide API key/base URL/model inputs and connectivity test.
- If API model is selected, show API key/base URL/model and connectivity test.
- Default recall strategy is default/vector recall, not hybrid.
- Recall strategy text should visually match “启用重排”.
- Rerank toggle should be a larger slider-style control.
- Minimax was added by the user; respect existing user layout when modifying settings.

## Model Dispatch

Current principle:

- All LLM features should use user-provided settings from the Settings page.
- Frontend passes API key/base URL/model to backend for local prototype use.
- Do not rely on backend `.env` fallback for LLM calls unless explicitly requested.

MiMo/Xiaomi note:

- Correct example base URL is `https://api.xiaomimimo.com/v1`.
- User once entered `https://token-plan-cn.xiaomimimo.com/v1}` which includes a stray `}` and wrong host for the provided OpenAI-compatible example.
- `backend/app/services/llm_client.py` includes base URL normalization and Xiaomi header handling.
- If provider returns 401 invalid key, it is a credential/provider issue, not a frontend network bug.

## Database Storage

Main SQLite DB:

- `backend/app/storage/documents/documents.sqlite3`

Important tables:

- `documents`
  - `id`
  - `title`
  - `content`
  - `content_hash`
  - `rag_status`
  - `last_saved_at`
  - `last_indexed_at`
  - `glossary_json`
- `rag_chunks`
- `rag_chunks_fts`
- `knowledge_conversations`
- `document_assistant_messages`

## User Preferences / Constraints

- Use natural Chinese UI copy.
- Do not expose backend English statuses directly.
- Do not use fake sample data or simulated result content.
- Prefer dropdowns/inline states over abrupt one-line popups.
- File selector should look like a full list, not a tiny partial strip.
- Important buttons, especially save/update, must be easy to find.
- Checkbox alignment matters.
- History conversation area should feel like a common model chat sidebar, not a cramped box.
- For UI changes, check mobile/desktop text overflow if practical.
- Do not revert user changes.

## Current Service State

As of the latest work:

- Frontend running at `http://127.0.0.1:5173`
- Backend running at `http://127.0.0.1:8000`
- `关于组织学生选课（预选）的通知` was successfully re-indexed and now reports `indexed`.

Need verify on next session:

- Whether the same services are still running.
- Whether browser state/localStorage needs refresh to show latest status.

## Next Steps

1. Run `git status --short` first.
2. If working on UI, inspect the exact page file and matching `global.css` section before editing.
3. If working on backend, run `python -m compileall app`.
4. If working on frontend, run `npm run build`.
5. If backend behavior seems unchanged, kill stale Python/uvicorn processes and restart.
6. After backend changes, call the actual endpoint involved and record the result.
