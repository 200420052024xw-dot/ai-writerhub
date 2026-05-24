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

## 2025-05-24 开发记录：Tiptap 编辑器升级完成

### 已完成的工作

#### 1. 依赖确认

```bash
cd frontend
npm install
npm run build
```

Tiptap 依赖已完整安装，项目构建通过。

#### 2. 编辑器内核替换

`frontend/src/pages/EditorPage.tsx` 已从手写 `contenteditable` 重写为 Tiptap。

引入的 Tiptap 扩展：

- `@tiptap/starter-kit`（Heading、Bold、Italic、Strike、Code、CodeBlock、Blockquote、BulletList、OrderedList、HorizontalRule、History 等）
- `@tiptap/extension-text-style`
- `@tiptap/extension-color`
- `@tiptap/extension-highlight`（多色支持）
- `@tiptap/extension-placeholder`
- `@tiptap/extension-typography`
- `@tiptap/extension-underline`

#### 3. 工具栏实现

工具栏分组：

- **撤销/重做**：Undo、Redo
- **段落选择**：下拉菜单，正文 / H1 / H2 / H3
- **字号档位**：下拉菜单，正文(16px) / 小标题(20px) / 大标题(24px) / 特大(32px)
- **文本格式**：加粗、斜体、删除线、下划线、行内代码
- **文字色**：下拉颜色选择器（默认/红/橙/绿/蓝/紫/灰）
- **背景色**：下拉颜色选择器（无/黄/绿/蓝/红/紫）
- **块结构**：无序列表、有序列表、引用、代码块
- **自定义块**：高亮块（提示）、折叠块（折叠）
- **格式刷**：复制选区 marks 应用到目标文字

#### 4. 自定义 Tiptap 扩展

新建目录 `frontend/src/extensions/`，包含三个扩展：

- `CalloutBlock.ts`：高亮块 / 提示块，渲染为带黄色左边框和灯泡 emoji 的 div
- `ToggleBlock.ts`：折叠块 / 隐蔽分组，基于 `<details>` + `<summary>` 实现展开/收起
- `FontSize.ts`：字号 mark，支持任意像素值（如 `16px`、`20px`）

#### 5. 格式刷

第一版格式刷已实现：

- 从当前选区读取 marks：bold、italic、strike、code、underline、textStyle.color、textStyle.fontSize、highlight.color
- 点击”格式刷”按钮后进入待应用状态（按钮高亮）
- 选中目标文字后自动将保存的 marks 应用到目标选区
- 再次点击格式刷按钮可取消状态

#### 6. 复制能力

三种复制方式已保留并适配 Tiptap：

- **复制 Markdown**：自定义 `htmlToMarkdown()` 函数，从 `editor.getHTML()` 转换
- **复制纯文本**：`editor.getText()`
- **复制富文本**：`editor.getHTML()`，通过 `ClipboardItem` 写入 `text/html` + `text/plain`

#### 7. CSS 更新

`frontend/src/styles/global.css` 新增样式：

- `.editor-toolbar` 系列：工具栏容器、按钮组、分隔线、下拉菜单
- `.toolbar-btn` / `.toolbar-btn.active` / `.toolbar-btn:disabled`
- `.dropdown-menu` / `.dropdown-item`
- `.color-picker-grid` / `.color-swatch`
- `.tiptap-editor` / `.tiptap` / `.ProseMirror`：编辑器内容区
- Tiptap 内容样式：h1/h2/h3、p、ul/ol、code、pre、blockquote、hr、mark
- `.callout-block` / `.callout-emoji` / `.callout-content`：高亮块
- `.toggle-block` / `.toggle-summary` / `.toggle-content`：折叠块
- `.tiptap p.is-editor-empty:first-child::before`：Placeholder 样式

已移除旧样式：

- `.format-toolbar` 及其子元素
- `.rich-editor` 及其子元素
- `.color-tool` / `.bg-swatch`

### 当前文件结构变化

```text
frontend/src/
  extensions/
    CalloutBlock.ts    ← 新增
    ToggleBlock.ts     ← 新增
    FontSize.ts        ← 新增
  pages/
    EditorPage.tsx     ← 重写
  styles/
    global.css         ← 更新
```

### 构建状态

```bash
npm run build
# ✓ built in 3.23s
# 有 chunk size warning（625 KB），仅为警告不影响功能
```

## 待续开发建议

下一步可继续：

1. **图片上传**：需要新增 Tiptap 扩展或使用 `@tiptap/extension-image`
2. **表格**：使用 `@tiptap/extension-table` 系列扩展
3. **Markdown 序列化优化**：当前 `htmlToMarkdown()` 是简单自定义实现，后续可引入 `turndown` 等库
4. **代码块语言选择**：当前代码块未实现语言选择 UI，可扩展
5. **折叠块标题编辑**：当前折叠块标题固定为”展开查看详情”，可支持用户自定义
6. **格式刷增强**：支持块级结构复制（列表类型、标题级别等）
7. **chunk size 优化**：可通过 `dynamic import` 或 `manualChunks` 拆分 Tiptap 依赖

## 注意事项

- 不要把 `backend` 和 `frontend` 放回 `editorai_project`。
- 不要恢复预览 / 分屏编辑模式。
- 不要恢复图片插入功能。
- 不要把页面做成长滚动；当前产品仍希望尽量是一屏式工作台。
- 中文展示文本要保持正常中文，不要引入乱码。
- 前端图标继续使用 `fronted_picture/logo.png` 同步到 `frontend/public/logo.png`。
- 项目品牌左上角只展示”文枢”。

## 2026-05-24 开发记录：工具栏下拉、颜色状态、折叠能力修复

### 本次用户反馈

用户测试后确认：

- `<>` 行内代码按钮名称先不改。
- `"` 引用按钮名称先不改。
- 需要保留普通“折叠块”，同时新增“按标题结构折叠”的能力。
- 字号、文字色、背景色下拉打不开，需要修复。
- 文字色 / 背景色需要在按钮上直接体现当前颜色。
- 折叠块标题应该可编辑，折叠块本身也要能真正展开 / 收起。

### 已完成修复

#### 1. 工具栏下拉菜单

`frontend/src/pages/EditorPage.tsx` 中 `DropdownButton` 已改为固定定位浮层：

- 菜单不再被 `.editor-toolbar` 的滚动 / overflow 裁剪。
- 点击外部关闭。
- 点击菜单内部不会被提前卸载。

#### 2. 颜色状态展示

文字色和背景色按钮已显示当前状态：

- 文字色：按钮文字跟随当前选区文字颜色。
- 背景色：按钮内“背景色”标签展示当前背景色。

#### 3. 折叠块升级

`frontend/src/extensions/ToggleBlock.ts` 已从静态 `<details>` 渲染升级为 React NodeView：

- 折叠块标题可编辑。
- 左侧箭头按钮可展开 / 收起。
- 内容区收起时隐藏，展开时正常编辑。
- 插入命令仍为 `editor.chain().focus().setToggle().run()`。

#### 4. 按标题结构折叠

新增 `frontend/src/extensions/StructureFold.ts`：

- 标题 H1 / H2 / H3 左侧显示结构折叠箭头。
- 点击 H1：折叠到下一个 H1 之前的内容。
- 点击 H2：折叠到下一个 H2 或 H1 之前的内容。
- 点击 H3：折叠到下一个 H3 / H2 / H1 之前的内容。
- 折叠只影响编辑器显示，不删除内容。

#### 5. 样式更新

`frontend/src/styles/global.css` 新增 / 调整：

- `.dropdown-menu` 改为 `position: fixed`。
- `.color-label` 用于背景色状态展示。
- `.toggle-control`、`.toggle-title-input`、`.toggle-block[data-open]` 用于新版折叠块。
- `.structure-fold-control`、`.structure-fold-hidden`、`.structure-fold-heading-folded` 用于标题结构折叠。

### 构建状态

```bash
npm run build
# ✓ built in 3.27s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

### 当前新增文件

```text
frontend/src/extensions/StructureFold.ts
```

### 后续注意

- 结构折叠当前是第一版，只处理文档顶层 H1 / H2 / H3 结构。
- 如果后续要支持列表内部标题、引用块内部标题等嵌套结构，需要进一步扩展折叠范围计算。
- 折叠块标题现在是输入框，后续可继续优化为更像正文编辑体验的标题区域。

## 2026-05-24 开发记录：工具栏重排、颜色按钮改造、结构折叠修正

### 本次用户反馈

用户继续测试后指出：

- 按标题层级折叠仍不能正常折叠。
- 文字色 / 背景色不应使用文字下拉按钮，应参考 WPS：主按钮直接应用当前颜色，右侧小箭头打开颜色选择。
- 不再保留“字号”功能。
- “段落”只保留正文和一级到五级标题。
- 格式刷放到工具栏最左边。

### 已完成调整

#### 1. 工具栏顺序

`frontend/src/pages/EditorPage.tsx` 中工具栏已重排：

- 格式刷移动到最左侧。
- 撤销 / 重做跟在格式刷后。
- 段落下拉保留正文、标题 1、标题 2、标题 3、标题 4、标题 5。
- 删除字号下拉。

#### 2. 文字色 / 背景色

新增 WPS 式分裂颜色按钮：

- 左侧主按钮：直接应用当前工具颜色。
- 右侧小箭头：打开颜色面板。
- 文字色用 `Type` 图标和底部颜色线表示当前文字颜色。
- 背景色用 `Highlighter` 图标和小色块表示当前背景色。
- 工具颜色由按钮状态记忆，不再随当前选区反复变化。

#### 3. 删除字号扩展

- `frontend/src/extensions/FontSize.ts` 已删除。
- `EditorPage.tsx` 不再导入和注册 `FontSize`。
- 后续复制 / 格式刷中可能仍会兼容历史 HTML 的 font-size，但 UI 不再提供字号能力。

#### 4. 结构折叠修正

`frontend/src/extensions/StructureFold.ts` 已修复：

- 顶层节点位置由 `offset + 1` 修正为 `offset`，避免节点装饰无法命中块边界。
- 折叠按钮设置 `contentEditable=false`，避免被编辑器可编辑区吞掉交互。
- 结构折叠扩展现在支持 H1-H5。

### 构建状态

```bash
npm run build
# ✓ built in 3.04s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：Markdown 检测修复

### 问题

用户反馈编辑器检测不出 Markdown 格式。

原因是 Tiptap 编辑器内部内容是 HTML，之前检测时直接把 `editor.getHTML()` 发送给后端 `/api/markdown/detect`。后端检测规则只识别 Markdown 原文语法，例如 `# heading`、`- list`、``` fenced code ``` 等，因此 HTML 内容无法稳定命中。

### 修复

`frontend/src/pages/EditorPage.tsx` 已调整：

- 检测前先调用现有 `htmlToMarkdown(editor.getHTML())`。
- 再把序列化后的 Markdown 文本传给 `detectMarkdown()`。
- 复制 Markdown 和 Markdown 检测现在使用同一套 HTML -> Markdown 转换逻辑。

### 构建状态

```bash
npm run build
# ✓ built in 3.04s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：Markdown 检测前端兜底

### 问题

用户反馈仍然检测不出 Markdown。实际排查发现：

- `http://127.0.0.1:8000/api/health` 无法连接。
- `/api/markdown/detect` 也无法连接。
- 因此前端请求进入 `catch` 后会把状态改成“未检测到 Markdown”。

### 修复

`frontend/src/pages/EditorPage.tsx` 新增前端本地 Markdown 检测规则：

- 使用与后端基本一致的正则规则检测 heading、list、blockquote、code、bold、italic、hr 等。
- 检测时仍先将 Tiptap HTML 序列化为 Markdown。
- 先用本地检测结果更新 UI。
- 如果后端接口可用，再用后端结果覆盖；如果后端不可用，不再把状态改成未检测。

### 构建状态

```bash
npm run build
# ✓ built in 3.15s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：Markdown 转换确认流程

### 产品逻辑调整

用户明确：检测到 Markdown 后，不应只显示检测状态，而应该询问用户是否快速转换成当前可编辑富文本视图。

### 已完成

`frontend/src/pages/EditorPage.tsx` 新增 Markdown 转换流程：

- 使用 `editor.getText()` 检测编辑区里是否存在原始 Markdown 语法。
- 如果检测到 `# 标题`、`- 列表`、代码围栏、引用、粗体等原始 Markdown，顶部显示确认提示：
  - “转换”：将 Markdown 转换成 Tiptap 可编辑富文本 HTML。
  - “暂不”：忽略当前这段 Markdown，不反复弹出。
- 已格式化的 Tiptap 富文本不会因为序列化结果含 Markdown 而反复弹窗。

### 转换能力

新增 `markdownToHtml()` 简易转换函数，当前支持：

- H1-H5 标题
- 无序列表
- 有序列表
- 引用块
- 代码块
- 行内代码
- 粗体
- 斜体
- 链接
- 分割线

### 样式

`frontend/src/styles/global.css` 新增：

- `.markdown-convert-prompt`

### 构建状态

```bash
npm run build
# ✓ built in 3.13s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：侧边栏品牌 Logo 调整

### 用户要求

首页左上角不再单独放文字，改为直接放带文字的 logo 图标，并注意大小。

### 已完成

- 从 `frontend/public/logo.png` 裁剪生成适合侧边栏展示的横向 logo：
  - `frontend/public/logo-brand.png`
- `frontend/src/layouts/AppShell.tsx` 中品牌区改为直接渲染 `<img>`。
- `frontend/src/styles/global.css` 中品牌区调整为：
  - `.brand` 高度 66px。
  - `.brand-logo` 显示为 198px × 66px。
  - 使用 `object-fit: contain`，避免变形。

### 构建状态

```bash
npm run build
# ✓ built in 2.98s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：编辑器上侧栏删除与复制按钮迁移

### 用户要求

- 删除“复制富文本”。
- 将“复制 Markdown”和“复制纯文本”放到工具栏“折叠”按钮右侧。
- 删除编辑器上侧整条状态栏。

### 已完成

`frontend/src/pages/EditorPage.tsx`：

- 删除编辑器页面顶部 `mode-bar`。
- 删除复制富文本入口和相关 clipboard HTML 写入逻辑。
- `EditorToolbar` 增加 `onCopy` 参数。
- 在“提示 / 折叠”按钮组右侧新增：
  - 复制 Markdown
  - 复制纯文本

`frontend/src/styles/global.css`：

- 针对 `.editor-page .editor-layout` 重新计算高度，补回删除上侧栏后释放出的空间。

### 构建状态

```bash
npm run build
# ✓ built in 3.11s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：文枢助手空态与输入框优化

### 已完成

- 右侧文枢助手空态中，`Sparkles` 图标移动到提示文案上方。
- 空态改为居中纵向布局。
- 底部输入框样式优化：
  - 输入框高度增大。
  - 边框、聚焦态和内阴影优化。
  - 发送按钮加大到 40px，并增加悬停与禁用状态。

### 构建状态

```bash
npm run build
# ✓ built in 3.66s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：Markdown 转换提示改为首次粘贴触发

### 用户要求

Markdown 语法检测转换提示只在粘贴到编辑器的第一次出现。

### 已完成

`frontend/src/pages/EditorPage.tsx`：

- 删除基于内容变化的持续 Markdown 转换提示检测。
- 改为 Tiptap `editorProps.handlePaste` 中读取剪贴板纯文本。
- 只有第一次粘贴到编辑器、且剪贴板文本包含 Markdown 语法时，才显示“是否转换为可编辑格式”提示。
- 用户选择“转换”或“暂不”后，本次页面会话内不会再次弹出该提示。

### 构建状态

```bash
npm run build
# ✓ built in 3.05s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：文档大标题与顶部标题同步

### 用户要求

参考 `fronted_picture/img.png`：

- 顶部文档标题和编辑区第一行大标题保持一致。
- 必须输入大标题。
- 未输入时按参考图显示“无标题文档”和大号“请输入标题”占位。

### 已完成

`frontend/src/layouts/AppShell.tsx`：

- 新增 `editorTitle` 状态。
- 顶部标题在编辑页显示 `editorTitle`。
- 没有大标题时显示“无标题文档”。
- 编辑页标题变化通过 `EditorPage onTitleChange` 回传。

`frontend/src/pages/EditorPage.tsx`：

- 初始内容改为 `<h1></h1><p></p>`。
- Tiptap Placeholder 改为：
  - 第一行 H1：`请输入标题`
  - 正文：`直接输入正文，也可选择一个模板`
- 通过第一个 H1 提取文档标题并同步到顶部。

`frontend/src/extensions/StructureFold.ts`：

- 第一行 H1 作为文档标题，不显示结构折叠箭头。

`frontend/src/styles/global.css`：

- 编辑区留出更像文档编辑器的内边距。
- 第一行 H1 占位放大。
- 顶部“无标题文档”显示为弱化状态。

### 构建状态

```bash
npm run build
# ✓ built in 3.11s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```

## 2026-05-24 开发记录：标题输入改为独立文件名输入框

### 问题

用户反馈全空时只显示“开始输入内容...”，没有显示“请输入标题”。同时明确：标题就是文件名称。

### 调整

参考 `fronted_picture/img.png` 后，标题不再依赖 Tiptap 内部空 H1 节点，而是独立为编辑区顶部的文件名输入框。

`frontend/src/pages/EditorPage.tsx`：

- `initialContent` 改为正文空段落 `<p></p>`。
- 新增 `documentTitle` 状态。
- 编辑器顶部新增 `.document-title-input`，占位文字为“请输入标题”。
- 顶部文件名通过 `onTitleChange` 实时同步标题输入框。
- 复制 Markdown 时，如果有标题，会自动在正文前加 `# 标题`。
- 复制纯文本时，如果有标题，会自动把标题放在正文前。
- 粘贴 Markdown 并转换时，如果第一行是 `# 标题`，会提取为文件名标题，剩余内容进入正文编辑器。

`frontend/src/styles/global.css`：

- `.tiptap-editor` 负责文档内边距。
- `.document-title-input` 设置为 34px、800 字重的大标题输入。

### 构建状态

```bash
npm run build
# ✓ built in 3.21s
# 仍有 Tiptap 相关 chunk size warning，仅为警告，不影响功能
```
