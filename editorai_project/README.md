# 文枢 AI WriterHub

文枢 AI WriterHub 是一个以文本编辑为核心、AI 辅助增强的 Web 应用。产品重点不是单纯聊天，而是在写作、编辑、翻译、格式整理、文档问答等文档工作流中提供智能能力。

## 项目目标

- 提供顺畅的文本与 Markdown 编辑体验。
- 支持中英互译，并提供多种对照展示方式。
- 支持用一句自然语言描述格式要求，自动解析为结构化排版配置。
- 支持上传多个文档，基于文档内容进行 AI 问答，并展示来源引用。

## 核心模块

1. 文本 / Markdown 编辑
   - 文本输入与编辑。
   - 自动检测 Markdown 语法。
   - 编辑视图、预览视图、分屏视图切换。
   - 复制为 Markdown 原文、普通文本或富文本。

2. 中英互译
   - 中文转英文。
   - 英文转中文。
   - 支持分屏对照、段落交替、句对句对照。

3. 一句话整理格式 + 导出
   - 用户输入自然语言格式要求。
   - 系统解析为字体、字号、行距、缩进、页边距等结构化配置。
   - 预览排版效果。
   - 导出 Word / PDF。

4. 多文档 AI 问答
   - 上传多个文档。
   - 解析并建立检索索引。
   - 基于选中文档提问。
   - 回答展示来源文件和引用片段。

## UI 参考

当前 UI 参考图位于项目根目录的 `fronted_picture` 文件夹：

- `编辑器.png`
- `翻译.png`
- `格式整理.png`
- `文档问答.png`

整体界面采用左侧导航、顶部文档栏、中央工作区、右侧辅助面板的结构。

## 技术方向

实现阶段使用 React + Vite 构建前端应用，使用 FastAPI 构建后端服务。当前已经完成项目初始化，包含前端工程骨架、后端工程骨架和健康检查联调。

## 本地启动

### 后端

```powershell
cd F:\text_editor\backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

健康检查地址：`http://127.0.0.1:8000/api/health`

### 前端

```powershell
cd F:\text_editor\frontend
npm install
npm run dev
```

前端地址：`http://127.0.0.1:5173`
