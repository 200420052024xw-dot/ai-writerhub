import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type FoldMeta = {
  type: "toggle";
  pos: number;
};

type TopLevelNode = {
  pos: number;
  nodeSize: number;
  type: string;
  level?: number;
};

const structureFoldKey = new PluginKey<Set<number>>("structureFold");

function collectTopLevelNodes(doc: ProseMirrorNode) {
  const nodes: TopLevelNode[] = [];
  doc.forEach((node, offset) => {
    nodes.push({
      pos: offset,
      nodeSize: node.nodeSize,
      type: node.type.name,
      level: node.attrs.level,
    });
  });
  return nodes;
}

export const StructureFold = Extension.create({
  name: "structureFold",

  addProseMirrorPlugins() {
    return [
      new Plugin<Set<number>>({
        key: structureFoldKey,
        state: {
          init: () => new Set<number>(),
          apply(tr, value) {
            const next = new Set<number>();
            value.forEach((pos) => {
              const mapped = tr.mapping.mapResult(pos, 1);
              if (!mapped.deleted) {
                next.add(mapped.pos);
              }
            });

            const meta = tr.getMeta(structureFoldKey) as FoldMeta | undefined;
            if (meta?.type === "toggle") {
              if (next.has(meta.pos)) {
                next.delete(meta.pos);
              } else {
                next.add(meta.pos);
              }
            }

            return next;
          },
        },
        props: {
          decorations(state) {
            const folded = structureFoldKey.getState(state);
            if (!folded) return DecorationSet.empty;

            const doc = state.doc;
            const nodes = collectTopLevelNodes(doc);
            const decorations: Decoration[] = [];

            nodes.forEach((entry, index) => {
              if (entry.type !== "heading") return;
              if (index === 0 && entry.pos === 0) return;

              const isFolded = folded.has(entry.pos);
              decorations.push(
                Decoration.widget(
                  entry.pos + 1,
                  (view) => {
                    const button = document.createElement("button");
                    button.className = `structure-fold-control ${isFolded ? "folded" : ""}`;
                    button.type = "button";
                    button.contentEditable = "false";
                    button.title = isFolded ? "展开该标题下内容" : "折叠该标题下内容";
                    button.setAttribute("aria-label", button.title);
                    button.addEventListener("mousedown", (event) => event.preventDefault());
                    button.addEventListener("click", (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      view.dispatch(state.tr.setMeta(structureFoldKey, { type: "toggle", pos: entry.pos } satisfies FoldMeta));
                    });
                    return button;
                  },
                  { side: -1, key: `structure-fold-${entry.pos}` },
                ),
              );

              if (!isFolded) return;

              decorations.push(
                Decoration.node(entry.pos, entry.pos + entry.nodeSize, {
                  class: "structure-fold-heading-folded",
                }),
              );

              const level = entry.level || 1;
              for (let cursor = index + 1; cursor < nodes.length; cursor += 1) {
                const current = nodes[cursor];
                if (current.type === "heading" && (current.level || 1) <= level) {
                  break;
                }
                decorations.push(
                  Decoration.node(current.pos, current.pos + current.nodeSize, {
                    class: "structure-fold-hidden",
                  }),
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
