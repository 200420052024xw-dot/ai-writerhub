import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";

type NestedBlock = {
  from: number;
  to: number;
  content: ProseMirrorNode["content"];
};

const SPECIAL_BLOCKS = new Set(["callout", "toggle"]);

function collectNestedBlocks(node: ProseMirrorNode, pos: number, insideSpecialBlock: boolean, out: NestedBlock[]) {
  node.forEach((child, offset) => {
    const childPos = pos + offset + 1;
    const isSpecialBlock = SPECIAL_BLOCKS.has(child.type.name);

    if (insideSpecialBlock && isSpecialBlock) {
      out.push({
        from: childPos,
        to: childPos + child.nodeSize,
        content: child.content,
      });
      return;
    }

    collectNestedBlocks(child, childPos, insideSpecialBlock || isSpecialBlock, out);
  });
}

export const NoNestedSpecialBlocks = Extension.create({
  name: "noNestedSpecialBlocks",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          const nestedBlocks: NestedBlock[] = [];
          collectNestedBlocks(newState.doc, -1, false, nestedBlocks);
          if (!nestedBlocks.length) return null;

          const tr = newState.tr;
          for (const block of nestedBlocks.sort((a, b) => b.from - a.from)) {
            tr.replaceWith(block.from, block.to, block.content);
          }
          return tr;
        },
      }),
    ];
  },
});
