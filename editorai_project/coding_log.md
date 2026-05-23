# Coding Log

## 2026-05-23

### 需求理解

用户希望实现一个智能文本编辑器 Web 应用。核心定位是文本编辑，而不是单纯聊天。AI 能力应围绕文档编辑、翻译、格式整理和多文档问答提供增强。

### 已确认功能范围

- 文本 / Markdown 编辑：
  - 文本输入和编辑。
  - Markdown 自动检测。
  - 编辑视图、预览视图、分屏视图。
  - 复制为 Markdown 原文、普通文本、富文本。

- 中英互译：
  - 中文转英文。
  - 英文转中文。
  - 分屏对照、段落交替、句对句对照。

- 一句话整理格式 + 导出：
  - 自然语言格式要求输入。
  - 解析为结构化格式配置。
  - 预览排版效果。
  - 导出 Word / PDF。

- 多文档 AI 问答：
  - 多文档上传。
  - 文档解析和检索索引。
  - 基于文档提问。
  - 回答展示来源文件或引用片段。

### 环境检查

项目根目录：`F:\text_editor`

已发现目录：

- `.idea`
- `.venv`
- `fronted_picture`

前端示例图实际所在文件夹为 `fronted_picture`，不是 `fronted-picture`。

示例图文件：

- `fronted_picture/编辑器.png`
- `fronted_picture/翻译.png`
- `fronted_picture/格式整理.png`
- `fronted_picture/文档问答.png`

### 用户选择

- 本阶段产出范围：先写项目文档。
- 新文件夹名称：`editorai_project`。
- 后续技术栈规划：React + Vite。

### 本次执行内容

- 创建 `editorai_project` 文件夹。
- 新增项目说明文档 `README.md`。
- 新增需求说明文档 `requirements.md`。
- 新增 UI 分析文档 `ui_analysis.md`。
- 新增后续实现路线文档 `implementation_plan.md`。
- 新增 coding 日志 `coding_log.md`。

### 当前状态

本阶段只完成文档沉淀，不创建前端脚手架，不安装依赖，不实现运行时代码。

### 追加说明

用户补充要求后端使用 FastAPI。已将技术方向更新为前端 React + Vite，后端 FastAPI，并在实现路线中补充 FastAPI API、模块结构和后端实现顺序。

### 开发计划

根据当前产品目标，新增 `development_plan.md`，将项目拆分为 8 个阶段：

- 阶段 0：项目初始化。
- 阶段 1：统一应用框架和静态 UI。
- 阶段 2：编辑器核心能力。
- 阶段 3：中英互译。
- 阶段 4：一句话格式整理和导出。
- 阶段 5：多文档 AI 问答。
- 阶段 6：真实 AI 和文档能力接入。
- 阶段 7：质量完善。

### 第一阶段：项目初始化

开始执行项目初始化：

- 新增主目录 `frontend` 前端项目骨架。
- 新增 React + Vite + TypeScript 配置文件。
- 新增基础 `AppShell`，包含左侧导航、顶部栏、主编辑预览区、右侧 AI 助手和底部状态栏。
- 新增前端健康检查请求封装。
- 新增主目录 `backend` FastAPI 项目骨架。
- 新增 `GET /api/health` 健康检查接口。
- 新增 FastAPI CORS 配置，允许本地 Vite 前端访问。
- 新增后端依赖清单 `requirements.txt`。
- 更新 `README.md` 本地启动说明。

第一阶段验证结果：

- 前端依赖安装成功，生成 `package-lock.json`。
- 后端依赖安装成功，使用根目录 `.venv`。
- `npm run build` 执行通过。
- FastAPI 应用导入通过，应用标题为 `EditorAI API`。
- 后端服务已启动，进程 ID 为 `33208`。
- 前端 Vite 服务已启动，进程 ID 为 `34200`。
- `GET http://127.0.0.1:8000/api/health` 返回 `status=ok`、`service=editorai-api`、`version=0.1.0`。
- `GET http://127.0.0.1:5173` 返回 HTTP 200。
- 已补充 `src/vite-env.d.ts`，解决 Vite 环境变量类型声明问题。
- 浏览器插件控制工具未暴露，无法完成 in-app browser 截图验证；已用 HTTP 请求完成基础运行验证。

### 第一阶段目录修正

用户指出 `backend` 和 `frontend` 应放在 `F:\text_editor` 主目录，而不是 `editorai_project` 文档目录。已完成修正：

- 将 `editorai_project/backend` 移动到 `F:\text_editor\backend`。
- 将 `editorai_project/frontend` 移动到 `F:\text_editor\frontend`。
- 将 `.gitignore` 移动到 `F:\text_editor\.gitignore`。
- `editorai_project` 目录继续用于 Markdown 文档、计划、日志和阶段报告。
- 更新 `README.md` 和 `phase_1_report.md` 中的启动路径。

## 2026-05-23 第二阶段：统一应用框架和静态 UI

本阶段开始实现四个核心功能页面的静态 UI，代码放在主目录 `frontend` 中：

- 重写 `src/layouts/AppShell.tsx`，支持左侧导航切换。
- 新增 `src/pages/EditorPage.tsx`，实现编辑器静态页面。
- 新增 `src/pages/TranslatePage.tsx`，实现翻译静态页面。
- 新增 `src/pages/FormatPage.tsx`，实现格式整理静态页面。
- 新增 `src/pages/DocumentsPage.tsx`，实现文档问答静态页面。
- 重写 `src/styles/global.css`，统一导航、顶部栏、面板、按钮和工作区样式。
- 更新 `src/types/index.ts`，补充导航和健康状态类型。

验证结果：

- 首次构建发现文档列表数组类型推断过宽，已将文档数据改为对象数组并显式声明图标类型。
- `npm run build` 通过。
- `GET http://127.0.0.1:5173` 返回 HTTP 200。
- `GET http://127.0.0.1:8000/api/health` 返回 `status=ok`。
- 新增 `phase_2_report.md` 记录本阶段验收结果。

### 第二阶段 UI 复刻修正

用户反馈当前前端与 `fronted_picture` 示例图差距仍较大，并要求功能页面保持在一个屏幕内，不要出现浏览器上下滚动，同时删除左下角“AI 字数使用（本月）”模块。已完成以下修正：

- 删除左侧导航底部的 AI 字数使用卡片。
- 修复 `AppShell` 中的中文显示文本。
- 顶部栏补充历史、帮助、通知、用户和导出等示例图中的操作区元素。
- 页面改为 `100vh` 固定工作台，`html/body/#root` 禁止上下滚动。
- 主工作区、四个页面布局、状态栏统一按视口高度计算。
- 编辑器、翻译、格式整理、文档问答页面均收紧间距和面板高度，尽量贴近示例图的一屏式工具界面。
- `npm run build` 通过。
- `GET http://127.0.0.1:5173` 返回 HTTP 200。

## 2026-05-23 第三阶段：编辑器核心能力

本阶段实现 Markdown 编辑器的核心能力：

- 重写 `frontend/src/pages/EditorPage.tsx`。
- 编辑器改为受控输入，支持实时内容更新。
- 实现编辑视图、预览视图、分屏视图切换。
- 实现轻量 Markdown 本地渲染，支持标题、列表、引用、代码块、粗体、斜体、链接、图片和分割线。
- 实现复制 Markdown 原文、复制纯文本、复制富文本。
- 增加复制结果提示和编辑统计信息。
- 新增 `backend/app/routers/markdown.py`。
- 新增 `backend/app/schemas/markdown.py`。
- 新增 `backend/app/services/markdown_service.py`。
- 在 `backend/app/main.py` 注册 Markdown 路由。
- 在 `frontend/src/services/api.ts` 新增 `detectMarkdown` API。

验证结果：

- `npm run build` 通过。
- FastAPI 应用已注册 `/api/markdown/detect`。
- 已重启 FastAPI 后端服务，当前后端进程 ID 为 `37864`。
- `GET http://127.0.0.1:8000/api/health` 返回 `status=ok`。
- `POST http://127.0.0.1:8000/api/markdown/detect` 对 `# 标题\n- 列表\n**加粗**` 返回 `is_markdown=True`，识别到 `heading`、`unordered_list`、`bold`。
- `GET http://127.0.0.1:5173` 返回 HTTP 200。
- 新增 `phase_3_report.md` 记录本阶段验收结果。

## 2026-05-23 第四阶段：中英互译

本阶段实现翻译页核心流程：

- 重写 `frontend/src/pages/TranslatePage.tsx`。
- 支持中 -> 英、英 -> 中方向切换。
- 支持分屏对照、段落交替、句对句对照。
- 支持原文输入、开始翻译、加载状态、复制译文。
- 支持学术风格、商务风格、口语自然、术语统一、保留专有名词等选项进入请求参数。
- 在 `frontend/src/services/api.ts` 新增 `translateText` API 封装。
- 新增 `backend/app/schemas/translation.py`。
- 新增 `backend/app/services/translation_service.py`。
- 新增 `backend/app/routers/translation.py`。
- 在 `backend/app/main.py` 注册 `/api/translate` 路由。

验证结果：

- `npm run build` 通过。
- FastAPI 应用已注册 `/api/translate`。
- 已重启 FastAPI 后端服务，当前后端进程 ID 为 `3376`。
- `GET http://127.0.0.1:8000/api/health` 返回 `status=ok`。
- `POST http://127.0.0.1:8000/api/translate` 返回翻译响应结构。
- 直接调用翻译服务函数，确认中文术语能映射为英文表达。
- `GET http://127.0.0.1:5173` 返回 HTTP 200。
- 新增 `phase_4_report.md` 记录本阶段验收结果。

## 2026-05-23 AI 模型配置调整

用户要求在继续下一阶段前增加 AI 相关设置：在设置中允许用户输入 API Key、Base URL、默认模型，并提供常见模型厂商预设，也允许自定义。

已完成：

- 新增 `frontend/src/services/modelSettings.ts`，管理模型厂商预设和本地存储。
- 新增 `frontend/src/pages/SettingsPage.tsx`。
- 更新 `frontend/src/layouts/AppShell.tsx`，将左侧“设置”接入模型配置页，并修复显示文本。
- 更新 `frontend/src/styles/global.css`，增加设置页布局和表单样式。
- 新增 `editorai_project/ai_model_settings_note.md` 记录本次 AI 设置设计。

当前预设厂商：

- OpenAI
- DeepSeek
- 通义千问 DashScope
- 智谱 GLM
- 火山方舟
- Moonshot AI
- 自定义

验证结果：

- `npm run build` 通过。
- `GET http://127.0.0.1:5173` 返回 HTTP 200。
- 当前 API Key 只保存在浏览器 localStorage。后续真实 AI 调用应由 FastAPI 后端统一处理密钥和模型请求。

## 2026-05-23 项目正式命名

用户确认项目正式名称为“文枢 AI WriterHub”，并将图标放入 `fronted_picture/logo.png`。已完成：

- 将 `fronted_picture/logo.png` 复制到 `frontend/public/logo.png`。
- 前端左侧品牌区改为使用 Logo 图片和“文枢 AI WriterHub”。
- 前端页面标题和 favicon 改为“文枢 AI WriterHub”。
- 编辑器、翻译、格式整理示例内容中的产品名改为“文枢 AI WriterHub”。
- 后端 FastAPI 标题改为“文枢 AI WriterHub API”。
- 健康检查服务名改为 `writerhub-api`。
- 翻译术语表将“文枢 AI WriterHub”映射为 `Wenshu AI WriterHub`。
- 前端包名改为 `writerhub-frontend`。
- `README.md` 和需求文档中的主产品名改为“文枢 AI WriterHub”。

说明：历史阶段日志中仍保留少量旧名称，用于记录当时验收结果和目录变更背景。

## 2026-05-23 后端 .env 配置

用户要求先创建 `.env`，方便后续功能测试。已完成：

- 更新根目录 `.gitignore`，忽略 `.env` 和 `backend/.env`。
- 新增 `backend/.env.example`。
- 新增 `backend/.env`。
- 新增 `backend/app/core/config.py`，通过 `pydantic-settings` 读取 AI 模型配置。
- 新增 `backend/app/routers/config.py`。
- 在 `backend/app/main.py` 注册 `GET /api/config/ai`。
- 更新 `backend/requirements.txt`，增加 `pydantic-settings`。
- 新增 `editorai_project/env_config_note.md`。

验证结果：

- 已安装新增依赖。
- FastAPI 应用已注册 `/api/config/ai`。
- 已重启 FastAPI 后端服务，当前后端进程 ID 为 `26300`。
- `GET http://127.0.0.1:8000/api/config/ai` 返回模型配置摘要，并且只返回 `has_api_key`，不暴露 API Key。
- `GET http://127.0.0.1:8000/api/health` 返回 `status=ok`、`service=writerhub-api`。

## 2026-05-23 翻译改为统一使用大模型

用户明确要求翻译统一使用已提供的大模型，不再使用 mock 翻译。已完成：

- 更新 `backend/requirements.txt`，新增 `httpx`。
- 重写 `backend/app/services/translation_service.py`。
- `/api/translate` 现在调用 OpenAI-compatible `POST {AI_BASE_URL}/chat/completions`。
- 短文本：直接调用模型翻译，不生成概要。
- 长文本：先调用模型通读全文生成概要，再把概要作为上下文补充分块翻译。
- 右侧 UI 不展示翻译策略和概要，仅后端内部执行。
- 如果 `backend/.env` 未配置 `AI_API_KEY`，接口返回 400，不再静默 mock。

验证结果：

- 已安装 `httpx`。
- FastAPI 导入检查通过，`/api/translate` 已注册。
- 已重启 FastAPI 后端服务，当前后端进程 ID 为 `32188`。
- `GET http://127.0.0.1:8000/api/health` 返回 `status=ok`。
- `GET http://127.0.0.1:8000/api/config/ai` 返回模型配置摘要，`has_api_key=True`，不暴露真实 Key。
- 为避免消耗额度，未主动调用真实翻译请求；可在前端翻译页输入“你好”测试。

## 2026-05-23 翻译提示与模型调用拆分

用户要求：

- 不展示“短文本已直接翻译”等翻译完成提示，翻译完成后直接展示译文。
- 调用大模型的函数独立出来。
- Prompt 单独放一个文件夹，方便后续管理。

已完成：

- 前端 `TranslatePage` 删除翻译完成策略提示，仅保留失败提示和复制成功提示。
- 修复 `TranslatePage` 中的中文显示文本。
- 新增 `backend/app/services/llm_client.py`，统一封装 OpenAI-compatible Chat Completions 调用。
- 新增 `backend/app/prompts/translation.py`，集中管理翻译概要 prompt 和翻译 prompt。
- 新增 `backend/app/prompts/__init__.py`。
- 重写 `backend/app/services/translation_service.py`，只保留翻译策略编排、文本切分和调用 prompt/client。

验证结果：

- `npm run build` 通过。
- FastAPI 导入检查通过，`/api/translate` 正常注册。
- Prompt 模块导入检查通过。
- 已重启 FastAPI 后端服务，当前后端进程 ID 为 `31324`。
- `GET http://127.0.0.1:8000/api/health` 返回 `status=ok`。
- `GET http://127.0.0.1:8000/api/config/ai` 返回模型配置摘要，`has_api_key=True`，不暴露真实 Key。

### 翻译失败修复

用户反馈翻译仍然失败，并要求所有 prompt 使用中文书写。排查结果：

- `/api/translate` 返回 500 的直接原因是 `translation.py` 路由中调用异步 `translate_with_strategy` 时漏写了 `await`。
- 服务函数直接调用大模型可以成功，但 FastAPI 路由因为未 await coroutine 导致 500。
- 已修复路由中的 `await`。
- 已将 `backend/app/prompts/translation.py` 中的概要 prompt 和翻译 prompt 全部改为中文。
- 已优化短文本路径，单段短文本翻译后复用同一结果，不再为了 `paragraph_pairs` / `sentence_pairs` 重复调用模型。

验证结果：

- 后端导入检查通过。
- 前端 `npm run build` 通过。
- 已重启 FastAPI 后端服务，当前后端进程 ID 为 `34316`。
- 使用 Unicode escape 测试 `你好`，`POST /api/translate` 返回 200。
- 返回 `source_text='你好'`，`target_text='Hello.'`，`used_context_summary=False`。

## 2026-05-23 编辑器工具栏功能修复

用户指出编辑器上方加粗、斜体等按钮无法使用。原因是此前这些按钮只是图标展示，没有绑定 Markdown 编辑操作。

已完成：

- 重写 `frontend/src/pages/EditorPage.tsx`，修复中文显示文本。
- 为编辑器 textarea 增加 `ref`，支持读取和恢复光标选区。
- 加粗按钮：将选中文本包裹为 `**文本**`。
- 斜体按钮：将选中文本包裹为 `*文本*`。
- 标题按钮：给选中行添加 `## ` 前缀。
- 列表按钮：给选中行添加 `- ` 前缀。
- 代码按钮：单行包裹为行内代码，多行或空选区插入代码块。
- 图片按钮：插入 Markdown 图片语法。
- 未选中文本时插入合理占位内容。
- 操作后保持编辑器聚焦，并选中插入内容便于继续输入。
- 更新 `frontend/src/styles/global.css`，让工具栏按钮保持图标工具样式。

验证结果：

- `npm run build` 通过。
