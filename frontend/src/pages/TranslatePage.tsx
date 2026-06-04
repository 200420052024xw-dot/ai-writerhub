import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCheck, Copy, Download, Edit3, Languages, Loader2, Settings, Sparkles, Trash2, X } from "lucide-react";
import {
  createStoredDocument,
  extractTerms,
  getDocumentTranslationState,
  saveDocumentTranslationState,
  saveStoredDocument,
  saveStoredDocumentParagraphs,
  translateTextStream,
  type ExtractTermsResponse,
  type GlossaryEntry,
  type StoredDocumentParagraph,
  type StoredDocumentParagraphInput,
  type TranslationChunk,
  type TranslationDirection,
  type TranslationDisplayMode,
  type TranslationOptions,
  type TranslationPair,
  type TranslationSourceParagraph,
  type TranslationStyle,
  type TranslationStreamEvent,
} from "../services/api";
import { loadModelSettings } from "../services/modelSettings";

const styleOptions: Array<[TranslationStyle, string]> = [
  ["default", "默认"],
  ["academic", "学术风格"],
  ["business", "商务风格"],
  ["natural", "口语自然"],
];

const checkOptions: Array<[keyof Pick<TranslationOptions, "unified_terms" | "preserve_names">, string]> = [
  ["unified_terms", "术语统一"],
  ["preserve_names", "保留专有名词"],
];

const defaultOptions: TranslationOptions = {
  style: "default",
  unified_terms: true,
  preserve_names: true,
  custom_requirements: "",
};

const GLOSSARY_KEY = "writerhub_glossary";
const TRANSLATE_STATE_KEY = "writerhub.translatePageState";

type TranslationSaveMode =
  | "target-only"
  | "paragraph-source-target"
  | "paragraph-target-source"
  | "sentence-source-target"
  | "sentence-target-source";

function loadGlossary(): GlossaryEntry[] {
  try {
    const raw = localStorage.getItem(GLOSSARY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGlossaryToStorage(glossary: GlossaryEntry[]) {
  localStorage.setItem(GLOSSARY_KEY, JSON.stringify(glossary));
}

type TranslationResult = {
  target_text: string;
  context_summary: string;
  used_context_summary: boolean;
  chunks: TranslationChunk[];
  paragraph_pairs: TranslationPair[];
  sentence_pairs: TranslationPair[];
  direction: TranslationDirection;
};

type TranslatePageState = {
  sourceText: string;
  direction: TranslationDirection;
  displayMode: TranslationDisplayMode;
  options: TranslationOptions;
  result: TranslationResult | null;
  enableCustomRequirements: boolean;
  saveMode: TranslationSaveMode;
};

function paragraphToText(paragraph: StoredDocumentParagraph) {
  if (paragraph.type === "title") return paragraph.content.trim();
  if (paragraph.type === "heading") return `${"#".repeat(Math.max(2, Math.min(5, paragraph.level + 1)))} ${paragraph.content}`.trim();
  return paragraph.content;
}

function renderSourceText(document?: { title?: string; content: string; paragraphs?: StoredDocumentParagraph[] } | null) {
  if (!document) return "";
  if (document.paragraphs?.length) {
    return document.paragraphs.map(paragraphToText).filter((content) => content.trim()).join("\n\n");
  }
  const title = document.title?.trim() || "";
  const content = document.content
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, (match) => match.trimEnd() + " ")
    .replace(/[*_`~]/g, "");
  if (!title) return content;
  const firstLine = content.split("\n").find((line) => line.trim())?.trim();
  return firstLine === title ? content : `${title}\n\n${content}`;
}

function sourceParagraphsForTranslation(document?: { paragraphs?: StoredDocumentParagraph[] } | null): TranslationSourceParagraph[] | undefined {
  const paragraphs = document?.paragraphs
    ?.filter((paragraph) => paragraph.id && paragraph.content.trim())
    .map((paragraph) => ({
      id: paragraph.id,
      type: paragraph.type,
      level: paragraph.level,
      content: paragraph.content,
    }));
  return paragraphs?.length ? paragraphs : undefined;
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

function textToParagraphInputs(text: string, existingParagraphs: StoredDocumentParagraph[]): any[] {
  const existingTitle = existingParagraphs.find((paragraph) => paragraph.type === "title");
  const existingBody = existingParagraphs.filter((paragraph) => paragraph.type !== "title");
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n+/).map((block) => block.trim());
  const bodyInputs: StoredDocumentParagraphInput[] = [];
  let titleInput: StoredDocumentParagraphInput | null = null;

  blocks.forEach((block, index) => {
    if (!block && blocks.length > 1) return;
    const inferred = inferParagraphInput(block, existingBody[bodyInputs.length]);
    if (inferred.type === "title" && titleInput === null) {
      titleInput = { ...inferred, id: existingTitle?.id };
      return;
    }
    bodyInputs.push(inferred.type === "title" ? { ...inferred, type: "heading" as const, level: 1 } : inferred);
  });

  return [
    titleInput || { id: existingTitle?.id, type: "title", level: 0, content: existingTitle?.content || "无标题文档" },
    ...(bodyInputs.length ? bodyInputs : [{ id: existingBody[0]?.id, type: "paragraph", level: 0, content: "" }]),
  ];
}

function paragraphsForTranslation(paragraphs: StoredDocumentParagraph[]): TranslationSourceParagraph[] {
  return paragraphs
    .filter((paragraph) => paragraph.id && paragraph.content.trim())
    .map((paragraph) => ({
      id: paragraph.id,
      type: paragraph.type,
      level: paragraph.level,
      content: paragraph.content,
    }));
}

function splitParagraphsForDisplay(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  const lines = normalized.split("\n").map((item) => item.trim()).filter(Boolean);
  return lines.length > 1 ? lines : paragraphs;
}

function splitSentencesForDisplay(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^。！？!?；;.]+[。！？!?；;.]?/g);
  return (matches || [normalized]).map((item) => item.trim()).filter(Boolean);
}

function buildDisplayParagraphPairs(result: TranslationResult | null, sourceText: string): TranslationPair[] {
  if (!result) return [];
  const existingPairs = result.paragraph_pairs.length > 0 ? result.paragraph_pairs : result.chunks.flatMap((chunk) => chunk.paragraph_pairs);
  if (existingPairs.length > 1) return existingPairs;
  const sourceParagraphs = splitParagraphsForDisplay(sourceText);
  const targetParagraphs = splitParagraphsForDisplay(result.target_text);
  if (sourceParagraphs.length > 1 && sourceParagraphs.length === targetParagraphs.length) {
    return sourceParagraphs.map((source, index) => ({ source, target: targetParagraphs[index] }));
  }
  return existingPairs.length > 0 ? existingPairs : [{ source: sourceText, target: result.target_text }];
}

function buildDisplaySentencePairs(paragraphPairs: TranslationPair[], result: TranslationResult | null): TranslationPair[] {
  if (!result) return [];
  if (result.sentence_pairs.length > 0) return result.sentence_pairs;
  const pairs: TranslationPair[] = [];
  paragraphPairs.forEach((pair) => {
    const sourceSentences = splitSentencesForDisplay(pair.source);
    const targetSentences = splitSentencesForDisplay(pair.target);
    if (sourceSentences.length > 1 && sourceSentences.length === targetSentences.length) {
      sourceSentences.forEach((source, index) => pairs.push({ source, target: targetSentences[index] }));
      return;
    }
    pairs.push(pair);
  });
  return pairs;
}

function splitSentencesStable(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^\u3002\uff01\uff1f!?;；.]+[\u3002\uff01\uff1f!?;；.]?/g);
  return (matches || [normalized]).map((item) => item.trim()).filter(Boolean);
}

function splitBlankParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  return normalized.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
}

function buildDisplayParagraphPairsSafe(result: TranslationResult | null, sourceText: string): TranslationPair[] {
  if (!result) return [];
  const paragraphPairs = result.paragraph_pairs || [];
  if (paragraphPairs.length > 0) return paragraphPairs;
  const sourceBlankParagraphs = splitBlankParagraphs(sourceText);
  const targetBlankParagraphs = splitBlankParagraphs(result.target_text || "");
  if (sourceBlankParagraphs.length > 0 && sourceBlankParagraphs.length === targetBlankParagraphs.length) {
    return sourceBlankParagraphs.map((source, index) => ({ source, target: targetBlankParagraphs[index] }));
  }
  const chunks = result.chunks || [];
  const existingPairs = paragraphPairs.length > 0 ? paragraphPairs : chunks.flatMap((chunk) => chunk.paragraph_pairs || []);
  if (existingPairs.length > 1) return existingPairs;
  const sourceParagraphs = splitParagraphsForDisplay(sourceText);
  const targetParagraphs = splitParagraphsForDisplay(result.target_text || "");
  if (sourceParagraphs.length > 1 && sourceParagraphs.length === targetParagraphs.length) {
    return sourceParagraphs.map((source, index) => ({ source, target: targetParagraphs[index] }));
  }
  return existingPairs.length > 0 ? existingPairs : [{ source: sourceText, target: result.target_text || "" }];
}

function buildDisplaySentencePairsSafe(paragraphPairs: TranslationPair[], result: TranslationResult | null): TranslationPair[] {
  if (!result) return [];
  const existingPairs = result.sentence_pairs || [];
  if (existingPairs.length > 0) return existingPairs;
  const pairs: TranslationPair[] = [];
  paragraphPairs.forEach((pair) => {
    const sourceSentences = splitSentencesStable(pair.source);
    const targetSentences = splitSentencesStable(pair.target);
    if (sourceSentences.length > 0 && sourceSentences.length === targetSentences.length) {
      sourceSentences.forEach((source, index) => pairs.push({ source, target: targetSentences[index] }));
      return;
    }
    pairs.push(pair);
  });
  if (pairs.length > paragraphPairs.length) return pairs;
  return existingPairs.length > paragraphPairs.length ? existingPairs : pairs;
}

function swapPairs(pairs: TranslationPair[]): TranslationPair[] {
  return pairs.map((pair) => ({ ...pair, source: pair.target, target: pair.source }));
}

function swapTranslationResult(result: TranslationResult | null, previousSource: string, nextDirection: TranslationDirection): TranslationResult | null {
  if (!result?.target_text) return null;
  return {
    ...result,
    target_text: previousSource,
    direction: nextDirection,
    chunks: (result.chunks || []).map((chunk) => ({
      ...chunk,
      source: chunk.target,
      target: chunk.source,
      paragraph_pairs: swapPairs(chunk.paragraph_pairs || []),
      sentence_pairs: swapPairs(chunk.sentence_pairs || []),
    })),
    paragraph_pairs: swapPairs(result.paragraph_pairs || []),
    sentence_pairs: swapPairs(result.sentence_pairs || []),
  };
}

export function TranslatePage({ sourceDocument }: { sourceDocument?: { id?: string; title?: string; content: string; paragraphs?: StoredDocumentParagraph[]; glossary?: GlossaryEntry[] } | null }) {
  const cachedState = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(TRANSLATE_STATE_KEY) || "null") as TranslatePageState | null;
    } catch {
      return null;
    }
  }, []);
  const [sourceText, setSourceText] = useState(() => cachedState?.sourceText ?? renderSourceText(sourceDocument));
  const [direction, setDirection] = useState<TranslationDirection>(cachedState?.direction ?? "zh-en");
  const [displayMode, setDisplayMode] = useState<TranslationDisplayMode>(cachedState?.displayMode ?? "split");
  const [options, setOptions] = useState<TranslationOptions>(cachedState?.options ?? defaultOptions);
  const [result, setResult] = useState<TranslationResult | null>(cachedState?.result ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const [glossary, setGlossary] = useState<GlossaryEntry[]>(() => sourceDocument?.glossary ?? loadGlossary());
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [enableCustomRequirements, setEnableCustomRequirements] = useState(cachedState?.enableCustomRequirements ?? false);
  const [saveMode, setSaveMode] = useState<TranslationSaveMode>(cachedState?.saveMode ?? "paragraph-source-target");
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [loadedTranslationDocumentId, setLoadedTranslationDocumentId] = useState<string | null>(null);
  const [documentParagraphs, setDocumentParagraphs] = useState<StoredDocumentParagraph[]>(() => sourceDocument?.paragraphs || []);
  const [sourceSaveState, setSourceSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const loadingSourceRef = useRef(false);
  const documentParagraphsRef = useRef<StoredDocumentParagraph[]>(sourceDocument?.paragraphs || []);
  const latestSavePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDocumentTranslation = async () => {
      if (!sourceDocument?.id) {
        loadingSourceRef.current = true;
        setSourceText(renderSourceText(sourceDocument));
        setResult(null);
        setGlossary(sourceDocument?.glossary || loadGlossary());
        setDocumentParagraphs(sourceDocument?.paragraphs || []);
        documentParagraphsRef.current = sourceDocument?.paragraphs || [];
        setLoadedTranslationDocumentId(null);
        window.setTimeout(() => {
          loadingSourceRef.current = false;
        }, 0);
        return;
      }
      loadingSourceRef.current = true;
      setGlossary(sourceDocument.glossary || []);
      setDocumentParagraphs(sourceDocument.paragraphs || []);
      documentParagraphsRef.current = sourceDocument.paragraphs || [];
      try {
        const stored = await getDocumentTranslationState(sourceDocument.id);
        if (cancelled) return;
        if (stored) {
          setSourceText(stored.source_text || renderSourceText(sourceDocument));
          setDirection(stored.direction);
          setDisplayMode(stored.display_mode);
          setOptions(stored.options || defaultOptions);
          setResult({
            target_text: stored.target_text,
            context_summary: stored.context_summary,
            used_context_summary: stored.used_context_summary,
            chunks: stored.chunks || [],
            paragraph_pairs: stored.paragraph_pairs || [],
            sentence_pairs: stored.sentence_pairs || [],
            direction: stored.direction,
          });
        } else {
          setSourceText(renderSourceText(sourceDocument));
          setResult(null);
          setDisplayMode("split");
          setDirection("zh-en");
        }
        setLoadedTranslationDocumentId(sourceDocument.id);
      } catch {
        if (cancelled) return;
        setSourceText(renderSourceText(sourceDocument));
        setResult(null);
        setLoadedTranslationDocumentId(sourceDocument.id);
      } finally {
        window.setTimeout(() => {
          loadingSourceRef.current = false;
        }, 0);
      }
    };
    void loadDocumentTranslation();
    return () => {
      cancelled = true;
    };
  }, [sourceDocument?.id]);

  useEffect(() => {
    localStorage.setItem(
      TRANSLATE_STATE_KEY,
      JSON.stringify({ sourceText, direction, displayMode, options, result, enableCustomRequirements, saveMode }),
    );
  }, [sourceText, direction, displayMode, options, result, enableCustomRequirements, saveMode]);

  useEffect(() => {
    if (!sourceDocument?.id || loadedTranslationDocumentId !== sourceDocument.id) return;
    if (!result) return;
    const timer = window.setTimeout(() => {
      void saveDocumentTranslationState(sourceDocument.id!, {
        source_text: sourceText,
        target_text: result?.target_text || "",
        direction,
        display_mode: displayMode,
        context_summary: result?.context_summary || "",
        used_context_summary: result?.used_context_summary || false,
        chunks: result?.chunks || [],
        paragraph_pairs: result?.paragraph_pairs || [],
        sentence_pairs: result?.sentence_pairs || [],
        options,
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [sourceDocument?.id, loadedTranslationDocumentId, sourceText, result, direction, displayMode, options]);

  useEffect(() => {
    if (!sourceDocument?.id || loadedTranslationDocumentId !== sourceDocument.id || loadingSourceRef.current) return;
    const timer = window.setTimeout(() => {
      const savePromise = saveStoredDocumentParagraphs(
        sourceDocument.id!,
        textToParagraphInputs(sourceText, documentParagraphs),
      )
        .then((saved) => {
          documentParagraphsRef.current = saved.paragraphs;
          setDocumentParagraphs(saved.paragraphs);
          setSourceSaveState("saved");
        })
        .catch((error) => {
          setSourceSaveState("failed");
          throw error;
        })
        .finally(() => {
          if (latestSavePromiseRef.current === savePromise) {
            latestSavePromiseRef.current = null;
          }
        });
      latestSavePromiseRef.current = savePromise;
      setSourceSaveState("saving");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [sourceText, sourceDocument?.id, loadedTranslationDocumentId]);

  useEffect(() => {
    if (!sourceDocument?.id) {
      saveGlossaryToStorage(glossary);
      return;
    }
    const timer = window.setTimeout(() => {
      void saveStoredDocument(sourceDocument.id!, { glossary });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [glossary, sourceDocument?.id]);

  const targetText = result?.target_text ?? "";
  const sourceTitle = direction === "zh-en" ? "中文原文" : "English Source";
  const targetTitle = direction === "zh-en" ? "English Translation" : "中文译文";
  const resultDirectionLabel = result?.direction === "zh-en" ? "中 → 英" : "英 → 中";
  const currentDirectionLabel = direction === "zh-en" ? "中 → 英" : "英 → 中";
  const modelSettings = loadModelSettings();
  const aiConfig = {
    api_key: modelSettings.apiKey,
    base_url: modelSettings.baseUrl,
    model: modelSettings.defaultModel,
  };

  const pairs: TranslationPair[] = useMemo(() => {
    if (!result) return [];
    const paragraphPairs = buildDisplayParagraphPairsSafe(result, sourceText);
    if (displayMode === "sentence") return buildDisplaySentencePairsSafe(paragraphPairs, result);
    return paragraphPairs;
  }, [displayMode, result, sourceText]);
  const emptyCompareTarget = result && displayMode === "sentence"
    ? "句级结构未对齐，请切换到段落交替查看完整结果。"
    : '点击"开始翻译"后，结果会显示在这里。';

  const runTranslation = async () => {
    if (!sourceDocument?.id) {
      setMessage("请先选择一个文件；翻译页修改原文会同步更新当前文件。");
      window.setTimeout(() => setMessage(""), 2600);
      return;
    }
    if (!modelSettings.apiKey.trim() || !modelSettings.baseUrl.trim() || !modelSettings.defaultModel.trim()) {
      setMessage("请先在设置页配置模型");
      window.setTimeout(() => setMessage(""), 2200);
      return;
    }

    setIsLoading(true);
    setMessage("");
    setProgress(null);
    setResult(null);

    try {
      let totalChunks = 0;
      const chunks: TranslationChunk[] = [];
      const paragraphPairs: TranslationPair[] = [];
      const sentencePairs: TranslationPair[] = [];
      let contextSummary = "";
      let usedContext = false;
      if (latestSavePromiseRef.current) {
        await latestSavePromiseRef.current;
      }
      const structuredParagraphs = paragraphsForTranslation(documentParagraphsRef.current);
      if (structuredParagraphs.length === 0) {
        setMessage("当前文件没有可翻译的段落");
        return;
      }

      await translateTextStream(
        {
          source_text: sourceText,
          source_paragraphs: structuredParagraphs,
          direction,
          display_mode: displayMode,
          options,
          glossary: glossary.length > 0 ? glossary : undefined,
          ai_config: aiConfig,
        },
        (event: TranslationStreamEvent) => {
          switch (event.type) {
            case "start":
              totalChunks = event.total_chunks;
              usedContext = event.used_context;
              setProgress({ current: 0, total: totalChunks });
              break;
            case "context_summary":
              contextSummary = event.summary;
              break;
            case "chunk":
              chunks.push({
                index: event.index,
                source: event.source,
                target: event.target,
                paragraph_pairs: event.paragraph_pairs || [],
                sentence_pairs: event.sentence_pairs || [],
              });
              paragraphPairs.push(...(event.paragraph_pairs || []));
              sentencePairs.push(...(event.sentence_pairs || []));
              setProgress({ current: chunks.length, total: totalChunks });
              setResult({
                target_text: chunks.map((c) => c.target).join("\n\n"),
                context_summary: contextSummary,
                used_context_summary: usedContext,
                chunks: [...chunks],
                paragraph_pairs: [...paragraphPairs],
                sentence_pairs: [...sentencePairs],
                direction,
              });
              break;
            case "complete":
              setResult({
                target_text: event.target_text,
                context_summary: event.context_summary,
                used_context_summary: usedContext,
                chunks: event.chunks,
                paragraph_pairs: event.paragraph_pairs || event.chunks.flatMap((chunk) => chunk.paragraph_pairs),
                sentence_pairs: event.sentence_pairs || event.chunks.flatMap((chunk) => chunk.sentence_pairs),
                direction,
              });
              break;
            case "error":
              setMessage(event.message);
              break;
          }
        },
      );
    } catch {
      setMessage("翻译失败，请检查后端服务或模型配置");
    } finally {
      setIsLoading(false);
      setProgress(null);
      window.setTimeout(() => setMessage(""), 2200);
    }
  };

  const copyTranslation = async () => {
    if (!targetText) return;
    await navigator.clipboard.writeText(targetText);
    setMessage("译文已复制");
    window.setTimeout(() => setMessage(""), 1600);
  };

  const switchDirection = (nextDirection: TranslationDirection) => {
    if (nextDirection !== direction && result?.target_text) {
      const previousSource = sourceText;
      setSourceText(result.target_text);
      setResult(swapTranslationResult(result, previousSource, nextDirection));
    }
    setDirection(nextDirection);
  };

  const formatPair = (pair: TranslationPair, mode: TranslationSaveMode) => {
    if (mode.endsWith("target-source")) return `${pair.target}（${pair.source}）`;
    return `${pair.source}（${pair.target}）`;
  };

  const buildSavedTranslationContent = () => {
    if (!result) return "";
    if (saveMode === "target-only") return result.target_text;
    const displayParagraphPairs = buildDisplayParagraphPairsSafe(result, sourceText);
    const sourcePairs = saveMode.startsWith("sentence") ? buildDisplaySentencePairsSafe(displayParagraphPairs, result) : displayParagraphPairs;
    const fallbackPairs = (result.chunks || []).map((chunk) => ({ source: chunk.source, target: chunk.target }));
    return (sourcePairs.length > 0 ? sourcePairs : fallbackPairs)
      .map((pair) => formatPair(pair, saveMode))
      .join("\n\n");
  };

  const saveTranslation = async () => {
    if (!result) return;
    const content = buildSavedTranslationContent();
    if (!content.trim()) {
      setMessage("没有可保存的翻译内容");
      window.setTimeout(() => setMessage(""), 1800);
      return;
    }
    try {
      const baseTitle = sourceDocument?.title?.trim() || "未命名文档";
      await createStoredDocument({
        title: `${baseTitle} - 翻译结果`,
        content,
        glossary,
      });
      setMessage("翻译结果已保存到首页");
      setShowSaveMenu(false);
    } catch (error) {
      setMessage(error instanceof Error ? `保存翻译失败：${error.message}` : "保存翻译失败");
    } finally {
      window.setTimeout(() => setMessage(""), 1800);
    }
  };

  const runExtractTerms = async () => {
    if (!sourceText.trim()) return;
    if (!modelSettings.apiKey.trim() || !modelSettings.baseUrl.trim() || !modelSettings.defaultModel.trim()) {
      setMessage("请先在设置页配置模型");
      window.setTimeout(() => setMessage(""), 2200);
      return;
    }

    setIsExtracting(true);
    setMessage("");

    try {
      const response: ExtractTermsResponse = await extractTerms({
        source_text: sourceText,
        direction,
        ai_config: aiConfig,
      });
      if (response.terms.length === 0) {
        setMessage("未从文本中提炼出术语");
      } else {
        setGlossary((current) => {
          const existing = new Set(current.map((e) => e.source));
          const newTerms = response.terms.filter((t) => !existing.has(t.source));
          return [...current, ...newTerms];
        });
        setShowGlossaryModal(true);
        setMessage(`已提炼 ${response.terms.length} 条术语`);
      }
    } catch {
      setMessage("术语提炼失败，请检查后端服务或模型配置");
    } finally {
      setIsExtracting(false);
      window.setTimeout(() => setMessage(""), 2200);
    }
  };

  const downloadGlossary = () => {
    if (glossary.length === 0) return;
    const content = glossary.map((e) => `${e.source} → ${e.target}`).join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "术语表.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateGlossaryEntry = (index: number, field: "source" | "target", value: string) => {
    setGlossary((current) => current.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  };

  const removeGlossaryEntry = (index: number) => {
    setGlossary((current) => current.filter((_, i) => i !== index));
  };

  const closeGlossaryModal = () => {
    setGlossary((current) => current.filter((entry) => entry.source.trim() !== "" && entry.target.trim() !== ""));
    setShowGlossaryModal(false);
  };

  const addGlossaryEntry = () => {
    setGlossary((current) => [...current, { source: "", target: "" }]);
  };

  const previewLimit = 7;
  const glossaryPreview = glossary.slice(0, previewLimit);
  const hasMore = glossary.length > previewLimit;
  const saveModeLabels: Record<TranslationSaveMode, string> = {
    "target-only": "仅保存译文",
    "paragraph-source-target": "分段：原文（译文）",
    "paragraph-target-source": "分段：译文（原文）",
    "sentence-source-target": "逐句：原文（译文）",
    "sentence-target-source": "逐句：译文（原文）",
  };

  return (
    <section className="page translate-page">
      <div className="mode-bar">
        <div className="segmented">
          <button className={direction === "zh-en" ? "selected" : ""} onClick={() => switchDirection("zh-en")} type="button">
            中 → 英
          </button>
          <button className={direction === "en-zh" ? "selected" : ""} onClick={() => switchDirection("en-zh")} type="button">
            英 → 中
          </button>
        </div>
        <button className="primary-action" disabled={isLoading} onClick={runTranslation} type="button">
          {isLoading ? <Loader2 className="spin" size={18} /> : <Languages size={18} />}
          {isLoading ? "翻译中" : "开始翻译"}
        </button>
        <div className="segmented">
          <button className={displayMode === "split" ? "selected" : ""} onClick={() => setDisplayMode("split")} type="button">
            分屏对照
          </button>
          <button className={displayMode === "paragraph" ? "selected" : ""} onClick={() => setDisplayMode("paragraph")} type="button">
            段落交替
          </button>
          <button className={displayMode === "sentence" ? "selected" : ""} onClick={() => setDisplayMode("sentence")} type="button">
            句对句对照
          </button>
        </div>
      </div>

      {message && <div className="copy-toast done">{message}</div>}

      <div className={`translation-layout translation-layout-${displayMode}`}>
        {displayMode === "split" && (
          <>
            <article className="panel text-panel">
              <div className="panel-header">
                <h2>{sourceTitle}</h2>
                <span>{sourceText.length} 字符</span>
              </div>
              <div className={`translation-sync-note ${sourceSaveState}`}>
                修改原文会自动同步更新当前文件
                {sourceSaveState === "saving" && "，保存中..."}
                {sourceSaveState === "saved" && "，已保存"}
                {sourceSaveState === "failed" && "，保存失败"}
              </div>
              <textarea
                className="translation-input"
                onChange={(event) => {
                  setSourceText(event.target.value);
                  setResult(null);
                  setSourceSaveState("idle");
                }}
                value={sourceText}
              />
            </article>

            <article className="panel text-panel">
              <div className="panel-header">
                <h2>{targetTitle}</h2>
                <div className="translation-header-actions">
                  {result && <span className="translation-result-direction">结果：{resultDirectionLabel}</span>}
                  {result && result.direction !== direction && <span className="translation-result-stale">当前选择：{currentDirectionLabel}</span>}
                  <button className="inline-action" onClick={copyTranslation} type="button">
                    <Copy size={15} />
                    复制
                  </button>
                </div>
              </div>
              <div className="text-body translation-output">
                {isLoading && progress && !targetText && (
                  <span className="translation-progress">翻译中 ({progress.current}/{progress.total} 块)...</span>
                )}
                {targetText || (!isLoading && '点击"开始翻译"后，译文会显示在这里。')}
              </div>
            </article>
          </>
        )}

        {displayMode !== "split" && (
          <article className="panel compare-panel">
            <div className="panel-header">
              <h2>{displayMode === "paragraph" ? "段落交替" : "句对句对照"}</h2>
              <div className="translation-header-actions">
                {result && <span className="translation-result-direction">结果：{resultDirectionLabel}</span>}
                {result && result.direction !== direction && <span className="translation-result-stale">当前选择：{currentDirectionLabel}</span>}
                <button className="inline-action" onClick={copyTranslation} type="button">
                  <Copy size={15} />
                  复制译文
                </button>
              </div>
            </div>
            <div className="compare-list">
              {(pairs.length ? pairs : [{ source: sourceText, target: emptyCompareTarget }]).map((pair, index) => (
                <div className="compare-row" key={`${pair.source}-${index}`}>
                  <div>
                    <span>原文 {index + 1}</span>
                    <p>{pair.source}</p>
                  </div>
                  <div>
                    <span>译文 {index + 1}</span>
                    <p>{pair.target}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}

        <aside className="side-panel panel">
          <div className="panel-title">
            <div className="panel-title-left">
              <Settings size={20} />
              <h2>翻译设置</h2>
            </div>
            <div className="translation-save-wrapper">
              <button className="translation-save-btn" disabled={!result} onClick={() => setShowSaveMenu((current) => !current)} type="button">
                保存翻译
              </button>
              {showSaveMenu && (
                <div className="translation-save-menu">
                  {(Object.keys(saveModeLabels) as TranslationSaveMode[]).map((mode) => (
                    <button
                      className={saveMode === mode ? "active" : ""}
                      key={mode}
                      onClick={() => setSaveMode(mode)}
                      type="button"
                    >
                      <span>{saveModeLabels[mode]}</span>
                      {saveMode === mode && <Check size={14} />}
                    </button>
                  ))}
                  <button className="primary-save-translation" onClick={() => void saveTranslation()} type="button">
                    保存到首页
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="panel-section-label">语体风格</div>
          <label className="style-select-row">
            <select
              value={options.style}
              onChange={(event) => setOptions((current) => ({ ...current, style: event.target.value as TranslationStyle }))}
            >
              {styleOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <div className="panel-section-label">翻译规范</div>
          {checkOptions.map(([key, label]) => (
            <label className="check-row" key={key}>
              <span>
                <ClipboardCheck size={17} />
                {label}
              </span>
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))}
              />
            </label>
          ))}
          <label className="check-row">
            <span>
              <ClipboardCheck size={17} />
              其他要求
            </span>
            <input
              type="checkbox"
              checked={enableCustomRequirements}
              onChange={(event) => {
                setEnableCustomRequirements(event.target.checked);
                if (!event.target.checked) {
                  setOptions((current) => ({ ...current, custom_requirements: "" }));
                }
              }}
            />
          </label>
          {enableCustomRequirements && (
            <textarea
              className="other-requirements"
              placeholder="请输入自定义翻译要求，如：保持原文段落结构、使用美式英语..."
              value={options.custom_requirements}
              onChange={(event) => setOptions((current) => ({ ...current, custom_requirements: event.target.value }))}
              rows={3}
            />
          )}
          <div className="glossary-header">
            <div className="panel-section-label">术语表 / 记忆库</div>
            <div className="glossary-actions">
              <button
                className="icon-btn"
                disabled={isExtracting}
                onClick={runExtractTerms}
                title="AI 提炼术语"
                type="button"
              >
                {isExtracting ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              </button>
              <button
                className="icon-btn"
                disabled={glossary.length === 0}
                onClick={downloadGlossary}
                title="下载术语表"
                type="button"
              >
                <Download size={14} />
              </button>
              <button
                className="icon-btn"
                onClick={() => setShowGlossaryModal(true)}
                title="编辑术语表"
                type="button"
              >
                <Edit3 size={14} />
              </button>
            </div>
          </div>
          <div className="term-box">
            {glossary.length === 0 ? (
              <p className="term-empty">暂无术语，点击 AI 提炼或编辑添加</p>
            ) : (
              <>
                {glossaryPreview.map((entry, index) => (
                  <p className="term-entry" key={`${entry.source}-${index}`}>
                    <strong>{entry.source}</strong>
                    <span>{entry.target}</span>
                  </p>
                ))}
                {hasMore && (
                  <button className="term-more-button" onClick={() => setShowGlossaryModal(true)} type="button">
                    显示更多（还有 {glossary.length - previewLimit} 条）
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {showGlossaryModal && (
        <div className="glossary-modal-overlay" onClick={closeGlossaryModal}>
          <div className="glossary-modal" onClick={(event) => event.stopPropagation()}>
            <div className="glossary-modal-header">
              <h3>术语表 / 记忆库</h3>
              <button className="icon-btn" onClick={closeGlossaryModal} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="glossary-modal-body">
              {glossary.length === 0 ? (
                <p className="term-empty">暂无术语，请添加或使用 AI 提炼</p>
              ) : (
                glossary.map((entry, index) => (
                  <div className="glossary-row" key={index}>
                    <textarea
                      placeholder="原文术语"
                      value={entry.source}
                      onChange={(event) => updateGlossaryEntry(index, "source", event.target.value)}
                      rows={2}
                    />
                    <span className="glossary-arrow">→</span>
                    <textarea
                      placeholder="译文术语"
                      value={entry.target}
                      onChange={(event) => updateGlossaryEntry(index, "target", event.target.value)}
                      rows={2}
                    />
                    <button className="icon-btn danger" onClick={() => removeGlossaryEntry(index)} type="button">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="glossary-modal-footer">
              <button className="glossary-add-btn" onClick={addGlossaryEntry} type="button">
                + 添加术语
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
