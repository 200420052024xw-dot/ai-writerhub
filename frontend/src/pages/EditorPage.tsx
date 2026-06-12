import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
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
  History,
  Plus,
  Send,
  Trash2,
  Table as TableIcon,
  Rows3,
  Columns3,
  Sigma,
} from "lucide-react";
import "katex/dist/katex.min.css";
import { API_BASE_URL, apiFetch, randomId } from "../services/api";
import { userStorage } from "../services/userStorage";
import {
  getDocumentAssistantHistory,
  saveDocumentAssistantHistory,
  saveStoredDocumentParagraphs,
  type StoredDocumentDetail,
  type StoredDocumentParagraph,
  type StoredDocumentParagraphInput,
} from "../services/api";
import { loadModelSettings } from "../services/modelSettings";
import { CalloutBlock } from "../extensions/CalloutBlock";
import { ToggleBlock } from "../extensions/ToggleBlock";
import { StructureFold } from "../extensions/StructureFold";
import { NoNestedSpecialBlocks } from "../extensions/NoNestedSpecialBlocks";
import { BlockMath, InlineMath } from "../extensions/MathNodes";
import { markdownToHtml } from "../lib/markdown";

type CopyState = "idle" | "done" | "failed";
type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AssistantConversation = {
  id: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
};

const MAX_ASSISTANT_CONTEXT_LENGTH = 24000;

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

function assistantHistoryStorageKey(documentId: string) {
  return `editorAssistantConversations.${documentId}`;
}

function assistantConversationTitle(messages: AssistantMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.content.trim());
  const title = firstUserMessage?.content.trim().replace(/\s+/g, " ");
  return title ? title.slice(0, 24) : "新对话";
}

function createAssistantConversation(messages: AssistantMessage[] = []): AssistantConversation {
  const now = new Date().toISOString();
  return {
    id: randomId(),
    title: assistantConversationTitle(messages),
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

function parseAssistantConversations(raw: string | null): AssistantConversation[] {
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        id: typeof row.id === "string" ? row.id : randomId(),
        title: typeof row.title === "string" && row.title.trim() ? row.title : "新对话",
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
        messages: Array.isArray(row.messages)
          ? row.messages
              .filter((message: AssistantMessage) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
              .map((message: AssistantMessage) => ({
                id: typeof message.id === "string" ? message.id : randomId(),
                role: message.role,
                content: message.content,
              }))
          : [],
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

function isSelectionInsideSpecialBlock(editor: Editor) {
  for (let depth = editor.state.selection.$from.depth; depth > 0; depth -= 1) {
    const name = editor.state.selection.$from.node(depth).type.name;
    if (name === "callout" || name === "toggle") return true;
  }
  return false;
}

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
          <button
            className="dropdown-item"
            onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
            type="button"
          >
            <span className="heading-icon-text">H6</span> 标题 6
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
        <DropdownButton label={<TableIcon size={16} />}>
          <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} type="button">插入 3x3 表格</button>
          <button disabled={!editor.isActive("table")} onClick={() => editor.chain().focus().addRowAfter().run()} type="button"><Rows3 size={14} /> 下方插入行</button>
          <button disabled={!editor.isActive("table")} onClick={() => editor.chain().focus().addColumnAfter().run()} type="button"><Columns3 size={14} /> 右侧插入列</button>
          <button disabled={!editor.isActive("table")} onClick={() => editor.chain().focus().deleteRow().run()} type="button">删除行</button>
          <button disabled={!editor.isActive("table")} onClick={() => editor.chain().focus().deleteColumn().run()} type="button">删除列</button>
          <button disabled={!editor.isActive("table")} onClick={() => editor.chain().focus().toggleHeaderRow().run()} type="button">切换表头行</button>
          <button disabled={!editor.isActive("table")} onClick={() => editor.chain().focus().deleteTable().run()} type="button">删除表格</button>
        </DropdownButton>
        <ToolbarButton onClick={() => editor.chain().focus().insertInlineMath().run()} title="插入行内公式">
          <Sigma size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().insertBlockMath().run()} title="插入块级公式">
          <span style={{ fontSize: 13 }}>$$</span>
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        <ToolbarButton
          disabled={isSelectionInsideSpecialBlock(editor)}
          onClick={() => editor.chain().focus().setCallout().run()}
          title="高亮块"
        >
          <Minus size={16} />
          <span style={{ fontSize: 11 }}>提示</span>
        </ToolbarButton>
        <ToolbarButton
          disabled={isSelectionInsideSpecialBlock(editor)}
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
  return nodeToMarkdown(container);
}

function isEditorBodyEmpty(editor: Editor) {
  const doc = editor.state.doc;
  if (doc.childCount !== 1) return false;
  const firstChild = doc.child(0);
  return firstChild.type.name === "paragraph" && firstChild.textContent.trim() === "";
}

function detectMarkdownLocally(content: string) {
  const features = MARKDOWN_PATTERNS.filter(([, pattern]) => pattern.test(content)).map(([name]) => name);
  return {
    features,
    isMarkdown: features.length > 0,
  };
}

function paragraphToMarkdown(paragraph: Pick<StoredDocumentParagraph, "type" | "level" | "content">) {
  if (paragraph.type === "title") return `# ${paragraph.content}`.trim();
  if (paragraph.type === "heading") return `${"#".repeat(Math.max(2, Math.min(5, paragraph.level + 1)))} ${paragraph.content}`.trim();
  return paragraph.content;
}

function bodyMarkdownFromParagraphs(paragraphs?: StoredDocumentParagraph[]) {
  return (paragraphs || [])
    .filter((paragraph) => paragraph.type !== "title")
    .map(paragraphToMarkdown)
    .filter((content) => content.trim())
    .join("\n\n");
}

function titleFromParagraphs(paragraphs?: StoredDocumentParagraph[], fallback = "") {
  return paragraphs?.find((paragraph) => paragraph.type === "title" && paragraph.content.trim())?.content.trim() || fallback;
}

function inferParagraphInput(block: string, existing?: StoredDocumentParagraph): StoredDocumentParagraphInput {
  const trimmed = block.trim();
  const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    const markdownLevel = heading[1].length;
    if (markdownLevel === 1) {
      return { id: existing?.id, type: "title", level: 0, content: heading[2].trim() };
    }
    return { id: existing?.id, type: "heading", level: Math.max(1, Math.min(4, markdownLevel - 1)), content: heading[2].trim() };
  }
  if (/^\s*\|.+\|\s*$/m.test(trimmed)) {
    return { id: existing?.id, type: "table", level: existing?.level || 0, content: trimmed };
  }
  if (/^\s*([-*+]|\d+\.)\s+/m.test(trimmed)) {
    return { id: existing?.id, type: "list", level: existing?.level || 0, content: trimmed };
  }
  return { id: existing?.id, type: "paragraph", level: existing?.level || 0, content: trimmed };
}

function markdownToParagraphInputs(
  title: string,
  markdown: string,
  existingParagraphs?: StoredDocumentParagraph[],
): StoredDocumentParagraphInput[] {
  const titleParagraph = existingParagraphs?.find((paragraph) => paragraph.type === "title");
  const existingBody = (existingParagraphs || []).filter((paragraph) => paragraph.type !== "title");
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const bodyParagraphs = blocks.map((block, index) => inferParagraphInput(block, existingBody[index])).filter((paragraph) => paragraph.content || paragraph.type === "paragraph");
  return [
    { id: titleParagraph?.id, type: "title", level: 0, content: title.trim() || "无标题文档" },
    ...(bodyParagraphs.length ? bodyParagraphs : [{ id: existingBody[0]?.id, type: "paragraph" as const, level: 0, content: "" }]),
  ];
}

function inlineToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (!(node instanceof HTMLElement)) return "";

  const tag = node.tagName.toLowerCase();
  if (tag === "span" && node.getAttribute("data-type") === "inline-math") {
    return `$${node.getAttribute("data-latex") || node.textContent || ""}$`;
  }
  if (tag === "span" && node.hasAttribute("data-latex")) {
    return `$${node.getAttribute("data-latex") || ""}$`;
  }
  const inner = Array.from(node.childNodes).map(inlineToMarkdown).join("");

  if (tag === "strong" || tag === "b") return `**${inner}**`;
  if (tag === "em" || tag === "i") return `*${inner}*`;
  if (tag === "code") return `\`${inner}\``;
  if (tag === "u") return inner;
  if (tag === "s" || tag === "del") return `~~${inner}~~`;
  if (tag === "a") return `[${inner}](${node.getAttribute("href") || ""})`;
  if (tag === "br") return "\n";
  return inner;
}

function escapeMarkdownTableCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function tableToMarkdown(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children)
      .filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase()))
      .map((cell) => escapeMarkdownTableCell(Array.from(cell.childNodes).map(inlineToMarkdown).join("").trim())),
  );
  if (!rows.length) return "";
  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalize = (row: string[]) => Array.from({ length: columnCount }, (_, index) => row[index] || "");
  const [firstRow, ...bodyRows] = rows.map(normalize);
  return [
    `| ${firstRow.join(" | ")} |`,
    `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`,
    ...bodyRows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function nodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (!(node instanceof HTMLElement)) return "";

  const tag = node.tagName.toLowerCase();
  const inline = () => Array.from(node.childNodes).map(inlineToMarkdown).join("").trim();

  if (tag === "div" && node.getAttribute("data-type") === "block-math") {
    const blockLatex = node.getAttribute("data-latex") || node.querySelector("[data-latex]")?.getAttribute("data-latex") || node.textContent || "";
    return `$$\n${blockLatex}\n$$`;
  }
  if (tag === "span" && node.getAttribute("data-type") === "inline-math") {
    const inlineLatex = node.getAttribute("data-latex") || node.querySelector("[data-latex]")?.getAttribute("data-latex") || node.textContent || "";
    return `$${inlineLatex}$`;
  }
  if (tag === "table") return tableToMarkdown(node);
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
    return Array.from(node.childNodes).map(nodeToMarkdown).join("\n\n");
  }
  return inline();
}

async function streamAssistantReply({
  documentContext,
  messages,
  onDelta,
}: {
  documentContext: string;
  messages: AssistantMessage[];
  onDelta: (delta: string) => void;
}) {
  const settings = loadModelSettings();
  const modelReady = settings.useSystemModel
    ? Boolean(settings.baseUrl.trim() && settings.defaultModel.trim())
    : Boolean(settings.apiKey.trim() && settings.baseUrl.trim() && settings.defaultModel.trim());
  if (!modelReady) {
    throw new Error("暂未配置模型");
  }

  let response: Response;
  try {
    response = await apiFetch(`${API_BASE_URL}/api/assistant/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model: settings.defaultModel,
        use_system_model: settings.useSystemModel || undefined,
        document_context: documentContext,
        messages: [
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? `网络连接失败：${error.message}` : "网络连接失败，请确认后端服务正在运行");
  }

  if (!response.ok || !response.body) {
    const text = await response.text();
    let message = "模型请求失败";
    try {
      const data = JSON.parse(text);
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
    } catch {
      message = text;
    }
    throw new Error(message || "模型请求失败");
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
  documentParagraphs?: StoredDocumentParagraph[];
  documentTitle?: string;
  onTitleChange?: (title: string) => void;
  onDocumentSaved?: (document: StoredDocumentDetail) => void;
  onSaveStateChange?: (state: { label: string; status: "idle" | "saving" | "saved" | "failed" }) => void;
  onStatsChange?: (stats: { wordCount: number; charCount: number }) => void;
};

export function EditorPage({
  documentContent,
  documentId,
  documentParagraphs,
  documentTitle: externalDocumentTitle,
  onDocumentSaved,
  onSaveStateChange,
  onTitleChange,
  onStatsChange,
}: EditorPageProps) {
  const [documentTitle, setDocumentTitle] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [bodyEmpty, setBodyEmpty] = useState(true);
  const contentVersionRef = useRef(0);
  const [saveToggle, setSaveToggle] = useState(false);
  const [, setSelectionVersion] = useState(0);
  const [pendingMarkdown, setPendingMarkdown] = useState<{ content: string; features: string[] } | null>(null);
  const [assistantConversations, setAssistantConversations] = useState<AssistantConversation[]>([]);
  const [activeAssistantConversationId, setActiveAssistantConversationId] = useState("");
  const [assistantHistoryOpen, setAssistantHistoryOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [assistantWidth, setAssistantWidth] = useState(() => Number(userStorage.getItem("editorAssistantWidth") || 300));
  const [assistantVisible, setAssistantVisible] = useState(() => userStorage.getItem("editorAssistantVisible") !== "false");
  const resizingAssistantRef = useRef(false);
  const markdownPastePromptedRef = useRef(false);
  const loadingDocumentRef = useRef(false);
  const loadedDocumentIdRef = useRef<string | null>(null);
  const documentParagraphsRef = useRef<StoredDocumentParagraph[] | undefined>(documentParagraphs);

  useEffect(() => {
    documentParagraphsRef.current = documentParagraphs;
  }, [documentParagraphs]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
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
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
      InlineMath,
      BlockMath,
      CalloutBlock,
      ToggleBlock,
      NoNestedSpecialBlocks,
      StructureFold,
    ],
    content: initialContent,
    onCreate: ({ editor }) => {
      setBodyEmpty(isEditorBodyEmpty(editor));
      if (onStatsChange) {
        const text = editor.state.doc.textContent;
        const charCount = text.replace(/\s/g, "").length;
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        onStatsChange({ wordCount, charCount });
      }
    },
    onUpdate: ({ editor }) => {
      setBodyEmpty(isEditorBodyEmpty(editor));
      if (!loadingDocumentRef.current) {
        contentVersionRef.current += 1;
        setSaveToggle((v) => !v);
      }
      if (onStatsChange) {
        const text = editor.state.doc.textContent;
        const charCount = text.replace(/\s/g, "").length;
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        onStatsChange({ wordCount, charCount });
      }
    },
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
    if (!editor) return;
    if (!documentId) {
      loadedDocumentIdRef.current = null;
      loadingDocumentRef.current = true;
      setDocumentTitle("");
      onTitleChange?.("");
      editor.commands.setContent(initialContent);
      setBodyEmpty(true);
      window.setTimeout(() => {
        loadingDocumentRef.current = false;
      }, 0);
      return;
    }
    if (loadedDocumentIdRef.current === documentId) return;
    loadedDocumentIdRef.current = documentId;
    loadingDocumentRef.current = true;
    const nextTitle = externalDocumentTitle === "" ? "" : titleFromParagraphs(documentParagraphs, externalDocumentTitle || "");
    setDocumentTitle(nextTitle);
    onTitleChange?.(nextTitle);
    editor.commands.setContent(markdownToHtml(bodyMarkdownFromParagraphs(documentParagraphs) || documentContent || ""));
    setBodyEmpty(isEditorBodyEmpty(editor));
    window.setTimeout(() => {
      setBodyEmpty(isEditorBodyEmpty(editor));
      loadingDocumentRef.current = false;
    }, 0);
  }, [documentId, documentContent, documentParagraphs, externalDocumentTitle, editor, onTitleChange]);

  useEffect(() => {
    if (!documentId) {
      setAssistantConversations([]);
      setActiveAssistantConversationId("");
      setAssistantMessages([]);
      return;
    }
    let cancelled = false;
    const storedConversations = parseAssistantConversations(userStorage.getItem(assistantHistoryStorageKey(documentId)));
    if (storedConversations.length) {
      const activeConversation = storedConversations[0];
      setAssistantConversations(storedConversations);
      setActiveAssistantConversationId(activeConversation.id);
      setAssistantMessages(activeConversation.messages);
      return;
    }

    void getDocumentAssistantHistory(documentId).then((history) => {
      if (cancelled) return;
      const messages = history.messages.map((message) => ({
          id: randomId(),
          role: (message.role === "assistant" ? "assistant" : "user") as AssistantMessage["role"],
          content: message.content,
      }));
      const conversation = createAssistantConversation(messages);
      setAssistantConversations([conversation]);
      setActiveAssistantConversationId(conversation.id);
      setAssistantMessages(messages);
    }).catch(() => {
      const conversation = createAssistantConversation();
      setAssistantConversations([conversation]);
      setActiveAssistantConversationId(conversation.id);
      setAssistantMessages([]);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!documentId || !activeAssistantConversationId) return;
    const now = new Date().toISOString();
    setAssistantConversations((current) => {
      const updated = current.some((conversation) => conversation.id === activeAssistantConversationId)
        ? current.map((conversation) =>
            conversation.id === activeAssistantConversationId
              ? {
                  ...conversation,
                  title: assistantConversationTitle(assistantMessages),
                  messages: assistantMessages,
                  updatedAt: now,
                }
              : conversation,
          )
        : [
            {
              ...createAssistantConversation(assistantMessages),
              id: activeAssistantConversationId,
              updatedAt: now,
            },
            ...current,
          ];
      return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }, [assistantMessages, activeAssistantConversationId, documentId]);

  useEffect(() => {
    if (!documentId || !assistantConversations.length) return;
    userStorage.setItem(assistantHistoryStorageKey(documentId), JSON.stringify(assistantConversations));
  }, [assistantConversations, documentId]);

  useEffect(() => {
    if (!documentId || !activeAssistantConversationId) return;
    const timer = window.setTimeout(() => {
      void saveDocumentAssistantHistory(
        documentId,
        assistantMessages
          .filter((message) => message.content.trim())
          .map((message) => ({ role: message.role, content: message.content })),
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [assistantMessages, activeAssistantConversationId, documentId]);

  useEffect(() => {
    userStorage.setItem("editorAssistantWidth", String(assistantWidth));
    userStorage.setItem("editorAssistantVisible", String(assistantVisible));
  }, [assistantWidth, assistantVisible]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!resizingAssistantRef.current) return;
      const nextWidth = Math.max(0, window.innerWidth - event.clientX - 22);
      if (nextWidth < 180) {
        setAssistantVisible(false);
        setAssistantWidth(0);
      } else {
        setAssistantVisible(true);
        setAssistantWidth(Math.min(520, nextWidth));
      }
    };
    const stopResize = () => {
      resizingAssistantRef.current = false;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, []);

  useEffect(() => {
    if (!editor || !documentId || loadingDocumentRef.current) return;
    const timer = window.setTimeout(async () => {
      try {
        onSaveStateChange?.({ label: "保存中", status: "saving" });
        const saved = await saveStoredDocumentParagraphs(
          documentId,
          markdownToParagraphInputs(documentTitle, htmlToMarkdown(editor.getHTML()), documentParagraphsRef.current),
        );
        onDocumentSaved?.(saved);
        onSaveStateChange?.({
          label: `已保存 ${new Date(saved.last_saved_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
          status: "saved",
        });
      } catch {
        onSaveStateChange?.({ label: "保存失败", status: "failed" });
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [documentId, documentTitle, editor, saveToggle, onDocumentSaved, onSaveStateChange]);

  const writeToClipboard = async (type: "markdown" | "plain") => {
    if (!editor) return;
    try {
      let text: string;
      if (type === "markdown") {
        const body = htmlToMarkdown(editor.getHTML());
        const title = documentTitle.trim();
        text = title ? `# ${title}${body ? `\n\n${body}` : ""}` : body;
      } else {
        const body = editor.getText();
        const title = documentTitle.trim();
        text = title ? `${title}${body ? `\n\n${body}` : ""}` : body;
      }
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // navigator.clipboard 在非 HTTPS 环境下不可用，使用 execCommand 降级
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand copy failed");
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

  const buildAssistantDocumentContext = () => {
    if (!editor) return documentTitle.trim();
    const body = htmlToMarkdown(editor.getHTML()).trim();
    const title = documentTitle.trim();
    const context = title ? `# ${title}${body ? `\n\n${body}` : ""}` : body;
    return context.slice(0, MAX_ASSISTANT_CONTEXT_LENGTH);
  };

  const startNewAssistantConversation = () => {
    if (assistantStreaming) return;
    const conversation = createAssistantConversation();
    setAssistantConversations((current) => [conversation, ...current]);
    setActiveAssistantConversationId(conversation.id);
    setAssistantMessages([]);
    setAssistantHistoryOpen(false);
  };

  const selectAssistantConversation = (conversation: AssistantConversation) => {
    if (assistantStreaming || conversation.id === activeAssistantConversationId) return;
    setActiveAssistantConversationId(conversation.id);
    setAssistantMessages(conversation.messages);
    setAssistantHistoryOpen(false);
  };

  const deleteAssistantConversation = (conversationId: string) => {
    if (assistantStreaming) return;
    const next = assistantConversations.filter((conversation) => conversation.id !== conversationId);
    if (conversationId === activeAssistantConversationId) {
      const fallback = next[0] || createAssistantConversation();
      if (!next.length) next.push(fallback);
      setActiveAssistantConversationId(fallback.id);
      setAssistantMessages(fallback.messages);
    }
    setAssistantConversations(next);
  };

  const sendAssistantMessage = async () => {
    const content = assistantInput.trim();
    if (!content || assistantStreaming) return;

    const userMessage: AssistantMessage = {
      id: randomId(),
      role: "user",
      content,
    };
    const assistantMessage: AssistantMessage = {
      id: randomId(),
      role: "assistant",
      content: "",
    };
    const nextMessages = [...assistantMessages, userMessage, assistantMessage];

    setAssistantMessages(nextMessages);
    setAssistantInput("");
    setAssistantStreaming(true);

    try {
      await streamAssistantReply({
        documentContext: buildAssistantDocumentContext(),
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

      <div
        className={`editor-layout editor-layout-rich ${assistantVisible ? "" : "assistant-collapsed"}`}
        style={{ "--assistant-width": assistantVisible ? `${assistantWidth}px` : "0px" } as CSSProperties}
      >
        <article className="editor-work panel">
          {!assistantVisible && (
            <button className="editor-assistant-open" onClick={() => { setAssistantVisible(true); setAssistantWidth(300); }} type="button">
              <Sparkles size={16} />
              文枢助手
            </button>
          )}
          {editor && <EditorToolbar editor={editor} onCopy={(type) => void writeToClipboard(type)} />}
          <div className="tiptap-editor">
            <textarea
              className="document-title-input"
              onChange={(event) => {
                updateDocumentTitle(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = event.target.scrollHeight + "px";
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  editor?.chain().focus("start").run();
                }
              }}
              placeholder="请输入标题"
              rows={1}
              value={documentTitle}
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";
                }
              }}
            />
            {bodyEmpty && <div className="body-empty-placeholder">直接输入正文</div>}
            <EditorContent editor={editor} />
          </div>
        </article>

        {assistantVisible && <div className="assistant-resizer" onMouseDown={() => { resizingAssistantRef.current = true; }} />}

        {assistantVisible && <aside className="side-panel panel editor-assistant-panel">
          <div className="panel-title">
            <div className="panel-title-left">
              <Sparkles size={20} />
              <h2>文枢助手</h2>
            </div>
            <div className="assistant-title-actions">
              <button
                className="assistant-icon-btn"
                disabled={assistantStreaming}
                onClick={startNewAssistantConversation}
                title="新建对话"
                type="button"
              >
                <Plus size={16} />
              </button>
              <button
                className={`assistant-icon-btn ${assistantHistoryOpen ? "active" : ""}`}
                onClick={() => setAssistantHistoryOpen((open) => !open)}
                title="历史对话"
                type="button"
              >
                <History size={16} />
              </button>
            </div>
          </div>

          {assistantHistoryOpen && (
            <div className="assistant-history-list">
              {assistantConversations.map((conversation) => (
                <button
                  className={`assistant-history-item ${conversation.id === activeAssistantConversationId ? "active" : ""}`}
                  key={conversation.id}
                  onClick={() => selectAssistantConversation(conversation)}
                  type="button"
                >
                  <span className="assistant-history-title">{conversation.title}</span>
                  <span className="assistant-history-meta">
                    {conversation.messages.filter((message) => message.role === "user").length} 条消息
                  </span>
                  <span
                    className="assistant-history-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteAssistantConversation(conversation.id);
                    }}
                    role="button"
                    tabIndex={0}
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}

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
        </aside>}
      </div>
    </section>
  );
}
