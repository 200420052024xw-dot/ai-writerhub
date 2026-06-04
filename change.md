对，你这个方案比我前面说的更适合你们项目。现在可以这样定：

> **系统正文不再以“一整篇 Markdown 字符串”为主存储，而是以“文章 + 段落块”的方式存储。Markdown 只是上传识别后的中间格式，也是导入 / 导出的序列化格式。**

---

# 1. 核心存储模型

只需要先确定两个核心对象：

```text
Document：一篇文章
DocumentParagraph：文章中的一个段落块
```

## Document

保存文章整体信息。

```text
document
- id
- title
- status
- created_at
- updated_at
```

这里不再重点存整篇 `content`。如果要兼容旧代码，可以暂时保留 `content_cache`，但它只是由段落拼出来的缓存，不是主数据。

---

## DocumentParagraph

保存真正的正文内容。

```text
document_paragraph
- id
- document_id
- paragraph_index
- type
- level
- content
- content_hash
- created_at
- updated_at
```

字段解释：

| 字段                | 含义                                                   |
| ----------------- | ---------------------------------------------------- |
| `id`              | 段落 ID，后续翻译、格式、AI 都关联它                                |
| `document_id`     | 所属文章 ID                                              |
| `paragraph_index` | 段落顺序                                                 |
| `type`            | `title` / `heading` / `paragraph` / `list` / `table` |
| `level`           | 层级                                                   |
| `content`         | 这一段的 Markdown 内容或纯文本内容                               |
| `content_hash`    | 判断这一段是否变化                                            |

---

# 2. level 怎么定义

建议这样定：

```text
title       level = 0
heading     level = 1 / 2 / 3 / 4
paragraph   level = 当前所属标题层级
list        level = 当前所属标题层级
table       level = 当前所属标题层级
```

例如原文：

```markdown
# 文档标题

## 一、项目背景

这是正文。

### 1.1 研究意义

这是二级标题下的正文。
```

解析后：

```json
[
  {
    "type": "title",
    "level": 0,
    "content": "文档标题"
  },
  {
    "type": "heading",
    "level": 1,
    "content": "一、项目背景"
  },
  {
    "type": "paragraph",
    "level": 1,
    "content": "这是正文。"
  },
  {
    "type": "heading",
    "level": 2,
    "content": "1.1 研究意义"
  },
  {
    "type": "paragraph",
    "level": 2,
    "content": "这是二级标题下的正文。"
  }
]
```

这样后面很好处理：

```text
格式整理：根据 type + level 套格式
翻译：根据 paragraph_id 对齐
RAG：根据 paragraph_id 分块
AI 对话：可以引用 document_id 或 paragraph_id
```

---

# 3. 上传文件后的处理方案

你上传 Word / PDF / PPT 后，流程应该是：

```text
上传文件
↓
转图片
↓
视觉模型读取
↓
视觉模型输出 Markdown
↓
后端解析 Markdown
↓
生成 Document + DocumentParagraph
↓
进入编辑页面
```

视觉模型只负责输出这种东西：

```markdown
# 文档标题

## 一、项目背景

这是第一段正文。

这是第二段正文。

## 二、系统功能

- 文档编辑
- 长文本翻译
- 格式整理
```

后端再把它解析成段落块。

---

# 4. 编辑页面的处理方案

编辑页面不要直接编辑一整篇字符串，而是编辑段落块列表。

## 加载时

前端请求：

```http
GET /api/documents/{document_id}
```

后端返回：

```json
{
  "id": "doc_001",
  "title": "文档标题",
  "paragraphs": [
    {
      "id": "p001",
      "type": "title",
      "level": 0,
      "content": "文档标题"
    },
    {
      "id": "p002",
      "type": "heading",
      "level": 1,
      "content": "一、项目背景"
    },
    {
      "id": "p003",
      "type": "paragraph",
      "level": 1,
      "content": "这是正文。"
    }
  ]
}
```

前端根据这些段落渲染编辑器。

---

## 编辑时

每个编辑器节点都要带着自己的 `paragraph_id`。

比如 TipTap / ProseMirror 节点内部应该有：

```json
{
  "type": "paragraph",
  "attrs": {
    "paragraphId": "p003",
    "level": 1
  },
  "content": [
    {
      "type": "text",
      "text": "这是正文。"
    }
  ]
}
```

这样用户修改某一段时，系统知道改的是哪一个 `paragraph_id`。

---

## 自动保存时

第一版不用做复杂 diff，可以直接保存当前段落列表：

```http
PUT /api/documents/{document_id}/paragraphs
```

请求：

```json
{
  "paragraphs": [
    {
      "id": "p001",
      "type": "title",
      "level": 0,
      "content": "文档标题"
    },
    {
      "id": "p002",
      "type": "heading",
      "level": 1,
      "content": "一、项目背景"
    },
    {
      "id": "p003",
      "type": "paragraph",
      "level": 1,
      "content": "修改后的正文。"
    }
  ]
}
```

后端处理：

```text
已有 id：更新内容、顺序、level
新段落没有 id：创建新 paragraph_id
前端删除的段落：后端删除或标记删除
顺序变化：更新 paragraph_index
```

这样实现简单，而且稳定。

---

# 5. 新建文档怎么处理

新建文档时，直接创建：

```text
document
```

然后默认创建一个空段落：

```json
{
  "type": "paragraph",
  "level": 0,
  "content": ""
}
```

进入编辑器后，用户输入标题、正文，前端根据用户操作决定段落类型。

例如用户点击“一级标题”，这一段就变成：

```json
{
  "type": "heading",
  "level": 1,
  "content": "一、项目背景"
}
```

---

# 6. Markdown 的角色

Markdown 不再是唯一主存储，而是两个场景使用：

```text
1. 上传识别后的中间结果
2. 导入 / 导出时的序列化结果
```

内部主存储是：

```text
document + document_paragraph
```

也就是说：

```text
Markdown → 解析成段落块 → 存数据库
段落块 → 拼回 Markdown → 导出 / 传给模型
```

---

# 7. 翻译怎么接

这个段落存储方案对翻译很友好。

段段翻译：

```text
paragraph_id → source_text → translated_text
```

句句翻译：

```text
paragraph_id → sentence_index → source_sentence → translated_sentence
```

也就是说，翻译结果可以稳定关联到段落：

```json
{
  "paragraph_id": "p003",
  "mode": "sentence",
  "sentences": [
    {
      "index": 0,
      "source": "这是第一句。",
      "target": "This is the first sentence."
    }
  ]
}
```

这样前端展示“左边一句，右边一句”不会乱。

---

# 8. 格式整理怎么接

格式整理也根据：

```text
type + level
```

来决定样式。

例如：

```text
type = title, level = 0      → 文档标题样式
type = heading, level = 1    → 一级标题样式
type = heading, level = 2    → 二级标题样式
type = paragraph, level = 1  → 正文样式
```

用户如果选择“只格式化一级标题”，就处理：

```text
type = heading AND level = 1
```

如果选择“只格式化正文”，就处理：

```text
type = paragraph
```

---

# 9. 当前编辑页面最终方案

最终编辑页面可以这样设计：

```text
进入编辑页面
↓
加载 document + paragraph 列表
↓
前端把 paragraph 列表转换成编辑器节点
↓
每个节点保留 paragraph_id、type、level
↓
用户编辑内容、调整标题级别、增删段落
↓
自动保存当前 paragraph 列表
↓
后端更新段落表
↓
翻译、格式、RAG 全部根据 document_id / paragraph_id 关联
```

一句话总结：

> **编辑页面不再维护一整篇 content 字符串，而是维护一个有序段落块数组。每个段落块有自己的 id、type、level、content。上传文件先由视觉模型输出 Markdown，再由后端解析成段落块；新建文档直接创建段落块；编辑器渲染和保存的也是段落块。后续翻译、格式整理、AI 对话、RAG 都围绕 document_id 和 paragraph_id 展开。**
