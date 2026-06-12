import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType;
    };
  }
}

export const CalloutBlock = Node.create({
  name: "callout",

  group: "block",

  content: "(paragraph|heading|bulletList|orderedList|blockquote|codeBlock|horizontalRule|table|blockMath)+",

  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: "\u{1F4A1}",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "callout",
        class: "callout-block",
      }),
      [
        "span",
        { class: "callout-emoji" },
        HTMLAttributes.emoji || "\u{1F4A1}",
      ],
      ["div", { class: "callout-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands, state }) => {
          for (let depth = state.selection.$from.depth; depth > 0; depth -= 1) {
            const name = state.selection.$from.node(depth).type.name;
            if (name === "callout" || name === "toggle") return false;
          }
          return commands.wrapIn(this.name);
        },
    };
  },
});
