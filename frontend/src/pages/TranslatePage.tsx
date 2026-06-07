import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ClipboardCheck, Copy, Download, Edit3, Languages, Loader2, Settings, Sparkles, Trash2, X } from "lucide-react";
import {
  createTranslationJob,
  createStoredDocument,
  extractTerms,
  getTranslationPreview,
  getTranslationWorkspace,
  saveStoredDocument,
  saveStoredDocumentParagraphs,
  type ExtractTermsResponse,
  type GlossaryEntry,
  type StoredDocumentParagraph,
  type StoredDocumentParagraphInput,
  type TranslationChunk,
  type TranslationDirection,
  type TranslationDisplayMode,
  type TranslationGranularity,
  type TranslationJob,
  type TranslationOptions,
  type TranslationPair,
  type TranslationStyle,
  type TranslationVersion,
} from "../services/api";
import { loadModelSettings } from "../services/modelSettings";
import { userStorage } from "../services/userStorage";

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

const GLOSSARY_KEY = "glossary";
const TRANSLATE_STATE_KEY = "translatePageState";

type TranslationSaveMode =
  | "target-only"
  | "paragraph-source-target"
  | "paragraph-target-source"
  | "sentence-source-target"
  | "sentence-target-source";

function loadGlossary(): GlossaryEntry[] {
  try {
    const raw = userStorage.getItem(GLOSSARY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGlossaryToStorage(glossary: GlossaryEntry[]) {
  userStorage.setItem(GLOSSARY_KEY, JSON.stringify(glossary));
}

type TranslationResult = {
  target_text: string;
  context_summary: string;
  used_context_summary: boolean;
  chunks: TranslationChunk[];
  paragraph_pairs: TranslationPair[];
  sentence_pairs: TranslationPair[];
  direction: TranslationDirection;
  translationMode: "paragraph" | "sentence";
  isStale: boolean;
};

type TranslatePageState = {
  sourceText: string;
  direction: TranslationDirection;
  displayMode: TranslationDisplayMode;
  granularity: TranslationGranularity;
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
    if (index === 0 && existingTitle && block.trim() === existingTitle.content.trim()) {
      titleInput = {
        id: existingTitle.id,
        type: "title",
        level: 0,
        content: block.trim(),
      };
      return;
    }
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

function splitParagraphsForDisplay(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  const lines = normalized.split("\n").map((item) => item.trim()).filter(Boolean);
  return lines.length > 1 ? lines : paragraphs;
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

export function TranslatePage({
  sourceDocument,
}: {
  sourceDocument?: {
    id?: string;
    title?: string;
    content: string;
    language?: "zh" | "en";
    paragraphs?: StoredDocumentParagraph[];
    glossary?: GlossaryEntry[];
  } | null;
}) {
  const cachedState = useMemo(() => {
    try {
      return JSON.parse(userStorage.getItem(TRANSLATE_STATE_KEY) || "null") as TranslatePageState | null;
    } catch {
      return null;
    }
  }, []);
  const [sourceText, setSourceText] = useState(() => cachedState?.sourceText ?? renderSourceText(sourceDocument));
  const [direction, setDirection] = useState<TranslationDirection>(
    sourceDocument?.language === "en" ? "en-zh" : "zh-en",
  );
  const [documentLanguage, setDocumentLanguage] = useState<"zh" | "en">(sourceDocument?.language ?? "zh");
  const [displayMode, setDisplayMode] = useState<TranslationDisplayMode>(
    cachedState?.displayMode === "paragraph" ? "paragraph" : "split",
  );
  const [granularity, setGranularity] = useState<TranslationGranularity>(cachedState?.granularity ?? "paragraph");
  const [options, setOptions] = useState<TranslationOptions>(cachedState?.options ?? defaultOptions);
  const [result, setResult] = useState<TranslationResult | null>(() => {
    if (!cachedState?.result) return null;
    return {
      ...cachedState.result,
      translationMode: cachedState.result.translationMode
        ?? (cachedState.displayMode === "sentence" ? "sentence" : "paragraph"),
      isStale: cachedState.result.isStale ?? false,
    };
  });
  const [message, setMessage] = useState("");
  const [versions, setVersions] = useState<TranslationVersion[]>([]);
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [previewPairs, setPreviewPairs] = useState<TranslationPair[]>([]);

  const [glossary, setGlossary] = useState<GlossaryEntry[]>(() => sourceDocument?.glossary ?? loadGlossary());
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [enableCustomRequirements, setEnableCustomRequirements] = useState(cachedState?.enableCustomRequirements ?? false);
  const [saveMode, setSaveMode] = useState<TranslationSaveMode>(cachedState?.saveMode ?? "paragraph-source-target");
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [loadedTranslationDocumentId, setLoadedTranslationDocumentId] = useState<string | null>(null);
  const [documentParagraphs, setDocumentParagraphs] = useState<StoredDocumentParagraph[]>(() => sourceDocument?.paragraphs || []);
  const [sourceSaveState, setSourceSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [editingSource, setEditingSource] = useState(false);
  const [saveRetry, setSaveRetry] = useState(0);
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
      const nextLanguage = sourceDocument.language ?? "zh";
      setDocumentLanguage(nextLanguage);
      setDirection(nextLanguage === "zh" ? "zh-en" : "en-zh");
      setGlossary(sourceDocument.glossary || []);
      setDocumentParagraphs(sourceDocument.paragraphs || []);
      documentParagraphsRef.current = sourceDocument.paragraphs || [];
      try {
        const workspace = await getTranslationWorkspace(sourceDocument.id);
        if (cancelled) return;
        setSourceText(renderSourceText(sourceDocument));
        setVersions(workspace.versions);
        setJobs(workspace.jobs);
        setLoadedTranslationDocumentId(sourceDocument.id);
      } catch {
        if (cancelled) return;
        setSourceText(renderSourceText(sourceDocument));
        setVersions([]);
        setJobs([]);
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
    const hasRequestedPairs = (version: TranslationVersion) => (
      granularity === "sentence"
        ? version.sentence_pairs.length > 0
        : version.paragraph_pairs.length > 0
    );
    const exactVersion = versions.find(
      (item) =>
        item.direction === direction
        && item.granularity === granularity
        && hasRequestedPairs(item),
    );
    const version = exactVersion ?? versions.find(
      (item) => item.direction === direction && hasRequestedPairs(item),
    );
    if (!version) {
      setResult(null);
      return;
    }
    setOptions(version.options || defaultOptions);
    setResult({
      target_text: version.target_text,
      context_summary: version.context_summary,
      used_context_summary: version.used_context_summary,
      chunks: version.chunks,
      paragraph_pairs: version.paragraph_pairs,
      sentence_pairs: version.sentence_pairs,
      direction: version.direction,
      translationMode: version.granularity,
      isStale: version.is_stale,
    });
  }, [versions, direction, granularity]);

  useEffect(() => {
    if (!sourceDocument?.id) {
      setPreviewPairs([]);
      return;
    }
    let cancelled = false;
    getTranslationPreview(sourceDocument.id, granularity)
      .then((preview) => {
        if (!cancelled) setPreviewPairs(preview.pairs);
      })
      .catch(() => {
        if (!cancelled) setPreviewPairs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceDocument?.id, granularity, documentParagraphs]);

  useEffect(() => {
    if (!sourceDocument?.id) return;
    let cancelled = false;
    const refreshWorkspace = async () => {
      try {
        const workspace = await getTranslationWorkspace(sourceDocument.id!);
        if (cancelled) return;
        setVersions(workspace.versions);
        setJobs(workspace.jobs);
      } catch {
        // Keep the last successful workspace visible.
      }
    };
    const timer = window.setInterval(refreshWorkspace, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sourceDocument?.id]);

  useEffect(() => {
    userStorage.setItem(
      TRANSLATE_STATE_KEY,
      JSON.stringify({ sourceText, direction, displayMode, granularity, options, result, enableCustomRequirements, saveMode }),
    );
  }, [sourceText, direction, displayMode, granularity, options, result, enableCustomRequirements, saveMode]);

  useEffect(() => {
    if (!sourceDocument?.id || loadedTranslationDocumentId !== sourceDocument.id || loadingSourceRef.current) return;
    const timer = window.setTimeout(() => {
      const savePromise = saveStoredDocumentParagraphs(
        sourceDocument.id!,
        textToParagraphInputs(sourceText, documentParagraphsRef.current),
      )
        .then((saved) => {
          documentParagraphsRef.current = saved.paragraphs;
          setDocumentParagraphs(saved.paragraphs);
          setSourceSaveState("saved");
          if (sourceDocument.id) {
            void getTranslationWorkspace(sourceDocument.id).then((workspace) => {
              setVersions(workspace.versions);
              setJobs(workspace.jobs);
            });
          }
          window.setTimeout(() => setSourceSaveState("idle"), 1400);
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
  }, [sourceText, sourceDocument?.id, loadedTranslationDocumentId, saveRetry]);

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
  const sourceTitle = documentLanguage === "zh" ? "中文原文" : "English Source";
  const targetTitle = documentLanguage === "zh" ? "English Translation" : "中文译文";
  const resultDirectionLabel = result?.direction === "zh-en" ? "中 → 英" : "英 → 中";
  const modelSettings = loadModelSettings();
  const aiConfig = {
    api_key: modelSettings.apiKey,
    base_url: modelSettings.baseUrl,
    model: modelSettings.defaultModel,
  };

  const pairs: TranslationPair[] = useMemo(() => {
    const translated = granularity === "sentence" ? result?.sentence_pairs : result?.paragraph_pairs;
    const translatedById = new Map(
      (translated || []).map((pair) => [
        `${pair.paragraph_id || ""}:${pair.sentence_index ?? ""}`,
        pair,
      ]),
    );
    return previewPairs.map((pair, index) => {
      const key = `${pair.paragraph_id || ""}:${pair.sentence_index ?? ""}`;
      const exact = translatedById.get(key);
      if (exact) return exact;
      const ordered = translated?.[index];
      return ordered ? { ...pair, target: ordered.target } : pair;
    });
  }, [granularity, result, previewPairs]);

  const isActiveJob = (job: TranslationJob) => (
    job.status === "queued" || job.status === "running"
  );
  const activeJob = jobs.find(
    (job) =>
      job.direction === direction
      && job.granularity === granularity
      && isActiveJob(job),
  ) ?? jobs.find(
    (job) => job.direction === direction && isActiveJob(job),
  );
  const isLoading = Boolean(activeJob);
  const progress = activeJob
    ? { current: activeJob.completed_chunks, total: activeJob.total_chunks }
    : null;

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

    setMessage("");

    try {
      if (latestSavePromiseRef.current) {
        await latestSavePromiseRef.current;
      }
      if (documentParagraphsRef.current.every((paragraph) => !paragraph.content.trim())) {
        setMessage("当前文件没有可翻译的段落");
        return;
      }

      const job = await createTranslationJob(sourceDocument.id, {
        direction,
        granularity,
        options,
        glossary: glossary.length > 0 ? glossary : undefined,
        ai_config: aiConfig,
      });
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
    } catch {
      setMessage("翻译失败，请检查后端服务或模型配置");
      window.setTimeout(() => setMessage(""), 2200);
    }
  };

  const copyTranslation = async () => {
    if (!targetText) return;
    await navigator.clipboard.writeText(targetText);
    setMessage("译文已复制");
    window.setTimeout(() => setMessage(""), 1600);
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
        title: `${baseTitle}_翻译_${saveModeFileNames[saveMode]}`,
        content,
        glossary,
        language: documentLanguage === "zh" ? "en" : "zh",
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
  const saveModeFileNames: Record<TranslationSaveMode, string> = {
    "target-only": "仅译文",
    "paragraph-source-target": "分段原文译文",
    "paragraph-target-source": "分段译文原文",
    "sentence-source-target": "逐句原文译文",
    "sentence-target-source": "逐句译文原文",
  };

  return (
    <section className="page translate-page">
      <div className="mode-bar">
        <div className="translation-direction-lock">
          <span className={`document-language-badge ${documentLanguage}`}>{documentLanguage === "zh" ? "中文" : "英文"}</span>
          <strong>{direction === "zh-en" ? "中译英" : "英译中"}</strong>
        </div>
        <div className="segmented">
          <button className={granularity === "paragraph" ? "selected" : ""} onClick={() => setGranularity("paragraph")} type="button">
            段段翻译
          </button>
          <button className={granularity === "sentence" ? "selected" : ""} onClick={() => setGranularity("sentence")} type="button">
            句句翻译
          </button>
        </div>
        <button className="primary-action" disabled={isLoading} onClick={runTranslation} type="button">
          {isLoading ? <Loader2 className="spin" size={18} /> : <Languages size={18} />}
          {isLoading && progress ? `翻译中 ${progress.current}/${Math.max(progress.total, 1)}` : "开始翻译"}
        </button>
        <div className="segmented">
          <button className={displayMode === "split" ? "selected" : ""} onClick={() => setDisplayMode("split")} type="button">
            分屏对照
          </button>
          <button className={displayMode === "paragraph" ? "selected" : ""} onClick={() => setDisplayMode("paragraph")} type="button">
            交替对照
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
                <div className="translation-header-actions">
                  <span className={`document-language-badge ${documentLanguage}`}>{documentLanguage === "zh" ? "中文" : "英文"}</span>
                  {sourceSaveState === "saving" && <span className="source-save-indicator"><Loader2 className="spin" size={14} />保存中</span>}
                  {sourceSaveState === "saved" && <span className="source-save-indicator saved"><CheckCircle2 size={14} />已保存</span>}
                  {sourceSaveState === "failed" && (
                    <button className="source-save-indicator failed" onClick={() => setSaveRetry((value) => value + 1)} type="button">
                      <AlertCircle size={14} />保存失败，重试
                    </button>
                  )}
                  <button className="inline-action" onClick={() => setEditingSource((current) => !current)} type="button">
                    <Edit3 size={15} />
                    {editingSource ? "完成" : "编辑"}
                  </button>
                </div>
              </div>
              {editingSource ? (
                <textarea
                  className="translation-input"
                  onChange={(event) => {
                    setSourceText(event.target.value);
                    setSourceSaveState("idle");
                  }}
                  value={sourceText}
                />
              ) : (
                <div className="translation-unit-list">
                  {pairs.map((pair, index) => (
                    <div className="translation-unit" key={`source-${pair.paragraph_id}-${pair.sentence_index ?? index}`}>
                      <span>{granularity === "sentence" ? `句 ${index + 1}` : `段 ${index + 1}`}</span>
                      <p>{pair.source}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel text-panel">
              <div className="panel-header">
                <h2>{targetTitle}</h2>
                <div className="translation-header-actions">
                  {result && <span className="translation-result-direction">结果：{resultDirectionLabel}</span>}
                  {result?.isStale && <span className="translation-result-stale">原文已更新</span>}
                  <button className="inline-action" onClick={copyTranslation} type="button">
                    <Copy size={15} />
                    复制
                  </button>
                </div>
              </div>
              <div className="translation-unit-list">
                {pairs.map((pair, index) => (
                  <div className="translation-unit" key={`target-${pair.paragraph_id}-${pair.sentence_index ?? index}`}>
                    <span>{granularity === "sentence" ? `句 ${index + 1}` : `段 ${index + 1}`}</span>
                    <p className={!pair.target ? "translation-placeholder" : ""}>{pair.target || (isLoading ? "等待翻译..." : "尚未翻译")}</p>
                  </div>
                ))}
              </div>
            </article>
          </>
        )}

        {displayMode === "paragraph" && (
          <article className="panel compare-panel">
            <div className="panel-header">
              <h2>{granularity === "paragraph" ? "段段翻译" : "句句翻译"}</h2>
              <div className="translation-header-actions">
                {result && <span className="translation-result-direction">结果：{resultDirectionLabel}</span>}
                {result?.isStale && <span className="translation-result-stale">原文已更新</span>}
                <button className="inline-action" onClick={copyTranslation} type="button">
                  <Copy size={15} />
                  复制译文
                </button>
              </div>
            </div>
            <div className="compare-list">
              {pairs.map((pair, index) => (
                <div className="compare-row" key={`${pair.source}-${index}`}>
                  <div>
                    <span>原文 {index + 1}</span>
                    <p>{pair.source}</p>
                  </div>
                  <div>
                    <span>译文 {index + 1}</span>
                    <p className={!pair.target ? "translation-placeholder" : ""}>{pair.target || (isLoading ? "等待翻译..." : "尚未翻译")}</p>
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
