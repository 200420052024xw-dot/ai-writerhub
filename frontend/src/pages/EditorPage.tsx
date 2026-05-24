import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Typography } from "@tiptap/extension-typography";
import { Underline } from "@tiptap/extension-underline";
import {
  Bold,
  Code,
  Copy,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Sparkles,
  Strikethrough,
  Type,
  Undo,
  Paintbrush,
  ChevronDown,
  Minus,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Send,
} from "lucide-react";
import { API_BASE_URL } from "../services/api";
import { loadModelSettings } from "../services/modelSettings";
import { CalloutBlock } from "../extensions/CalloutBlock";
import { ToggleBlock } from "../extensions/ToggleBlock";
import { StructureFold } from "../extensions/StructureFold";

type CopyState = "idle" | "done" | "failed";
type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const MARKDOWN_PATTERNS: Array<[string, RegExp]> = [
  ["heading", /^\s{0,3}#{1,6}\s+\S+/m],
  ["unordered_list", /^\s*[-*+]\s+\S+/m],
  ["ordered_list", /^\s*\d+\.\s+\S+/m],
  ["blockquote", /^\s{0,3}>\s+\S+/m],
  ["fenced_code", /```[\s\S]*?```/],
  ["inline_code", /`[^`\n]+`/],
  ["bold", /(\*\*|__)[^\n]+?\1/],
  ["italic", /(?<!\*)\*[^*\n]+\*(?!\*)|_[^_\n]+_/],
  ["link", /\[[^\]]+\]\([^)]+\)/],
  ["image", /!\[[^\]]*\]\([^)]+\)/],
  ["table", /^\s*\|.+\|\s*$/m],
  ["horizontal_rule", /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/m],
];

const TEXT_COLORS = [
  { label: "黑色", value: "#17233c" },
  { label: "红色", value: "#d92d20" },
  { label: "橙色", value: "#f79009" },
  { label: "绿色", value: "#12b76a" },
  { label: "蓝色", value: "#0f5bff" },
  { label: "紫色", value: "#7c3aed" },
  { label: "灰色", value: "#64748b" },
];

const BG_COLORS = [
  { label: "无", value: "" },
  { label: "黄色", value: "#fff3bf" },
  { label: "绿色", value: "#d3f9d8" },
  { label: "蓝色", value: "#dbeafe" },
  { label: "红色", value: "#ffe0e0" },
  { label: "紫色", value: "#ede9fe" },
];

const initialContent = `<p></p>`;

function ToolbarButton({
  active,
  disabled,
  onClick,
  onMouseDown,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`toolbar-btn ${active ? "active" : ""}`}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <span className="toolbar-separator" />;
}

function DropdownButton({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({ left: rect.left, top: rect.bottom + 4 });
    };
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    updatePosition();
    document.addEventListener("mousedown", handler);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="toolbar-dropdown" ref={ref}>
      <button
        className="toolbar-btn dropdown-trigger"
        onClick={() => {
          const rect = ref.current?.getBoundingClientRect();
          if (rect) {
            setMenuPosition({ left: rect.left, top: rect.bottom + 4 });
          }
          setOpen(!open);
        }}
        type="button"
      >
        {label}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          className="dropdown-menu"
          onClick={() => setOpen(false)}
          ref={menuRef}
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ColorPicker({
  colors,
  activeColor,
  onSelect,
}: {
  colors: Array<{ label: string; value: string }>;
  activeColor: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="color-picker-grid">
      {colors.map((c) => (
        <button
          key={c.value || c.label}
          className={`color-swatch ${activeColor === c.value ? "active" : ""}`}
          onClick={() => onSelect(c.value)}
          title={c.label}
          type="button"
        >
          {c.value ? (
            <span style={{ backgroundColor: c.value }} />
          ) : (
            <span className="no-color">无</span>
          )}
        </button>
      ))}
    </div>
  );
}

function SplitColorButton({
  activeColor,
  colors,
  defaultColor,
  icon,
  indicatorClassName,
  onApply,
  onSelect,
  title,
}: {
  activeColor: string;
  colors: Array<{ label: string; value: string }>;
  defaultColor: string;
  icon: React.ReactNode;
  indicatorClassName?: string;
  onApply: (value: string) => void;
  onSelect: (value: string) => void;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const color = activeColor || defaultColor;

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({ left: rect.left, top: rect.bottom + 4 });
    };
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    updatePosition();
    document.addEventListener("mousedown", handler);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="split-color-tool" ref={ref}>
      <button className="split-color-main" onClick={() => onApply(color)} title={title} type="button">
        {icon}
        <span
          className={`split-color-indicator ${indicatorClassName || ""}`}
          style={indicatorClassName === "fill" ? { backgroundColor: color || "transparent" } : { borderBottomColor: color }}
        />
      </button>
      <button
        className="split-color-arrow"
        onClick={() => {
          const rect = ref.current?.getBoundingClientRect();
          if (rect) {
            setMenuPosition({ left: rect.left, top: rect.bottom + 4 });
          }
          setOpen(!open);
        }}
        title={`${title}颜色`}
        type="button"
      >
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          className="dropdown-menu"
          onClick={() => setOpen(false)}
          ref={menuRef}
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          <ColorPicker colors={colors} activeColor={activeColor} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

function FormatBrushButton({ editor }: { editor: Editor }) {
  const [brushState, setBrushState] = useState<"idle" | "armed">("idle");
  const savedMarksRef = useRef<Record<string, unknown> | null>(null);

  const armBrush = useCallback(() => {
    const { state } = editor;
    const { from, to } = state.selection;
    if (from === to) return;

    const marks: Record<string, unknown> = {};
    state.doc.nodesBetween(from, to, (node) => {
      if (node.marks) {
        for (const mark of node.marks) {
          if (["bold", "italic", "strike", "code", "underline"].includes(mark.type.name)) {
            marks[mark.type.name] = true;
          }
          if (mark.type.name === "textStyle") {
            if (mark.attrs.color) marks.color = mark.attrs.color;
            if (mark.attrs.fontSize) marks.fontSize = mark.attrs.fontSize;
          }
          if (mark.type.name === "highlight") {
            marks.highlightColor = mark.attrs.color || true;
          }
        }
      }
    });

    savedMarksRef.current = marks;
    setBrushState("armed");
  }, [editor]);

  const applyBrush = useCallback(() => {
    if (!savedMarksRef.current) return;
    const { state } = editor;
    const { from, to } = state.selection;
    if (from === to) return;

    let tr = state.tr;
    const marks = savedMarksRef.current;

    // Remove existing marks first
    tr = tr.removeMark(from, to);
    // Remove highlight
    tr.removeMark(from, to, state.schema.marks.highlight);

    // Apply saved marks
    if (marks.bold) tr = tr.addMark(from, to, state.schema.marks.bold.create());
    if (marks.italic) tr = tr.addMark(from, to, state.schema.marks.italic.create());
    if (marks.strike) tr = tr.addMark(from, to, state.schema.marks.strike.create());
    if (marks.code) tr = tr.addMark(from, to, state.schema.marks.code.create());
    if (marks.underline) tr = tr.addMark(from, to, state.schema.marks.underline.create());
    const textStyleAttrs: Record<string, unknown> = {};
    if (marks.color) textStyleAttrs.color = marks.color;
    if (marks.fontSize) textStyleAttrs.fontSize = marks.fontSize;
    if (Object.keys(textStyleAttrs).length) {
      tr = tr.addMark(from, to, state.schema.marks.textStyle.create(textStyleAttrs));
    }
    if (marks.highlightColor) {
      const color = typeof marks.highlightColor === "string" ? marks.highlightColor : undefined;
      tr = tr.addMark(from, to, state.schema.marks.highlight.create(color ? { color } : undefined));
    }

    editor.view.dispatch(tr);
    setBrushState("idle");
    savedMarksRef.current = null;
  }, [editor]);

  useEffect(() => {
    if (brushState !== "armed") return;
    const handler = () => {
      const { state } = editor;
      if (!state.selection.empty) {
        applyBrush();
      }
    };
    // Listen for next selection change
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [brushState, editor, applyBrush]);

  return (
    <ToolbarButton
      active={brushState === "armed"}
      onClick={brushState === "armed" ? () => { setBrushState("idle"); savedMarksRef.current = null; } : armBrush}
      title="格式刷"
    >
      <Paintbrush size={16} />
    </ToolbarButton>
  );
}

function EditorToolbar({
  editor,
  onCopy,
}: {
  editor: Editor;
  onCopy: (type: "markdown" | "plain") => void;
}) {
  const [textToolColor, setTextToolColor] = useState("#17233c");
  const [highlightToolColor, setHighlightToolColor] = useState("#fff3bf");

  return (
    <div className="editor-toolbar">
      <div className="toolbar-group">
        <FormatBrushButton editor={editor} />
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销">
          <Undo size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做">
          <Redo size={16} />
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        <DropdownButton label="段落">
          <button
            className="dropdown-item"
            onClick={() => editor.chain().focus().setParagraph().run()}
            type="button"
          >
            <Pilcrow size={16} /> 正文
          </button>
          <button
            className="dropdown-item"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            type="button"
          >
            <Heading1 size={16} /> 标题 1
          </button>
          <button
            className="dropdown-item"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            type="button"
          >
            <Heading2 size={16} /> 标题 2
          </button>
          <button
            className="dropdown-item"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            type="button"
          >
            <Heading3 size={16} /> 标题 3
          </button>
          <button
            className="dropdown-item"
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            type="button"
          >
            <span className="heading-icon-text">H4</span> 标题 4
          </button>
          <button
            className="dropdown-item"
            onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
            type="button"
          >
            <span className="heading-icon-text">H5</span> 标题 5
          </button>
        </DropdownButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗"
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体"
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="删除线"
        >
          <Strikethrough size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线"
        >
          <span style={{ textDecoration: "underline", fontWeight: 700, fontSize: 14 }}>U</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="行内代码"
        >
          <Code size={16} />
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        <SplitColorButton
          activeColor={textToolColor}
          colors={TEXT_COLORS}
          defaultColor="#17233c"
          icon={<Type size={16} />}
          onApply={(value) => editor.chain().focus().setColor(value).run()}
          onSelect={(value) => {
            const nextColor = value || "#17233c";
            setTextToolColor(nextColor);
            editor.chain().focus().setColor(nextColor).run();
          }}
          title="文字颜色"
        />
        <SplitColorButton
          activeColor={highlightToolColor}
          colors={BG_COLORS}
          defaultColor="#fff3bf"
          icon={<Highlighter size={16} />}
          indicatorClassName="fill"
          onApply={(value) => editor.chain().focus().toggleHighlight({ color: value }).run()}
          onSelect={(value) => {
            if (value) {
              setHighlightToolColor(value);
              editor.chain().focus().toggleHighlight({ color: value }).run();
            } else {
              editor.chain().focus().unsetHighlight().run();
            }
          }}
          title="背景颜色"
        />
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="无序列表"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="有序列表"
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="引用"
        >
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="代码块"
        >
          <Code size={16} />
          <span style={{ fontSize: 11, marginLeft: 2 }}>块</span>
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        <ToolbarButton
          onClick={() => editor.chain().focus().setCallout().run()}
          title="高亮块"
        >
          <Minus size={16} />
          <span style={{ fontSize: 11 }}>提示</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setToggle().run()}
          title="折叠块"
        >
          <ChevronDown size={16} />
          <span style={{ fontSize: 11 }}>折叠</span>
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        <ToolbarButton onClick={() => onCopy("markdown")} title="复制 Markdown">
          <Copy size={16} />
          <span style={{ fontSize: 11 }}>Markdown</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => onCopy("plain")} title="复制纯文本">
          <Copy size={16} />
          <span style={{ fontSize: 11 }}>纯文本</span>
        </ToolbarButton>
      </div>

    </div>
  );
}

function htmlToMarkdown(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  return nodeToMarkdown(container).trim();
}

function detectMarkdownLocally(content: string) {
  const features = MARKDOWN_PATTERNS.filter(([, pattern]) => pattern.test(content)).map(([name]) => name);
  return {
    features,
    isMarkdown: features.length > 0,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inCode = false;
  let codeLanguage = "";
  let codeLines: string[] = [];
  let blockquoteLines: string[] = [];

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  const closeBlockquote = () => {
    if (!blockquoteLines.length) return;
    html.push(`<blockquote><p>${blockquoteLines.map(renderInlineMarkdown).join("<br>")}</p></blockquote>`);
    blockquoteLines = [];
  };

  for (const line of lines) {
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      closeList();
      closeBlockquote();
      if (inCode) {
        const languageAttr = codeLanguage ? ` data-language="${escapeHtml(codeLanguage)}"` : "";
        html.push(`<pre><code${languageAttr}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLanguage = "";
        codeLines = [];
      } else {
        inCode = true;
        codeLanguage = fence[1] || "";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      closeBlockquote();
      continue;
    }

    const heading = line.match(/^(#{1,5})\s+(.+)$/);
    if (heading) {
      closeList();
      closeBlockquote();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      closeBlockquote();
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      closeBlockquote();
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const quote = line.match(/^\s{0,3}>\s+(.+)$/);
    if (quote) {
      closeList();
      blockquoteLines.push(quote[1]);
      continue;
    }

    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList();
      closeBlockquote();
      html.push("<hr>");
      continue;
    }

    closeList();
    closeBlockquote();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  if (inCode) {
    const languageAttr = codeLanguage ? ` data-language="${escapeHtml(codeLanguage)}"` : "";
    html.push(`<pre><code${languageAttr}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  closeList();
  closeBlockquote();

  return html.join("\n");
}

function inlineToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (!(node instanceof HTMLElement)) return "";

  const tag = node.tagName.toLowerCase();
  const inner = Array.from(node.childNodes).map(inlineToMarkdown).join("");

  if (tag === "strong" || tag === "b") return `**${inner}**`;
  if (tag === "em" || tag === "i") return `*${inner}*`;
  if (tag === "code") return `\`${inner}\``;
  if (tag === "u") return inner;
  if (tag === "s" || tag === "del") return `~~${inner}~~`;
  if (tag === "a") return `[${inner}](${node.getAttribute("href") || ""})`;
  if (tag === "br") return "\n";
  if (tag === "span") {
    const style = node.getAttribute("style") || "";
    const styles: string[] = [];
    if (style.includes("color:")) {
      const color = style.match(/color:\s*([^;]+)/)?.[1]?.trim();
      if (color) styles.push(`color: ${color}`);
    }
    if (style.includes("font-size:")) {
      const size = style.match(/font-size:\s*([^;]+)/)?.[1]?.trim();
      if (size) styles.push(`font-size: ${size}`);
    }
    if (styles.length) return `<span style="${styles.join("; ")}">${inner}</span>`;
  }
  return inner;
}

function nodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (!(node instanceof HTMLElement)) return "";

  const tag = node.tagName.toLowerCase();
  const inline = () => Array.from(node.childNodes).map(inlineToMarkdown).join("").trim();

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    return `${"#".repeat(level)} ${inline()}`;
  }
  if (tag === "p") return inline();
  if (tag === "ul") {
    return Array.from(node.children)
      .filter((c) => c.tagName.toLowerCase() === "li")
      .map((li) => `- ${Array.from(li.childNodes).map(inlineToMarkdown).join("").trim()}`)
      .join("\n");
  }
  if (tag === "ol") {
    return Array.from(node.children)
      .filter((c) => c.tagName.toLowerCase() === "li")
      .map((li, i) => `${i + 1}. ${Array.from(li.childNodes).map(inlineToMarkdown).join("").trim()}`)
      .join("\n");
  }
  if (tag === "blockquote") return `> ${inline()}`;
  if (tag === "pre") {
    const code = node.querySelector("code");
    const lang = code?.getAttribute("data-language") || "";
    return `\`\`\`${lang}\n${code?.textContent || node.textContent || ""}\n\`\`\``;
  }
  if (tag === "hr") return "---";
  if (tag === "div" && node.classList.contains("callout-block")) {
    const contentNode = node.querySelector(".callout-content");
    const content = Array.from((contentNode || node).childNodes).map(nodeToMarkdown).join("\n").trim();
    return `> \u{1F4A1} ${content.replace(/\n/g, "\n> ")}`;
  }
  if (tag === "details") {
    const summary = node.querySelector("summary");
    const title = summary?.textContent || "展开";
    const body = Array.from(node.childNodes)
      .filter((c) => !(c instanceof HTMLElement && c.tagName.toLowerCase() === "summary"))
      .map(nodeToMarkdown)
      .join("\n")
      .trim();
    return `<details>\n<summary>${title}</summary>\n\n${body}\n\n</details>`;
  }
  if (tag === "div" || tag === "section") {
    return Array.from(node.childNodes).map(nodeToMarkdown).filter(Boolean).join("\n\n");
  }
  return inline();
}

async function streamAssistantReply({
  messages,
  onDelta,
}: {
  messages: AssistantMessage[];
  onDelta: (delta: string) => void;
}) {
  const settings = loadModelSettings();
  if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.defaultModel.trim()) {
    throw new Error("暂未配置模型");
  }

  const response = await fetch(`${API_BASE_URL}/api/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: settings.apiKey,
      base_url: settings.baseUrl,
      model: settings.defaultModel,
      messages: [
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error("模型请求失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch {
        // Ignore malformed stream chunks from non-standard providers.
      }
    }
  }
}

type EditorPageProps = {
  documentContent?: string;
  documentId?: string;
  documentTitle?: string;
  onTitleChange?: (title: string) => void;
};

export function EditorPage({ documentContent, documentId, documentTitle: externalDocumentTitle, onTitleChange }: EditorPageProps) {
  const [documentTitle, setDocumentTitle] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [bodyEmpty, setBodyEmpty] = useState(true);
  const [, setSelectionVersion] = useState(0);
  const [pendingMarkdown, setPendingMarkdown] = useState<{ content: string; features: string[] } | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const markdownPastePromptedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5] },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: () => {
          return "";
        },
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      Typography,
      Underline,
      CalloutBlock,
      ToggleBlock,
      StructureFold,
    ],
    content: initialContent,
    onCreate: ({ editor }) => setBodyEmpty(!editor.getText().trim()),
    onUpdate: ({ editor }) => setBodyEmpty(!editor.getText().trim()),
    onSelectionUpdate: () => setSelectionVersion((version) => version + 1),
    editorProps: {
      handlePaste: (_view, event) => {
        if (markdownPastePromptedRef.current) return false;

        const rawText = event.clipboardData?.getData("text/plain")?.trim() || "";
        const rawResult = detectMarkdownLocally(rawText);
        if (!rawResult.isMarkdown) return false;

        markdownPastePromptedRef.current = true;
        window.setTimeout(() => {
          setPendingMarkdown({
            content: rawText,
            features: rawResult.features,
          });
        }, 0);

        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor || !documentId) return;
    const nextTitle = externalDocumentTitle || "";
    setDocumentTitle(nextTitle);
    onTitleChange?.(nextTitle);
    editor.commands.setContent(markdownToHtml(documentContent || ""));
    setBodyEmpty(!(documentContent || "").trim());
  }, [documentId, documentContent, externalDocumentTitle, editor, onTitleChange]);

  const writeToClipboard = async (type: "markdown" | "plain") => {
    if (!editor) return;
    try {
      if (type === "markdown") {
        const body = htmlToMarkdown(editor.getHTML());
        const title = documentTitle.trim();
        const md = title ? `# ${title}${body ? `\n\n${body}` : ""}` : body;
        await navigator.clipboard.writeText(md);
      } else {
        const body = editor.getText();
        const title = documentTitle.trim();
        await navigator.clipboard.writeText(title ? `${title}${body ? `\n\n${body}` : ""}` : body);
      }
      setCopyState("done");
    } catch {
      setCopyState("failed");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  const convertPendingMarkdown = () => {
    if (!editor || !pendingMarkdown) return;
    const lines = pendingMarkdown.content.replace(/\r\n/g, "\n").split("\n");
    const firstHeading = lines[0]?.match(/^#\s+(.+)$/);
    if (firstHeading) {
      const nextTitle = firstHeading[1].trim();
      setDocumentTitle(nextTitle);
      onTitleChange?.(nextTitle);
      editor.commands.setContent(markdownToHtml(lines.slice(1).join("\n").trim()));
    } else {
      editor.commands.setContent(markdownToHtml(pendingMarkdown.content));
    }
    setPendingMarkdown(null);
  };

  const updateDocumentTitle = (value: string) => {
    setDocumentTitle(value);
    onTitleChange?.(value.trim());
  };

  const ignorePendingMarkdown = () => {
    if (!pendingMarkdown) return;
    setPendingMarkdown(null);
  };

  const sendAssistantMessage = async () => {
    const content = assistantInput.trim();
    if (!content || assistantStreaming) return;

    const userMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const assistantMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };
    const nextMessages = [...assistantMessages, userMessage, assistantMessage];

    setAssistantMessages(nextMessages);
    setAssistantInput("");
    setAssistantStreaming(true);

    try {
      await streamAssistantReply({
        messages: nextMessages.filter((message) => message.role === "user" || message.content.trim()),
        onDelta: (delta) => {
          setAssistantMessages((current) =>
            current.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: message.content + delta }
                : message,
            ),
          );
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型请求失败";
      setAssistantMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: message }
            : item,
        ),
      );
    } finally {
      setAssistantStreaming(false);
    }
  };

  return (
    <section className="page editor-page">
      {copyState !== "idle" && (
        <div className={`copy-toast ${copyState}`}>
          {copyState === "done" ? "已复制到剪贴板" : "复制失败，请检查浏览器权限"}
        </div>
      )}

      {pendingMarkdown && (
        <div className="markdown-convert-prompt">
          <span>
            检测到 Markdown{pendingMarkdown.features.length ? ` · ${pendingMarkdown.features.length} 项语法` : ""}，是否转换为可编辑格式？
          </span>
          <button onClick={convertPendingMarkdown} type="button">转换</button>
          <button onClick={ignorePendingMarkdown} type="button">暂不</button>
        </div>
      )}

      <div className="editor-layout editor-layout-rich">
        <article className="editor-work panel">
          {editor && <EditorToolbar editor={editor} onCopy={(type) => void writeToClipboard(type)} />}
          <div className="tiptap-editor">
            <input
              className="document-title-input"
              onChange={(event) => updateDocumentTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  editor?.chain().focus("start").run();
                }
              }}
              placeholder="请输入标题"
              value={documentTitle}
            />
            {bodyEmpty && <div className="body-empty-placeholder">直接输入正文</div>}
            <EditorContent editor={editor} />
          </div>
        </article>

        <aside className="side-panel panel">
          <div className="panel-title">
            <Sparkles size={20} />
            <h2>文枢助手</h2>
          </div>

          <div className="assistant-thread">
            {assistantMessages.length === 0 ? (
              <div className="assistant-empty">
                <Sparkles size={34} />
                <span>陪您聊天，创作或脑洞打开，准备好探索无限的可能</span>
              </div>
            ) : (
              assistantMessages.map((message) => (
                <div className={`assistant-message ${message.role}`} key={message.id}>
                  {message.content || (message.role === "assistant" && assistantStreaming ? "正在思考..." : "")}
                </div>
              ))
            )}
          </div>

          <div className="assistant-input-box">
            <textarea
              onChange={(event) => setAssistantInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendAssistantMessage();
                }
              }}
              placeholder="输入消息..."
              rows={2}
              value={assistantInput}
            />
            <button
              disabled={!assistantInput.trim() || assistantStreaming}
              onClick={() => void sendAssistantMessage()}
              type="button"
              aria-label="发送"
            >
              <Send size={17} />
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
