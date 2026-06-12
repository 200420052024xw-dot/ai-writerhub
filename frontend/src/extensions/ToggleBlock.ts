import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import React from "react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggle: {
      setToggle: () => ReturnType;
    };
  }
}

export const ToggleBlock = Node.create({
  name: "toggle",

  group: "block",

  content: "(paragraph|heading|bulletList|orderedList|blockquote|codeBlock|horizontalRule|table|blockMath)+",

  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute("open") !== null,
        renderHTML: (attributes) => (attributes.open ? { open: "" } : {}),
      },
      title: {
        default: "展开查看详情",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "details[data-type-toggle]",
      },
      {
        tag: 'div[data-type="toggle"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "toggle",
        class: "toggle-block",
        "data-open": HTMLAttributes.open ? "true" : "false",
      }),
      ["div", { class: "toggle-summary" }, HTMLAttributes.title || "展开查看详情"],
      ["div", { class: "toggle-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setToggle:
        () =>
        ({ commands, state }) => {
          for (let depth = state.selection.$from.depth; depth > 0; depth -= 1) {
            const name = state.selection.$from.node(depth).type.name;
            if (name === "callout" || name === "toggle") return false;
          }
          return commands.wrapIn(this.name, { open: true, title: "展开查看详情" });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) => {
      const title: string = props.node.attrs.title || "";
      const open = props.node.attrs.open !== false;
      const isDefaultTitle = !title || title === "展开查看详情";

      return React.createElement(
        NodeViewWrapper,
        {
          as: "div",
          className: "toggle-block",
          "data-open": open ? "true" : "false",
        },
        React.createElement(
          "div",
          { className: "toggle-summary" },
          React.createElement(
            "button",
            {
              className: "toggle-control",
              type: "button",
              onClick: () => props.updateAttributes({ open: !open }),
              title: open ? "收起" : "展开",
            },
            React.createElement("span", null),
          ),
          open
            ? React.createElement("input", {
                className: "toggle-title-input",
                value: isDefaultTitle ? "" : title,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  props.updateAttributes({ title: event.target.value }),
                onClick: (event: React.MouseEvent<HTMLInputElement>) => event.stopPropagation(),
                placeholder: "展开查看详情",
              })
            : React.createElement(
                "span",
                { className: "toggle-title-text", style: { color: isDefaultTitle ? "#94a3b8" : "#1e293b" } },
                isDefaultTitle ? "展开查看详情" : title,
              ),
        ),
        React.createElement(NodeViewContent, {
          as: "div",
          className: "toggle-content",
        }),
      );
    });
  },
});
