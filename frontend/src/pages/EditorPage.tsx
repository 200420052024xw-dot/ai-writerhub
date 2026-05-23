import { ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bold, CheckCircle2, Code, Copy, Eye, Italic, List, Palette, Sparkles } from "lucide-react";
import { detectMarkdown } from "../services/api";

type CopyState = "idle" | "done" | "failed";

const markdownSample = `# 文枢 AI WriterHub 产品需求文档

## 1. 项目背景
文枢 AI WriterHub 是一款面向 **开发者与内容创作者** 的智能文本编辑器，集成 AI 能力，提升写作、编辑与协作效率。

## 2. 核心功能
- Markdown 实时编辑与预览
- AI 智能写作辅助与改写
- 多语言翻译与润色
- 格式整理与一键美化
- 导出为多种格式（PDF / Word / HTML 等）

### 2.1 代码示例
\`\`\`python
def greet(name: str) -> str:
    return f"你好，{name}，欢迎使用文枢 AI WriterHub！"
\`\`\`

> 智能工具，让创作更高效。

---

最后更新：2024-05-20`;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function restoreSafeInlineHtml(value: string) {
  return value
    .replace(
      /&lt;span style=&quot;color:\s*(#[0-9a-fA-F]{6})&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g,
      '<span style="color: $1">$2</span>',
    )
    .replace(
      /&lt;span style=&quot;background-color:\s*(#[0-9a-fA-F]{6})&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g,
      '<span style="background-color: $1">$2</span>',
    );
}

function inlineMarkdown(value: string) {
  return restoreSafeInlineHtml(escapeHtml(value))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(content: string) {
  const lines = content.split(/\r?\n/);
  const html: string[] = [];
  let inCode = false;
  let listOpen = false;
  let codeBuffer: string[] = [];
  let codeLanguage = "";

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const line of lines) {
    const codeMatch = line.match(/^```(\w+)?/);
    if (codeMatch) {
      if (inCode) {
        html.push(`<pre><span>${escapeHtml(codeLanguage || "Code")}</span><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        codeBuffer = [];
        codeLanguage = "";
        inCode = false;
      } else {
        closeList();
        inCode = true;
        codeLanguage = codeMatch[1] ?? "";
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^[-*+]\s+(.+)$/);
    if (listItem) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(listItem[1])}</li>`);
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      closeList();
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      html.push("<hr />");
      continue;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();
  return html.join("");
}

function toPlainText(markdown: string) {
  return markdown
    .replace(/<span style="[^"]+">([\s\S]*?)<\/span>/g, "$1")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```(\w+)?/g, ""))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^---+$/gm, "")
    .trim();
}

function blockName(tagName: string) {
  return tagName.toLowerCase();
}

function normalizeColor(value: string) {
  const probe = document.createElement("span");
  probe.style.color = value;
  document.body.appendChild(probe);
  const rgb = window.getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return value;
  return `#${match
    .slice(0, 3)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tag = blockName(node.tagName);
  const inner = Array.from(node.childNodes).map(inlineNodeToMarkdown).join("");

  if (tag === "strong" || tag === "b") return `**${inner}**`;
  if (tag === "em" || tag === "i") return `*${inner}*`;
  if (tag === "code") return `\`${inner}\``;
  if (tag === "a") return `[${inner}](${node.getAttribute("href") ?? ""})`;
  if (tag === "br") return "\n";
  if (tag === "span") {
    const color = node.style.color;
    const backgroundColor = node.style.backgroundColor;
    if (color) return `<span style="color: ${normalizeColor(color)}">${inner}</span>`;
    if (backgroundColor) return `<span style="background-color: ${normalizeColor(backgroundColor)}">${inner}</span>`;
  }

  return inner;
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tag = blockName(node.tagName);
  const inline = () => Array.from(node.childNodes).map(inlineNodeToMarkdown).join("").trim();

  if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag.slice(1)))} ${inline()}`;

  if (tag === "ul") {
    return Array.from(node.children)
      .filter((child) => blockName(child.tagName) === "li")
      .map((child) => `- ${Array.from(child.childNodes).map(inlineNodeToMarkdown).join("").trim()}`)
      .join("\n");
  }

  if (tag === "ol") {
    return Array.from(node.children)
      .filter((child) => blockName(child.tagName) === "li")
      .map((child, index) => `${index + 1}. ${Array.from(child.childNodes).map(inlineNodeToMarkdown).join("").trim()}`)
      .join("\n");
  }

  if (tag === "blockquote") return `> ${inline()}`;
  if (tag === "pre") return `\`\`\`\n${node.textContent?.trim() ?? ""}\n\`\`\``;
  if (tag === "hr") return "---";
  if (tag === "div" || tag === "p") return inline();
  if (tag === "br") return "";

  return inline();
}

function editorHtmlToMarkdown(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return Array.from(root.childNodes)
    .map(nodeToMarkdown)
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function runEditorCommand(command: string, value?: string) {
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand(command, false, value);
}

export function EditorPage() {
  const [content, setContent] = useState(markdownSample);
  const [isMarkdown, setIsMarkdown] = useState(true);
  const [features, setFeatures] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [textColor, setTextColor] = useState("#d92d20");
  const [backgroundColor, setBackgroundColor] = useState("#fff3bf");
  const editorRef = useRef<HTMLDivElement>(null);
  const copySourceRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);

  const renderedHtml = useMemo(() => renderMarkdown(content), [content]);
  const plainText = useMemo(() => toPlainText(content), [content]);
  const stats = useMemo(() => {
    const compact = content.replace(/\s/g, "");
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return {
      chars: compact.length,
      words,
      minutes: Math.max(1, Math.ceil(compact.length / 500)),
    };
  }, [content]);

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = renderedHtml;
    }
  }, [renderedHtml]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      detectMarkdown(content)
        .then((result) => {
          setIsMarkdown(result.is_markdown);
          setFeatures(result.features);
        })
        .catch(() => {
          setIsMarkdown(false);
          setFeatures([]);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [content]);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!selectionRef.current) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(selectionRef.current);
  };

  const syncMarkdownFromEditor = () => {
    if (!editorRef.current) return;
    saveSelection();
    setContent(editorHtmlToMarkdown(editorRef.current.innerHTML));
  };

  const focusEditor = () => {
    editorRef.current?.focus();
    restoreSelection();
  };

  const applyCommand = (command: string, value?: string) => {
    focusEditor();
    runEditorCommand(command, value);
    syncMarkdownFromEditor();
  };

  const insertCode = () => {
    focusEditor();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const code = document.createElement("code");
    code.textContent = range.toString() || "代码";
    range.deleteContents();
    range.insertNode(code);
    range.setStartAfter(code);
    range.setEndAfter(code);
    selection.removeAllRanges();
    selection.addRange(range);
    syncMarkdownFromEditor();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    syncMarkdownFromEditor();
  };

  const writeToClipboard = async (type: "markdown" | "plain" | "rich") => {
    try {
      if (type === "rich" && "ClipboardItem" in window) {
        const htmlBlob = new Blob([copySourceRef.current?.innerHTML ?? renderedHtml], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        await navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })]);
      } else {
        await navigator.clipboard.writeText(type === "markdown" ? content : plainText);
      }

      setCopyState("done");
    } catch {
      setCopyState("failed");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  const keepSelection = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault();

  return (
    <section className="page editor-page">
      <div className="mode-bar">
        <span className={`markdown-detected ${isMarkdown ? "" : "muted"}`}>
          <CheckCircle2 size={16} />
          {isMarkdown ? `检测到 Markdown${features.length ? ` · ${features.length} 项语法` : ""}` : "未检测到 Markdown"}
        </span>
        <div className="toolbar-actions">
          <button onClick={() => writeToClipboard("markdown")} type="button">
            <Copy size={16} />
            复制 Markdown
          </button>
          <button onClick={() => writeToClipboard("plain")} type="button">
            <Copy size={16} />
            复制纯文本
          </button>
          <button onClick={() => writeToClipboard("rich")} type="button">
            <Copy size={16} />
            复制富文本
          </button>
        </div>
      </div>

      {copyState !== "idle" && <div className={`copy-toast ${copyState}`}>{copyState === "done" ? "已复制到剪贴板" : "复制失败，请检查浏览器权限"}</div>}

      <div className="editor-layout editor-layout-rich">
        <article className="editor-work panel">
          <div className="format-toolbar">
            <button onClick={() => applyCommand("bold")} onMouseDown={keepSelection} title="加粗" type="button">
              <Bold size={18} />
            </button>
            <button onClick={() => applyCommand("italic")} onMouseDown={keepSelection} title="斜体" type="button">
              <Italic size={18} />
            </button>
            <button className="text-tool-button" onClick={() => applyCommand("formatBlock", "h2")} onMouseDown={keepSelection} title="标题" type="button">
              标题
            </button>
            <button onClick={() => applyCommand("insertUnorderedList")} onMouseDown={keepSelection} title="列表" type="button">
              <List size={18} />
            </button>
            <button onClick={insertCode} onMouseDown={keepSelection} title="代码" type="button">
              <Code size={18} />
            </button>
            <label className="color-tool" title="文字颜色">
              <Palette size={16} />
              <input aria-label="文字颜色" onChange={(event) => setTextColor(event.target.value)} type="color" value={textColor} />
            </label>
            <button className="text-tool-button" onClick={() => applyCommand("foreColor", textColor)} onMouseDown={keepSelection} type="button">
              文字色
            </button>
            <label className="color-tool" title="背景颜色">
              <span className="bg-swatch" style={{ backgroundColor }} />
              <input aria-label="背景颜色" onChange={(event) => setBackgroundColor(event.target.value)} type="color" value={backgroundColor} />
            </label>
            <button className="text-tool-button" onClick={() => applyCommand("hiliteColor", backgroundColor)} onMouseDown={keepSelection} type="button">
              背景色
            </button>
          </div>
          <div
            aria-label="富文本 Markdown 编辑区"
            className="rich-editor"
            contentEditable
            onInput={syncMarkdownFromEditor}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onPaste={handlePaste}
            ref={editorRef}
            suppressContentEditableWarning
          />
        </article>

        <div className="rich-copy-source" dangerouslySetInnerHTML={{ __html: renderedHtml }} ref={copySourceRef} />

        <aside className="side-panel panel">
          <div className="panel-title">
            <Sparkles size={20} />
            <h2>AI 助手</h2>
          </div>
          <p>你好，我是你的 AI 编辑助手</p>
          {["优化文章结构", "改写润色内容", "总结文章要点", "翻译为其他语言", "解答文档疑问"].map((label) => (
            <button className="assist-action" key={label} type="button">
              {label}
            </button>
          ))}
          <div className="editor-stats">
            <span>{stats.chars} 字符</span>
            <span>{stats.words} 词</span>
            <span>{stats.minutes} 分钟阅读</span>
          </div>
          <div className="prompt-box">
            <span>输入你的问题或指令...</span>
            <Eye size={18} />
          </div>
        </aside>
      </div>
    </section>
  );
}
