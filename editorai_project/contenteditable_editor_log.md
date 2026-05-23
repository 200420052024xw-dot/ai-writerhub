# 2026-05-23 编辑器 contenteditable 改造日志

## 背景

用户要求将编辑器切换为 `contenteditable + 实时解析 Markdown` 方案，并修正工具栏行为。

## 已完成

- 重写 `frontend/src/pages/EditorPage.tsx`，编辑区由 `textarea` 改为 `contenteditable` 富文本编辑区。
- 加粗、斜体、标题、列表、代码、文字颜色、背景颜色工具栏按钮现在直接作用于编辑视图选区。
- 删除图片插入功能。
- 将不明确的 `H` 按钮改为中文“标题”。
- 编辑区输入和工具栏操作后，会将当前富文本 HTML 同步转换为 Markdown 状态。
- Markdown 预览区继续基于同步后的 Markdown 实时渲染。
- 复制 Markdown、复制纯文本、复制富文本功能继续保留。
- 更新 `frontend/src/styles/global.css`，新增富文本编辑区、颜色工具、标题/列表/代码等编辑态样式。

## 验证

- `npm run build` 通过。
