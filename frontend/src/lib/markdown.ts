import MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isLegacyPlaceholder(value: string) {
  return /^@@WH_?INLINE_?\d+@@$/i.test(value.trim());
}

function normalizeStoredMarkdown(markdown: string) {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(
      /<span\b[^>]*(?:data-type=["']inline-math["'][^>]*|data-latex=["'][^"']*["'][^>]*)>([\s\S]*?)<\/span>/gi,
      (match, fallback) => {
        const latex = match.match(/\bdata-latex=["']([^"']*)["']/i)?.[1] || fallback || "";
        return `$${latex}$`;
      },
    )
    .replace(/<span\b[^>]*>([\s\S]*?)<\/span>/gi, "$1");
}

function scanInlineMathDelimiter(source: string, start: number) {
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\n") return -1;
    if (char === "$" && source[index - 1] !== "\\") return index;
  }
  return -1;
}

function inlineMathRule(state: StateInline, silent: boolean) {
  const start = state.pos;
  const source = state.src;
  if (source[start] !== "$" || source[start + 1] === "$") return false;

  const end = scanInlineMathDelimiter(source, start + 1);
  if (end < 0) return false;

  const latex = source.slice(start + 1, end).trim();
  if (!latex || isLegacyPlaceholder(latex)) return false;

  if (!silent) {
    const token = state.push("math_inline", "span", 0);
    token.content = latex;
  }
  state.pos = end + 1;
  return true;
}

function blockMathRule(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const marker = state.src.slice(start, max).trim();
  if (marker !== "$$") return false;

  let nextLine = startLine + 1;
  const lines: string[] = [];
  for (; nextLine < endLine; nextLine += 1) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineEnd = state.eMarks[nextLine];
    const line = state.src.slice(lineStart, lineEnd);
    if (line.trim() === "$$") break;
    lines.push(line);
  }

  if (nextLine >= endLine) return false;

  const latex = lines.join("\n").trim();
  if (!latex || isLegacyPlaceholder(latex)) return false;

  if (!silent) {
    const token = state.push("math_block", "div", 0);
    token.block = true;
    token.content = latex;
    token.map = [startLine, nextLine + 1];
  }
  state.line = nextLine + 1;
  return true;
}

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
});

markdown.inline.ruler.after("escape", "math_inline", inlineMathRule);
markdown.block.ruler.before("fence", "math_block", blockMathRule, {
  alt: ["paragraph", "reference", "blockquote", "list"],
});

markdown.renderer.rules.math_inline = (tokens, index) => {
  const latex = tokens[index].content;
  const escaped = escapeHtml(latex);
  return `<span data-type="inline-math" data-latex="${escaped}">${escaped}</span>`;
};

markdown.renderer.rules.math_block = (tokens, index) => {
  const latex = tokens[index].content;
  const escaped = escapeHtml(latex);
  return `<div data-type="block-math" data-latex="${escaped}">${escaped}</div>\n`;
};

export function markdownToHtml(markdownSource: string) {
  return markdown.render(normalizeStoredMarkdown(markdownSource));
}
