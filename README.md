<div align="center">

# 🖊️ 文枢AI-WriterHub

**AI 驱动的一站式智能办公与知识管理文档处理平台**

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![TipTap](https://img.shields.io/badge/TipTap-Editor-red)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)
![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_DB-purple)
![License](https://img.shields.io/badge/License-MIT-blue)

[功能特性](#-功能特性) • [技术栈](#-技术栈) • [项目结构](#-项目结构) • [快速开始](#-快速开始) • [环境变量](#-环境变量配置) • [部署指南](#-生产部署) • [API 文档](#-api-接口一览)

</div>

---

## 📖 项目简介

**文枢AI-WriterHub** 是一款面向智能办公与知识管理场景的 AI 文档处理平台，融合大模型辅助、多格式文档解析、智能翻译、自动化排版与 RAG 知识库问答能力，打通从资料导入、文档处理、语言转换、格式规范到知识检索的完整工作流，帮助用户以更低成本完成更高效率、更高标准的文档管理、信息整理、翻译排版和知识检索。支持接入 DeepSeek、OpenAI、通义千问、智谱、火山引擎、小米 MiMo、MiniMax 等多种 AI 模型服务商。

---

## ✨ 功能特性

### 🔐 用户认证系统
- 用户注册 / 登录 / 退出，支持中文用户名
- Canvas 验证码防机器人注册
- 基于 Cookie 的 Session 认证，Argon2 密码哈希
- 邮箱找回密码功能
- 个人资料编辑（昵称、密码修改）
- 多用户数据完全隔离

### 📝 富文本编辑器
- 基于 **TipTap** 的所见即所得编辑器
- 完整的格式工具栏：字体颜色、高亮、段落样式、标题层级
- **格式刷**：一键复制粘贴文本样式
- 自定义扩展块：
  - 📌 **Callout 块**：提示/注释高亮块
  - 🔄 **Toggle 块**：可折叠/展开的内容块
  - 📂 **Structure 折叠**：结构化内容折叠
- Markdown 粘贴智能检测与转换
- 复制为 Markdown / 纯文本
- 编辑内容自动保存到后端

### 🤖 AI 文档助手
- 编辑器右侧边栏集成 AI 对话面板
- 流式输出（Streaming），实时显示生成内容
- 支持基于上下文的内容改写、结构整理、摘要提炼和表达优化
- 对话历史持久化存储

### 🌐 智能翻译
- 中文 ↔ 英文 双向翻译
- **段落级** 或 **句子级** 翻译粒度
- 四种语体风格：默认 / 学术 / 商务 / 自然
- AI 术语自动提取 + 术语表管理（增删改、导出下载）
- 术语统一 / 保留专有名词 / 自定义翻译要求
- 分栏对照视图 和 交错对照视图
- 异步翻译任务队列，实时进度显示
- 翻译结果缓存，可保存为新文档
- 多种保存格式：仅译文 / 原文+译文对照 等

### 🎨 智能排版
- 丰富的排版配置：
  - 字体、字号、行高、缩进、对齐方式
  - 纸张大小（A4/B5/Letter 等）、页边距
  - 标题样式、页眉页脚
- **AI 智能解析**：用自然语言描述排版需求，AI 自动解析为配置参数
- **AI 文档整理**：一键清理段落、优化结构
- 纸张风格实时预览
- 导出为 Word（DOCX）或 PDF

### 📚 知识库 RAG 问答
- 文档上传 → 自动分块 → 向量化索引
- 支持文件格式：`.txt` / `.md` / `.doc` / `.docx` / `.pdf` / `.ppt` / `.pptx`
- **文档识别**：上传文件 → 转图片（LibreOffice + PyMuPDF）→ 视觉模型 OCR → 结构化段落
- 两种嵌入方式：
  - 本地嵌入：`sentence-transformers` 模型
  - API 嵌入：远程 Embedding API
- 三种召回策略：纯向量 / 全文检索（MySQL FULLTEXT）/ **混合召回**
- 可选 **Rerank 重排序**
- 流式回答，带引用标注 `[1] [2]`
- 对话历史持久化，支持创建/重命名/删除/更新
- 问答结果可保存为新文档，可配置保存格式

### 📂 文档管理
- 文档列表仪表盘，状态标签（已解析/待处理/索引中/识别中/失败）
- 拖拽上传，支持多文件批量上传（最多 5 个）
- 文档导出：Markdown / Word / PDF
- 软删除 + 15 天回收站，支持恢复和永久删除
- 回收站一键清空

### ⚙️ 灵活配置
- **AI 模型配置**：8 大服务商预设 + 自定义 OpenAI 兼容端点
- **RAG 配置**：嵌入源选择、召回策略、Rerank 开关
- **知识库保存设置**：时间戳、搜索结果、来源标题的开关
- 所有前端配置存储在 localStorage，用户级别隔离

---

## 🛠️ 技术栈

### 后端

| 技术 | 用途 | 版本 |
|------|------|------|
| **FastAPI** | Web 框架 | ≥0.136.0 |
| **Uvicorn** | ASGI 服务器 | ≥0.47.0 |
| **Pydantic v2** | 数据验证 | ≥2.13.0 |
| **MySQL + PyMySQL** | 关系数据库 | ≥1.1.0 |
| **ChromaDB** | 向量数据库 | ≥1.5.0 |
| **sentence-transformers** | 本地 Embedding | ≥5.5.0 |
| **httpx** | 异步 HTTP 客户端（调用 LLM API） | ≥0.28.0 |
| **python-docx** | Word 文档生成 | ≥1.2.0 |
| **PyMuPDF** | PDF 读取 / 转图片 | ≥1.27.0 |
| **Pillow** | 图片处理 | ≥12.2.0 |
| **argon2-cffi** | 密码哈希 | ≥25.1.0 |

### 前端

| 技术 | 用途 | 版本 |
|------|------|------|
| **React** | UI 框架 | ^19.0.0 |
| **TypeScript** | 类型安全 | ^5.8.0 |
| **Vite** | 构建工具 | ^7.0.0 |
| **TipTap** | 富文本编辑器 | ^3.23.6 |
| **Lucide React** | 图标库 | ^0.468.0 |

### AI 模型支持

| 服务商 | 预设模型 |
|--------|----------|
| SiliconFlow | DeepSeek-V4-Flash |
| OpenAI | GPT-4o / GPT-4o-mini |
| DeepSeek | DeepSeek-Chat |
| 通义千问 (Qwen) | Qwen-Plus |
| 智谱 (Zhipu) | GLM-4-Flash |
| 火山引擎 (Volcengine) | Doubao-lite |
| 小米 MiMo | MiMo |
| MiniMax | abab6.5s-chat |
| 自定义 | 任意 OpenAI 兼容端点 |

---

## 📁 项目结构

```
writerhub-ai/
├── backend/                          # 后端 Python 项目
│   ├── .env.example                  # 环境变量模板
│   ├── requirements.txt              # Python 依赖
│   └── app/
│       ├── main.py                   # FastAPI 应用入口
│       ├── core/
│       │   ├── config.py             # Pydantic Settings 配置
│       │   ├── database.py           # MySQL 连接 & 迁移
│       │   └── schema.sql            # 数据库建表脚本（10 张表）
│       ├── routers/                  # API 路由层（10 个路由）
│       │   ├── auth.py               # 认证相关接口
│       │   ├── assistant.py          # AI 文档助手接口
│       │   ├── chat_history.py       # 对话历史接口
│       │   ├── config.py             # 运行时配置接口
│       │   ├── documents.py          # 文档 CRUD 接口
│       │   ├── format.py             # 排版 & 导出接口
│       │   ├── health.py             # 健康检查接口
│       │   ├── markdown.py           # Markdown 检测接口
│       │   ├── rag.py                # RAG 问答接口
│       │   └── translation.py        # 翻译接口
│       ├── schemas/                  # Pydantic 请求/响应模型
│       ├── services/                 # 业务逻辑层
│       │   ├── llm_client.py         # 统一 LLM 调用客户端
│       │   ├── auth_service.py       # 认证 & 会话管理
│       │   ├── document_service.py   # 文档 CRUD & 文件处理
│       │   ├── rag_service.py        # RAG 检索引擎
│       │   ├── translation_service.py      # 翻译服务
│       │   ├── translation_job_service.py  # 异步翻译任务
│       │   ├── translation_state_service.py# 翻译缓存
│       │   ├── assistant_service.py  # AI 助手服务
│       │   ├── format_service.py     # 排版 & DOCX 生成
│       │   ├── markdown_service.py   # Markdown 检测
│       │   └── chat_history_service.py# 对话历史
│       ├── prompts/                  # LLM 系统提示词
│       │   ├── assistant.py          # 文档助手提示词
│       │   ├── documents.py          # OCR 识别提示词
│       │   ├── format.py             # 排版解析提示词
│       │   └── translation.py        # 翻译提示词
│       └── storage/                  # 运行时存储（gitignore）
│           ├── chroma/               # ChromaDB 向量数据
│           └── documents/            # 上传的原始文件
│
├── frontend/                         # 前端 React 项目
│   ├── package.json                  # Node 依赖
│   ├── tsconfig.json                 # TypeScript 配置
│   ├── public/
│   │   └── login-background.png      # 登录页背景图
│   └── src/
│       ├── main.tsx                  # React 入口
│       ├── App.tsx                   # 根组件（认证守卫）
│       ├── types/
│       │   └── index.ts              # 全局类型定义
│       ├── layouts/
│       │   └── AppShell.tsx          # 主布局（侧边栏 + 顶栏）
│       ├── pages/
│       │   ├── AuthPage.tsx          # 登录 / 注册 / 找回密码
│       │   ├── HomePage.tsx          # 文档仪表盘
│       │   ├── EditorPage.tsx        # 富文本编辑器
│       │   ├── TranslatePage.tsx     # 翻译工作台
│       │   ├── FormatPage.tsx        # 文档排版
│       │   ├── DocumentsPage.tsx     # 知识库问答
│       │   └── SettingsPage.tsx      # 系统设置
│       ├── components/
│       │   ├── AccountMenu.tsx       # 用户菜单组件
│       │   └── CaptchaCanvas.tsx     # Canvas 验证码组件
│       ├── extensions/               # TipTap 自定义扩展
│       │   ├── CalloutBlock.ts       # Callout 块
│       │   ├── ToggleBlock.ts        # Toggle 折叠块
│       │   └── StructureFold.ts      # 结构折叠
│       ├── services/
│       │   ├── api.ts                # API 请求封装（~60 个函数）
│       │   ├── modelSettings.ts      # AI 模型配置管理
│       │   ├── ragSettings.ts        # RAG 配置管理
│       │   ├── knowledgeSaveSettings.ts # 知识库保存设置
│       │   └── userStorage.ts        # 用户级 localStorage 隔离
│       └── styles/
│           └── global.css            # 全局样式
│
├── .gitignore                        # Git 忽略配置
└── README.md                         # 项目说明文档
```

---

## 🚀 快速开始

### 前置要求

| 工具 | 版本要求 |
|------|----------|
| **Python** | ≥ 3.10 |
| **Node.js** | ≥ 18 |
| **MySQL** | ≥ 5.7 |
| **LibreOffice** | 任意版本（可选，用于文档转图片识别） |

### 1. 克隆项目

```bash
git clone https://github.com/200420052024xw-dot/writerhub-ai.git
cd writerhub-ai
```

### 2. 后端设置

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 复制环境变量模板并编辑
cp .env.example .env
```

编辑 `backend/.env` 文件，填入后端运行配置：

```env
# MySQL 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_NAME=writerhub

# CORS（开发环境）
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173

# 系统 RAG 服务：本地 Embedding 模型路径
RAG_EMBEDDING_SOURCE=local
RAG_LOCAL_MODEL_PATH=F:\hf_cache\model

# 可选：系统 RAG API 服务（会员选择 API 模型时使用）
RAG_API_KEY=
RAG_BASE_URL=https://api.siliconflow.cn/v1/embeddings
RAG_MODEL=Qwen/Qwen3-VL-Embedding-8B
RAG_RECALL_STRATEGY=hybrid
RAG_ENABLE_RERANK=false
RAG_RERANK_MODEL_PATH=
```

AI 模型配置在前端 **设置页面** 中填写并按用户隔离保存；管理员也可以在后台配置系统模型，供会员用户使用。RAG 的本地模型由后端 `.env` 提供，用户在设置页只需要选择“本地模型”或“API 模型”：选择本地模型时使用 `RAG_LOCAL_MODEL_PATH`，选择 API 模型时使用用户自己的 API 配置，会员开启系统模型后则使用系统提供的 RAG API 配置。

```bash
# 启动后端服务
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

> ⚠️ 首次启动会自动创建数据库和所有数据表，无需手动建表。

### 3. 前端设置

```bash
# 新终端，进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 4. 访问应用

| 服务 | 地址 |
|------|------|
| **前端页面** | http://127.0.0.1:5173 |
| **后端 API** | http://127.0.0.1:8000 |
| **API 文档（Swagger）** | http://127.0.0.1:8000/docs |
| **API 文档（ReDoc）** | http://127.0.0.1:8000/redoc |

---

## ⚙️ 环境变量配置

### 后端环境变量（`backend/.env`）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_HOST` | MySQL 主机 | `localhost` |
| `DB_PORT` | MySQL 端口 | `3306` |
| `DB_USER` | MySQL 用户名 | `root` |
| `DB_PASSWORD` | MySQL 密码 | `root` |
| `DB_NAME` | 数据库名称 | `writerhub` |
| `CORS_ORIGINS` | CORS 允许来源（逗号分隔） | `http://127.0.0.1:5173,http://localhost:5173` |
| `STATIC_DIR` | 前端静态文件目录（生产部署用） | 空 |
| `RAG_EMBEDDING_SOURCE` | 系统默认嵌入来源：`local` 或 `api` | `local` |
| `RAG_LOCAL_MODEL_PATH` | 系统本地 Embedding 模型路径 | `F:\hf_cache\model` |
| `RAG_API_KEY` | 系统 RAG API 密钥（可选） | 空 |
| `RAG_BASE_URL` | 系统 RAG API 地址（可选） | 空 |
| `RAG_MODEL` | 系统 RAG API 模型名（可选） | 空 |
| `RAG_RECALL_STRATEGY` | 召回策略：`vector` 或 `hybrid` | `vector` |
| `RAG_ENABLE_RERANK` | 是否启用 Rerank | `false` |
| `RAG_RERANK_MODEL_PATH` | Rerank 模型路径或 API 模型名 | 空 |

### 前端配置

前端配置通过 **设置页面** 在浏览器中管理，存储在 `localStorage`，支持：

- **AI 模型**：8 大服务商预设 + 自定义端点
- **RAG 设置**：本地/API 模式选择、API 嵌入配置、召回策略、Rerank 开关
- **知识库保存**：时间戳、搜索结果、来源标题开关

当前 AI 调用以用户设置页传入的配置为准；开启“系统模型”时，后端读取管理员后台保存的系统配置。RAG 本地模型路径以 `.env` 为准，不暴露给前端用户填写。

---

## 🗄️ 数据库设计

项目使用 **MySQL** 数据库，共 **10 张表**：

| 表名 | 说明 |
|------|------|
| `users` | 用户信息（用户名、昵称、邮箱、密码哈希） |
| `user_sessions` | 用户会话（Token 哈希，7 天有效期） |
| `schema_migrations` | 数据库迁移记录 |
| `documents` | 文档主表（标题、内容、哈希、RAG 状态、语言、术语表、软删除） |
| `document_paragraphs` | 段落级结构化存储（类型、层级、内容） |
| `knowledge_conversations` | 知识库问答对话历史 |
| `document_assistant_messages` | 文档 AI 助手对话记录 |
| `document_translation_versions` | 翻译版本缓存 |
| `translation_jobs` | 异步翻译任务队列 |
| `rag_chunks` | RAG 文档分块（支持全文索引） |

> 数据库在首次启动时自动创建，无需手动执行 SQL。建表脚本位于 `backend/app/core/schema.sql`。

---

## 🚢 生产部署

### 构建前端

```bash
cd frontend
npm run build
```

构建产物输出到 `frontend/dist/` 目录。

### 配置后端

修改 `backend/.env`：

```env
# 关闭开发 CORS，改为生产域名
CORS_ORIGINS=https://your-domain.com

# 设置前端静态文件目录（绝对路径）
STATIC_DIR=/opt/writerhub/frontend/dist
```

### 启动服务

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

后端会自动服务前端静态文件，并支持 SPA 路由回退（所有非 API 路径返回 `index.html`）。

### 生产部署建议

- 使用 **Nginx** 反向代理，配置 HTTPS
- 使用 **Gunicorn + Uvicorn Worker** 提升并发性能：
  ```bash
  pip install gunicorn
  gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
  ```
- 使用 **systemd** 或 **supervisor** 管理进程
- 确保 LibreOffice 已安装（如需文档识别功能）
- MySQL 建议配置定时备份

---

## 📡 API 接口一览

所有接口前缀为 `/api`，认证接口使用 Cookie Session（`writerhub_session`）。

### 认证接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | ❌ |
| POST | `/api/auth/login` | 用户登录 | ❌ |
| POST | `/api/auth/logout` | 退出登录 | ✅ |
| GET | `/api/auth/me` | 获取当前用户信息 | ✅ |
| PATCH | `/api/auth/profile` | 修改昵称 | ✅ |
| POST | `/api/auth/password` | 修改密码 | ✅ |
| POST | `/api/auth/forgot-password` | 找回密码 | ❌ |

### 文档接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/documents` | 获取文档列表 | ✅ |
| GET | `/api/documents/trash` | 获取回收站 | ✅ |
| POST | `/api/documents` | 创建文档 | ✅ |
| GET | `/api/documents/{id}` | 获取单个文档 | ✅ |
| PUT | `/api/documents/{id}` | 更新文档 | ✅ |
| DELETE | `/api/documents/{id}` | 删除文档（软删除） | ✅ |
| POST | `/api/documents/upload` | 上传文件 | ✅ |
| POST | `/api/documents/upload/quick` | 快速上传 | ✅ |
| POST | `/api/documents/{id}/index` | 索引文档到 RAG | ✅ |
| POST | `/api/documents/{id}/recognize` | 视觉模型识别文档 | ✅ |
| POST | `/api/documents/{id}/restore` | 恢复已删除文档 | ✅ |
| DELETE | `/api/documents/{id}/permanent` | 永久删除文档 | ✅ |
| POST | `/api/documents/trash/purge` | 清空回收站 | ✅ |

### AI 助手接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/assistant/chat` | AI 文档助手对话（流式） | ✅ |

### 翻译接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/translation/extract-terms` | AI 术语提取 | ✅ |
| GET | `/api/translation/workspace` | 获取翻译工作区数据 | ✅ |
| GET | `/api/translation/jobs` | 获取翻译任务列表 | ✅ |
| POST | `/api/translation/jobs` | 创建翻译任务 | ✅ |
| GET | `/api/translation/preview` | 获取翻译预览 | ✅ |

### 排版接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/format/parse` | AI 解析排版指令 | ✅ |
| POST | `/api/format/test-model` | 测试模型连接 | ✅ |
| POST | `/api/format/export/docx` | 导出 Word 文档 | ✅ |
| POST | `/api/format/organize` | AI 文档整理 | ✅ |

### RAG 问答接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/rag/query/stream` | RAG 问答（流式） | ✅ |

### 对话历史接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/chat-history/knowledge/conversations` | 获取知识库对话列表 | ✅ |
| POST | `/api/chat-history/knowledge/conversations` | 创建对话 | ✅ |
| PUT | `/api/chat-history/knowledge/conversations/{id}` | 更新对话 | ✅ |
| DELETE | `/api/chat-history/knowledge/conversations/{id}` | 删除对话 | ✅ |
| GET | `/api/documents/{id}/assistant-history` | 获取助手对话历史 | ✅ |
| PUT | `/api/documents/{id}/assistant-history` | 保存助手对话历史 | ✅ |

### 其他接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | ❌ |
| GET | `/api/config/ai` | 获取 AI 运行时配置 | ✅ |
| POST | `/api/markdown/detect` | 检测内容是否为 Markdown | ✅ |

> 完整的交互式 API 文档请访问：`http://localhost:8000/docs`（Swagger UI）

---

## 🔌 支持的文件格式

| 格式 | 上传 | 导出 | 说明 |
|------|:----:|:----:|------|
| `.txt` | ✅ | ✅ | 纯文本 |
| `.md` | ✅ | ✅ | Markdown |
| `.doc` | ✅ | — | Word 97-2003 |
| `.docx` | ✅ | ✅ | Word 文档 |
| `.pdf` | ✅ | ✅ | PDF（打印导出） |
| `.ppt` | ✅ | — | PowerPoint 97-2003 |
| `.pptx` | ✅ | — | PowerPoint |

---

## 🧠 RAG 检索架构

```
用户提问
    │
    ▼
┌─────────────────────────────────┐
│         查询处理                 │
└─────────────────────────────────┘
    │
    ├──→ 向量检索（ChromaDB）
    │      sentence-transformers 或 API Embedding
    │      余弦相似度 Top-K
    │
    ├──→ 全文检索（MySQL FULLTEXT）
    │      BM25 相关性评分
    │      中文分词支持
    │
    ▼
┌─────────────────────────────────┐
│       混合召回 & 去重            │
│   向量分数 + 全文分数加权合并     │
└─────────────────────────────────┘
    │
    ▼  （可选）
┌─────────────────────────────────┐
│         Rerank 重排序            │
│   Cross-encoder 精排            │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│     LLM 流式生成回答             │
│   引用标注 [1] [2] ...          │
└─────────────────────────────────┘
```

- **分块策略**：每块约 520 字符，100 字符重叠
- **嵌入维度**：取决于所选模型
- **支持语言**：中文、英文

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### Commit 规范

```
feat:     新功能
fix:      Bug 修复
docs:     文档更新
style:    代码格式（不影响逻辑）
refactor: 代码重构
perf:     性能优化
test:     测试相关
chore:    构建/工具链变更
```

---

## 📋 TODO

- [ ] 支持更多语言对翻译（日语、韩语等）
- [ ] 支持更多文档格式导入导出
- [ ] 协同编辑功能
- [ ] 文档版本历史
- [ ] API Key 管理界面
- [ ] Docker Compose 一键部署
- [ ] 移动端适配
- [ ] 插件系统

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star 支持一下！**

</div>
