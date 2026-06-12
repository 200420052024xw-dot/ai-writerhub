import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import katex from "katex";
import React, { useMemo, useState } from "react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      insertInlineMath: (latex?: string) => ReturnType;
      insertBlockMath: (latex?: string) => ReturnType;
    };
  }
}

function renderMath(latex: string, displayMode: boolean) {
  try {
    return {
      html: katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      }),
      invalid: false,
    };
  } catch {
    return { html: latex, invalid: true };
  }
}

function MathNodeView({
  node,
  updateAttributes,
  displayMode,
}: {
  node: { attrs: { latex?: string } };
  updateAttributes: (attrs: { latex: string }) => void;
  displayMode: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(node.attrs.latex || ""));
  const rendered = useMemo(() => renderMath(String(node.attrs.latex || ""), displayMode), [displayMode, node.attrs.latex]);

  const commit = () => {
    updateAttributes({ latex: draft.trim() });
    setEditing(false);
  };

  return React.createElement(
    NodeViewWrapper,
    {
      as: displayMode ? "div" : "span",
      className: `math-node ${displayMode ? "block-math" : "inline-math"}${rendered.invalid ? " math-invalid" : ""}`,
      "data-type": displayMode ? "block-math" : "inline-math",
      "data-latex": String(node.attrs.latex || ""),
      onDoubleClick: () => {
        setDraft(String(node.attrs.latex || ""));
        setEditing(true);
      },
    },
    editing
      ? React.createElement(displayMode ? "textarea" : "input", {
          className: "math-source-input",
          value: draft,
          autoFocus: true,
          rows: displayMode ? 3 : undefined,
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
          onBlur: commit,
          onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setDraft(String(node.attrs.latex || ""));
              setEditing(false);
            }
          },
        })
      : React.createElement("span", {
          className: "math-render",
          "data-latex": String(node.attrs.latex || ""),
          contentEditable: false,
          title: "双击编辑 LaTeX",
          dangerouslySetInnerHTML: { __html: rendered.html },
        }),
  );
}

export const InlineMath = Node.create({
  name: "inlineMath",

  group: "inline",

  inline: true,

  atom: true,

  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") || element.textContent || "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-math"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = String(HTMLAttributes.latex || "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "inline-math",
        "data-latex": latex,
        class: "math-node inline-math",
      }),
      latex,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) =>
      React.createElement(MathNodeView, {
        node: props.node,
        updateAttributes: props.updateAttributes,
        displayMode: false,
      }),
    );
  },

  addCommands() {
    return {
      insertInlineMath:
        (latex = "a^2+b^2=c^2") =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\$([^$\n]+)\$$/,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1].trim() }),
      }),
    ];
  },
});

export const BlockMath = Node.create({
  name: "blockMath",

  group: "block",

  atom: true,

  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") || element.textContent || "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="block-math"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = String(HTMLAttributes.latex || "");
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "block-math",
        "data-latex": latex,
        class: "math-node block-math",
      }),
      latex,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) =>
      React.createElement(MathNodeView, {
        node: props.node,
        updateAttributes: props.updateAttributes,
        displayMode: true,
      }),
    );
  },

  addCommands() {
    return {
      insertBlockMath:
        (latex = "E=mc^2") =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^\$\$([\s\S]+?)\$\$$/,
        type: this.type,
        getAttributes: (match) => ({ latex: match[1].trim() }),
      }),
    ];
  },
});
