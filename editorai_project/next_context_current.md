# WriterHub AI Current Handoff

## Resume Prompt

请先阅读 `F:\text_editor\editorai_project\next_context_current.md`，然后继续开发文枢 AI WriterHub。重点检查当前 Tiptap 编辑器、文枢助手、标题/文件名同步、Markdown 粘贴转换、模型配置状态和右侧助手流式对话是否符合产品要求。

## Project Paths

- Root: `F:\text_editor`
- Frontend: `F:\text_editor\frontend`
- Backend: `F:\text_editor\backend`
- Docs/logs: `F:\text_editor\editorai_project`
- Reference images/assets: `F:\text_editor\fronted_picture`
- Frontend public assets: `F:\text_editor\frontend\public`

## Git State

- Remote: `https://github.com/200420052024xw-dot/writerhub-ai.git`
- Branch: `main`
- Latest pushed commit: `292e24b Upgrade editor workspace and assistant`
- Current `git status --short`: uncommitted changes at the time this handoff was written.

## Stack

- Frontend: React 19, Vite 7, TypeScript, lucide-react, Tiptap 3.
- Backend: FastAPI, httpx, OpenAI-compatible model calls.
- Frontend dev command:

```bash
cd F:\text_editor\frontend
npm run dev
```

- Frontend default URL: `http://127.0.0.1:5173`
- Frontend build command:

```bash
cd F:\text_editor\frontend
npm run build
```

- Backend routes are registered in `backend/app/main.py`.

## Product Direction

- Product name: 文枢 AI WriterHub.
- Core product is an AI-assisted document/text editor, not a chat-first app.
- Editor should feel like a lightweight document editor similar to the reference in `fronted_picture/img.png`.
- Avoid restoring old preview/split-screen editor modes.
- Avoid restoring image insertion unless user explicitly asks.
- Keep page as a one-screen workspace when practical.

## Current Editor State

Main file: `frontend/src/pages/EditorPage.tsx`

Implemented:

- Tiptap editor replaces old manual `contenteditable`.
- Toolbar includes:
  - Format brush at far left.
  - Undo / redo.
  - Paragraph dropdown: body text and heading 1-5.
  - Bold, italic, strike, underline, inline code.
  - WPS-style split buttons for text color and background color.
  - Bullet list, ordered list, quote, code block.
  - Callout block and toggle block.
  - Copy Markdown and copy plain text, placed to the right of the toggle block.
- Removed:
  - Font size UI.
  - Copy rich text.
  - Top editor status/copy bar.

Important title behavior:

- File title is separate from Tiptap body.
- `documentTitle` state in `EditorPage.tsx` is the file name.
- Topbar title in `AppShell.tsx` mirrors `documentTitle`.
- Empty title displays `无标题文档` in the topbar.
- Editor title input placeholder is `请输入标题`.
- Body placeholder is `直接输入正文`.
- Body placeholder should show only when the whole body is empty, not on every new blank paragraph.
- Pressing Enter in title input should focus the body editor.
- Copy Markdown prepends `# <documentTitle>` when title exists.
- Copy plain text prepends the document title when it exists.

Known recent user concern:

- They reported the body placeholder repeated on new blank lines. This was changed to a custom `bodyEmpty` placeholder instead of Tiptap node placeholders. Recheck visually.

## Tiptap Extensions

Files:

- `frontend/src/extensions/CalloutBlock.ts`
- `frontend/src/extensions/ToggleBlock.ts`
- `frontend/src/extensions/StructureFold.ts`

Implemented:

- Callout block: highlighted note/tip block.
- Toggle block: React NodeView with editable title and expand/collapse button.
- Structure fold: heading-based fold controls for document structure.

Important detail:

- First top-level H1 was previously used as document title. Title is now separate, so structure fold should apply to headings inside the body. Verify first body heading fold behavior still works.

## Markdown Paste Conversion

Implemented in `EditorPage.tsx`:

- Markdown conversion prompt is only triggered by the first paste into the editor body during a page session.
- It reads clipboard `text/plain` in Tiptap `editorProps.handlePaste`.
- If pasted content has Markdown syntax, prompt appears:
  - `转换`: convert Markdown into editable Tiptap HTML.
  - `暂不`: dismiss prompt.
- After first prompt, it should not prompt again in the same page session.
- Conversion supports headings, unordered/ordered lists, blockquote, fenced code, inline code, bold, italic, links, and horizontal rule.
- If pasted Markdown first line is `# 标题`, conversion extracts that as `documentTitle` and puts remaining content in body.

## 文枢助手 / AI Assistant

Implemented in `EditorPage.tsx` and `backend/app/routers/assistant.py`.

Right panel:

- Title: `文枢助手`.
- Empty state only shows icon above this sentence:
  - `陪您聊天，创作或脑洞打开，准备好探索无限的可能`
- Removed middle prompt/action buttons.
- Input is fixed at bottom.
- Input and send button should be the same height, currently 40px.
- Assistant reply uses streaming output.

Model configuration:

- User config stored in browser localStorage via `frontend/src/services/modelSettings.ts`.
- Settings page: `frontend/src/pages/SettingsPage.tsx`.
- Topbar model status:
  - Shows configured model name if `apiKey`, `baseUrl`, and `defaultModel` are present.
  - Shows `暂未配置模型` if incomplete.
  - Red/green dot is retained.
  - Removed topbar right-side history/help/notification/user name icons.

Backend streaming:

- New route: `POST /api/assistant/chat`
- File: `backend/app/routers/assistant.py`
- It accepts frontend-provided `api_key`, `base_url`, `model`, and messages.
- It forwards to OpenAI-compatible `/chat/completions` with `stream: true`.
- Frontend calls it via `API_BASE_URL` from `frontend/src/services/api.ts`.

Security note:

- API key is still stored in browser localStorage and sent to backend for streaming. This is acceptable for current local/prototype stage, but production should use server-side encrypted storage or environment variables.

## 翻译功能 / Translation

Main files:

- `frontend/src/pages/TranslatePage.tsx`
- `frontend/src/services/api.ts`
- `backend/app/schemas/translation.py`
- `backend/app/prompts/translation.py`
- `backend/app/services/translation_service.py`
- `backend/app/routers/translation.py`

### 翻译设置侧边栏

侧边栏布局（从上到下）：

1. **语体风格**：下拉选择框（`<select>`），选项：默认 / 学术风格 / 商务风格 / 口语自然。三选一，互斥。
2. **翻译规范**：
   - 术语统一（checkbox）
   - 保留专有名词（checkbox）
   - 其他要求（checkbox + 多行 textarea，勾选才生效）
3. **术语表/记忆库**：标题行右侧三个按钮 [AI提炼] [下载] [编辑]
   - 显示前 5 条术语预览，超出显示"还有 N 条..."
   - 暂无术语时显示提示文字

### 语体风格

- 三个语体风格（学术/商务/口语）从独立 checkbox 改为单选组，新增"默认"选项。
- 后端 `TranslationOptions.style` 字段类型为 `Literal["default", "academic", "business", "natural"]`。
- `translation_style_instruction()` 根据 `options.style` 生成对应风格指令。

### 术语表 / 记忆库

- 数据存储在浏览器 localStorage，key 为 `writerhub_glossary`。
- 类型：`GlossaryEntry = { source: string; target: string }`。
- **AI 提炼**：点击 ✨ 按钮，调用 `POST /api/translate/extract-terms`，从源文本中提取术语，自动加入术语表并弹窗。
- **下载**：导出术语表为 txt 文件（`source → target` 格式）。
- **编辑**：弹窗显示全部术语，支持增删改。弹窗关闭时自动过滤掉原文或译文为空的条目。
- 弹窗样式：宽度 460px，高度上限 85vh，底部居中虚线边框"添加术语"按钮。
- 翻译时术语表通过 `glossary` 字段传给后端，prompt 中强制遵循术语译法。

### 其他要求

- checkbox + 多行 textarea，勾选后展开输入框，取消勾选清空内容。
- 内容存入 `TranslationOptions.custom_requirements`，翻译时追加到风格指令中。

### 流式翻译输出

- 长文本翻译改为 SSE 流式输出，按 chunk 逐块显示译文。
- 后端新增 `POST /translate/stream` SSE 端点，保留原 `POST /translate` 不变。
- 后端 `translate_with_strategy_stream()` 异步生成器 yield 事件：`start` → `context_summary` → `chunk*` → `complete`。
- 前端 `translateTextStream()` 用 `fetch` + `ReadableStream` 解析 SSE。
- 翻译过程中显示 "翻译中 (2/5 块)..." 进度，每完成一块立即更新译文区域。
- 段落/句对 pairs 从 chunks 生成（简化处理）。

### 翻译方向和显示模式

- 翻译方向：`中 → 英` / `英 → 中`（segmented button）。
- 显示模式：`分屏对照` / `段落交替` / `句对句对照`。
- 分屏模式：左侧原文 textarea，右侧译文。
- 段落交替/句对句模式：原文和译文逐段/逐句交替显示。

### 后端翻译服务

- 长文本策略：文本 >= 700 字符或段落 >= 4 时启用，先生成上下文概要，再分块翻译。
- 短文本：直接整体翻译。
- 温度参数：0.2（低温度，翻译更稳定）。

## App Shell / Branding

Files:

- `frontend/src/layouts/AppShell.tsx`
- `frontend/src/styles/global.css`
- `frontend/public/logo-brand.png`

Implemented:

- Left nav first item label changed from `编辑器` to `编辑`.
- Sidebar top-left uses cropped full text logo image `logo-brand.png`.
- Original public logo remains `frontend/public/logo.png`.
- Cropped logo source was generated from `frontend/public/logo.png`.

Topbar:

- Left title is the editor file title on editor page.
- Search remains.
- Right model pill and export button remain.

## Backend State

Files:

- `backend/app/main.py`
- `backend/app/routers/assistant.py`
- `backend/app/routers/translation.py`
- Existing routers: `config`, `health`, `markdown`, `translation`.

Validation run:

```bash
cd F:\text_editor\backend
python -m compileall app
```

This passed after latest changes.

## Validation Already Run

Frontend build passed many times after changes:

```bash
cd F:\text_editor\frontend
npm run build
```

Latest known result:

- Build succeeded.
- Vite still warns that one chunk is larger than 500 KB due to Tiptap. This is a warning, not a functional failure.

## Important Constraints / User Preferences

- Use Chinese UI text.
- Keep `<>` icon name/visual as-is for inline code; do not rename it to visible text unless user asks.
- Keep quote icon visual as-is; do not rename it visibly unless user asks.
- Format brush should stay at far left of toolbar.
- Color controls should mimic WPS split-button behavior:
  - Main button applies current tool color.
  - Small arrow opens color choices.
- Font size UI should stay removed.
- Paragraph dropdown should remain body + heading 1-5.
- Copy rich text should stay removed.
- Copy Markdown and plain text should stay inside toolbar to the right of toggle block.
- Markdown conversion prompt should only appear on first paste of Markdown into body.

## Known Pitfalls

- The long handoff file `editorai_project/next_context_editor_tiptap.md` contains extensive history and can be noisy. Prefer this current file first.
- Windows console can display Chinese as mojibake if not read as UTF-8; use `Get-Content -Encoding utf8`.
- Browser plugin Node REPL was not available earlier, so browser visual verification was limited. Prefer local dev server and screenshots if browser tools are available in the next session.
- Backend may not be running; frontend model/Markdown backend calls may fail if `http://127.0.0.1:8000` is down.
- `.idea/` is ignored in `.gitignore`.
- Chinese curly quotes (`""`) in JSX strings cause TypeScript parse errors. Use straight quotes or single quotes with escaped inner quotes.

## Recommended Next Steps

1. Start or verify frontend:

```bash
cd F:\text_editor\frontend
npm run dev
```

2. If testing AI assistant streaming, start backend and ensure model config is filled in Settings page.
3. Visually verify:
   - Empty editor shows `请输入标题` and only one `直接输入正文`.
   - Typing a title updates topbar file name.
   - Enter in title focuses body.
   - New blank body lines do not show repeated placeholder.
   - Toolbar copy buttons are beside toggle block.
   - Right assistant input and send button are same height.
   - First Markdown paste prompts once.
   - Translation sidebar: style dropdown, checkboxes, glossary preview, modal editing.
   - Streaming translation shows chunk progress for long text.
4. Run build before finalizing:

```bash
cd F:\text_editor\frontend
npm run build
```

5. If backend changed:

```bash
cd F:\text_editor\backend
python -m compileall app
```

## Acceptance Criteria

- Editor behaves like a document editor with independent required file title.
- Topbar title mirrors the title input.
- Body placeholder appears only when body has no content.
- Assistant panel is clean, with streaming chat and bottom input.
- Model status shows actual configured model or `暂未配置模型`.
- Translation settings: style dropdown, checkboxes, glossary with AI extract/edit/download, custom requirements textarea.
- Streaming translation shows progressive output for long text.
- Git remains clean after intentional commits.
