# 实现路线

## 技术栈方向

后续实现建议前端使用 React + Vite，后端使用 FastAPI。该组合适合快速构建单页 Web 应用和清晰的 API 服务，便于先实现高保真界面和前端交互，再逐步接入 AI、文档解析、格式导出和检索问答能力。

建议前端基础技术：

- React
- Vite
- TypeScript
- CSS Modules 或 Tailwind CSS
- Markdown 解析库，例如 `remark` / `rehype` / `marked`
- 富文本复制能力使用浏览器 Clipboard API

建议后端基础技术：

- FastAPI
- Pydantic
- Uvicorn
- Python 文档解析库，例如 `python-docx`、`pypdf`、`openpyxl`
- Word 导出可优先使用 `python-docx`
- PDF 导出可根据部署环境选择 WeasyPrint、LibreOffice 转换或浏览器打印方案
- 检索索引可先使用本地向量库或轻量数据库，后续再替换为生产级向量数据库

## 前端结构建议

### 页面

- `EditorPage`：文本和 Markdown 编辑。
- `TranslatePage`：中英互译和多视图对照。
- `FormatPage`：自然语言格式解析、配置和导出预览。
- `DocQAPage`：多文档上传、检索问答和来源展示。

### 共享布局

- `AppShell`：整体框架。
- `Sidebar`：左侧导航。
- `Topbar`：顶部文档栏。
- `Statusbar`：底部状态信息。
- `RightPanel`：右侧辅助栏容器。

### 共享组件

- `SegmentedControl`：视图模式切换。
- `IconButton`：图标按钮。
- `DocumentTitle`：文档标题与保存状态。
- `MarkdownEditor`：Markdown 输入区。
- `MarkdownPreview`：Markdown 预览区。
- `ExportActions`：导出操作。
- `CitationTag`：引用来源标签。
- `FileStatusBadge`：文档解析状态。

## 数据模型建议

### 文档

```ts
type DocumentItem = {
  id: string;
  name: string;
  type: "pdf" | "docx" | "md" | "xlsx";
  sizeLabel: string;
  pageCount?: number;
  status: "parsed" | "indexing" | "searchable" | "failed";
  selected: boolean;
};
```

### 翻译结果

```ts
type TranslationResult = {
  sourceText: string;
  targetText: string;
  direction: "zh-en" | "en-zh";
  displayMode: "split" | "paragraph" | "sentence";
};
```

### 格式配置

```ts
type FormatConfig = {
  bodyFont?: string;
  bodySize?: string;
  lineHeight?: string;
  firstLineIndent?: string;
  titleFont?: string;
  titleSize?: string;
  titleAlign?: "left" | "center" | "right";
  pageMargin?: string;
  header?: string;
  footer?: string;
};
```

### 问答引用

```ts
type Citation = {
  id: string;
  fileName: string;
  pageLabel?: string;
  snippet: string;
  relevance?: number;
};
```

## AI 接口预留

当前前端可先使用 mock 数据。后续接入 FastAPI 后端时建议拆分为以下能力：

- `POST /api/markdown/detect`：检测 Markdown。
- `POST /api/translate`：文本翻译。
- `POST /api/format/parse`：自然语言格式解析。
- `POST /api/format/apply`：应用格式。
- `POST /api/export/docx`：导出 Word。
- `POST /api/export/pdf`：导出 PDF。
- `POST /api/documents/upload`：上传文档。
- `POST /api/documents/index`：建立检索索引。
- `POST /api/documents/ask`：基于文档问答。

## 后端结构建议

FastAPI 后端建议按能力拆分模块：

- `main.py`：创建 FastAPI 应用，挂载路由和中间件。
- `routers/`：按 Markdown、翻译、格式、导出、文档问答拆分 API。
- `schemas/`：使用 Pydantic 定义请求和响应模型。
- `services/`：封装 AI 调用、文档解析、格式解析、导出、检索逻辑。
- `storage/`：封装上传文件、解析结果、索引数据的存储访问。
- `core/`：配置、日志、异常处理、鉴权预留。

后端第一阶段可以使用 mock AI 服务，保证 API 结构和前端联调流程先稳定。

## 实现顺序

1. 创建 React + Vite 项目骨架。
2. 创建 FastAPI 后端骨架，提供健康检查和 mock API。
3. 实现统一布局：左侧导航、顶部栏、底部状态栏。
4. 按示例图实现四个页面的静态 UI。
5. 实现前端状态切换：
   - 页面导航
   - 编辑 / 预览 / 分屏
   - 翻译方向
   - 翻译展示模式
   - 文档选中状态
6. 接入 Markdown 解析和预览。
7. 前端调用 FastAPI mock 接口模拟翻译、格式解析、导出、文档问答。
8. 增加复制、导出按钮的前端占位逻辑。
9. 后续接入真实 AI、文件处理、索引检索和导出服务。

## 验收标准

- 四个主页面都能从左侧导航进入。
- 编辑页能输入 Markdown 并切换预览。
- 翻译页能切换翻译方向和展示方式。
- 格式整理页能根据示例指令展示结构化配置和页面预览。
- 文档问答页能展示文档列表、检索结果、AI 回答和引用片段。
- 界面风格与示例图保持一致。
