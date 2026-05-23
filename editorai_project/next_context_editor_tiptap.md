# 文枢 AI WriterHub 编辑器升级交接上下文

## 项目位置

- 项目根目录：`F:\text_editor`
- 前端目录：`F:\text_editor\frontend`
- 后端目录：`F:\text_editor\backend`
- 文档 / 日志目录：`F:\text_editor\editorai_project`
- 前端参考图目录：`F:\text_editor\fronted_picture`

## 当前产品定位

项目正式名称：**文枢 AI WriterHub**

核心定位不是聊天应用，而是：

> 以文本编辑为主，AI 辅助增强的智能文本编辑器 Web 应用。

当前重点正在做编辑器页面，目标是更接近语雀式轻量文档编辑体验。

## 已完成的重要调整

### 1. 项目结构

`frontend` 和 `backend` 已经放在主目录 `F:\text_editor` 下，不在 `editorai_project` 下。

`editorai_project` 只用于 Markdown 文档、开发计划、日志和交接记录。

### 2. 前端

前端使用：

- React
- Vite
- TypeScript
- lucide-react

启动脚本：

```bash
cd frontend
npm run dev
```

默认前端地址：

```text
http://127.0.0.1:5173
```

当前编辑器页面文件：

```text
frontend/src/pages/EditorPage.tsx
```

当前全局样式文件：

```text
frontend/src/styles/global.css
```

### 3. 后端

后端使用 FastAPI。

后端配置文件：

```text
backend/.env
backend/.env.example
backend/app/core/config.py
```

后端已经接入 OpenAI-compatible 模型调用：

```text
backend/app/services/llm_client.py
```

Prompt 已拆到：

```text
backend/app/prompts/
```

翻译相关 prompt 要求全部使用中文书写。

## 当前编辑器状态

编辑器已经从最早的 textarea 方案改成过手写 `contenteditable` 方案。

最新用户判断：

> 既然编辑区本身已经是可视化富文本，就没必要再保留预览和分屏展示。

因此当前编辑页已经改成：

```text
顶部操作栏
主编辑区
右侧 AI 助手
```

已经去掉：

- 编辑 / 预览 / 分屏切换
- 独立预览面板
- 图片插入按钮
- 不明确的 `H` 按钮

当前保留：

- 复制 Markdown
- 复制纯文本
- 复制富文本
- Markdown 检测状态
- 右侧 AI 助手

最近一次前端构建通过：

```bash
npm run build
```

## 最新产品决策：升级为语雀式块编辑器

用户提出想参考语雀编辑页，目标功能包括：

- 简单加粗
- 不同结构的隐蔽分组
- 代码块
- 高亮块
- 变换字体颜色
- 变换字体大小
- 背景颜色
- 格式刷

经过讨论，已达成一致：

> 不继续扩展手写 contenteditable，下一步改用 Tiptap / ProseMirror 编辑器内核，实现轻量语雀式块编辑器。

原因：

- 语雀更接近块编辑器，不是普通 textarea。
- 手写 contenteditable 对基础格式可用，但处理选区、块结构、格式刷、折叠块、代码块等能力会很脆。
- Tiptap 基于 ProseMirror，适合实现块级文档模型和可扩展工具栏。

## 第一版编辑器功能范围

用户已同意以下范围。

### 必须保留

- 加粗
- 斜体
- 删除线
- 行内代码
- 标题：一级、二级、三级即可
- 无序列表
- 有序列表
- 引用块
- 代码块
- 高亮块 / 提示块
- 文字颜色
- 背景颜色
- 字号：正文、小标题、大标题这类档位，不做自由输入
- 格式刷
- 复制为 Markdown
- 复制为纯文本
- 复制为富文本

### 块结构

- 普通段落
- 标题块
- 列表块
- 引用块
- 代码块
- 高亮块
- 折叠块，也就是用户说的“隐蔽分组”

折叠块建议先做成类似：

```text
▶ 标题
  这里是隐藏内容
```

点击后展开 / 收起。

### 暂时不做

- 图片上传
- 表格
- 公式
- 流程图
- 思维导图
- 多栏布局
- 附件嵌入
- 评论协作
- 历史版本
- 自定义 CSS

## 工具栏建议分组

第一版工具栏建议：

```text
文本：加粗 / 斜体 / 删除线 / 行内代码
结构：标题 / 列表 / 引用 / 折叠块
插入：代码块 / 高亮块
样式：字号 / 文字色 / 背景色 / 格式刷
复制：Markdown / 纯文本 / 富文本
```

## 刚刚发生的依赖安装状态

用户要求先记录上下文，额度不多，因此没有继续完整实施。

我曾开始执行：

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-placeholder @tiptap/extension-typography @tiptap/extension-underline
```

命令被用户中断。

中断后检查 `frontend/package.json`，发现 Tiptap 依赖已经写入：

```json
"@tiptap/extension-color": "^3.23.6",
"@tiptap/extension-highlight": "^3.23.6",
"@tiptap/extension-placeholder": "^3.23.6",
"@tiptap/extension-text-style": "^3.23.6",
"@tiptap/extension-typography": "^3.23.6",
"@tiptap/extension-underline": "^3.23.6",
"@tiptap/react": "^3.23.6",
"@tiptap/starter-kit": "^3.23.6"
```

明天新对话继续时，第一步建议先在 `frontend` 下执行：

```bash
npm install
npm run build
```

确认：

- `node_modules` 是否完整
- `package-lock.json` 是否已经更新
- 当前手写 contenteditable 版本是否仍可构建

## 明天继续开发建议步骤

### 步骤 1：确认依赖状态

```bash
cd F:\text_editor\frontend
npm install
npm run build
```

### 步骤 2：重写编辑器内核

用 Tiptap 替换 `frontend/src/pages/EditorPage.tsx` 中当前手写 contenteditable 逻辑。

建议引入：

- `useEditor`
- `EditorContent`
- `StarterKit`
- `TextStyle`
- `Color`
- `Highlight`
- `Placeholder`
- `Typography`
- `Underline`

### 步骤 3：实现基础工具栏

先实现：

- 加粗
- 斜体
- 删除线
- 行内代码
- H1 / H2 / H3
- 无序列表
- 有序列表
- 引用块
- 代码块
- 文字颜色
- 背景颜色
- 字号档位

### 步骤 4：实现自定义块

建议新增 Tiptap 自定义扩展：

- `CalloutBlock`：高亮块 / 提示块
- `ToggleBlock`：折叠块 / 隐蔽分组
- `FontSize`：字号 mark

### 步骤 5：实现格式刷

第一版格式刷可以先做简化：

- 从当前选区读取 marks 和当前块类型。
- 点击“格式刷”后进入待应用状态。
- 用户选中另一段文字后，再点击目标或按钮，将保存的 marks 应用到目标选区。

第一版可以只复制：

- bold
- italic
- strike
- code
- textStyle.color
- textStyle.fontSize
- highlight.color

块级结构复制可后置。

### 步骤 6：复制能力

继续保留：

- 复制纯文本：`editor.getText()`
- 复制富文本：`editor.getHTML()`
- 复制 Markdown：第一版可以先用自定义 HTML -> Markdown 转换函数，后续再引入更可靠的序列化方案。

## 明天新对话可以直接这样开始

建议用户明天对新 Codex 说：

```text
请读取 F:\text_editor\editorai_project\next_context_editor_tiptap.md，然后继续把编辑器升级为 Tiptap 块编辑器。
```

## 注意事项

- 不要把 `backend` 和 `frontend` 放回 `editorai_project`。
- 不要恢复预览 / 分屏编辑模式。
- 不要恢复图片插入功能。
- 不要把页面做成长滚动；当前产品仍希望尽量是一屏式工作台。
- 中文展示文本要保持正常中文，不要引入乱码。
- 前端图标继续使用 `fronted_picture/logo.png` 同步到 `frontend/public/logo.png`。
- 项目品牌左上角只展示“文枢”。
