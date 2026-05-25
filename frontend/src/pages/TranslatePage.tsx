import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Copy, Download, Edit3, Languages, Loader2, Settings, Sparkles, Trash2, X } from "lucide-react";
import {
  extractTerms,
  translateTextStream,
  type ExtractTermsResponse,
  type GlossaryEntry,
  type TranslationChunk,
  type TranslationDirection,
  type TranslationDisplayMode,
  type TranslationOptions,
  type TranslationPair,
  type TranslationStyle,
  type TranslationStreamEvent,
} from "../services/api";
import { loadModelSettings } from "../services/modelSettings";

const initialSource = `# 1. 项目背景
文枢 AI WriterHub 是一款面向开发者与内容创作者的智能文本编辑器，集成 AI 能力，提升写作、编辑与协作效率。

# 2. 核心功能
Markdown 实时编辑与预览。AI 智能写作辅助与改写。多语言翻译与润色。格式整理与一键美化。`;

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
};

function renderSourceText(document?: { title?: string; content: string } | null) {
  if (!document) return initialSource;
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

export function TranslatePage({ sourceDocument }: { sourceDocument?: { id?: string; title?: string; content: string } | null }) {
  const [sourceText, setSourceText] = useState(initialSource);
  const [direction, setDirection] = useState<TranslationDirection>("zh-en");
  const [displayMode, setDisplayMode] = useState<TranslationDisplayMode>("split");
  const [options, setOptions] = useState<TranslationOptions>(defaultOptions);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const [glossary, setGlossary] = useState<GlossaryEntry[]>(loadGlossary);
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [enableCustomRequirements, setEnableCustomRequirements] = useState(false);

  useEffect(() => {
    if (!sourceDocument?.id) return;
    setSourceText(renderSourceText(sourceDocument));
    setResult(null);
  }, [sourceDocument?.id, sourceDocument?.title, sourceDocument?.content]);

  useEffect(() => {
    saveGlossaryToStorage(glossary);
  }, [glossary]);

  const targetText = result?.target_text ?? "";
  const sourceTitle = direction === "zh-en" ? "中文原文" : "English Source";
  const targetTitle = direction === "zh-en" ? "English Translation" : "中文译文";
  const modelSettings = loadModelSettings();
  const aiConfig = {
    api_key: modelSettings.apiKey,
    base_url: modelSettings.baseUrl,
    model: modelSettings.defaultModel,
  };

  const pairs: TranslationPair[] = useMemo(() => {
    if (!result) return [];
    if (result.paragraph_pairs.length > 0) return displayMode === "sentence" ? result.sentence_pairs : result.paragraph_pairs;
    return result.chunks.map((c) => ({ source: c.source, target: c.target }));
  }, [displayMode, result]);

  const runTranslation = async () => {
    setIsLoading(true);
    setMessage("");
    setProgress(null);
    setResult(null);

    try {
      let totalChunks = 0;
      const chunks: TranslationChunk[] = [];
      let contextSummary = "";
      let usedContext = false;

      await translateTextStream(
        {
          source_text: sourceText,
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
              chunks.push({ index: event.index, source: event.source, target: event.target });
              setProgress({ current: chunks.length, total: totalChunks });
              setResult({
                target_text: chunks.map((c) => c.target).join("\n\n"),
                context_summary: contextSummary,
                used_context_summary: usedContext,
                chunks: [...chunks],
                paragraph_pairs: [],
                sentence_pairs: [],
              });
              break;
            case "complete":
              setResult({
                target_text: event.target_text,
                context_summary: event.context_summary,
                used_context_summary: usedContext,
                chunks: event.chunks,
                paragraph_pairs: [],
                sentence_pairs: [],
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
    setDirection(nextDirection);
    setResult(null);
  };

  const runExtractTerms = async () => {
    if (!sourceText.trim()) return;
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

  const previewLimit = 5;
  const glossaryPreview = glossary.slice(0, previewLimit);
  const hasMore = glossary.length > previewLimit;

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
              <textarea className="translation-input" onChange={(event) => setSourceText(event.target.value)} value={sourceText} />
            </article>

            <article className="panel text-panel">
              <div className="panel-header">
                <h2>{targetTitle}</h2>
                <button className="inline-action" onClick={copyTranslation} type="button">
                  <Copy size={15} />
                  复制
                </button>
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
              <button className="inline-action" onClick={copyTranslation} type="button">
                <Copy size={15} />
                复制译文
              </button>
            </div>
            <div className="compare-list">
              {(pairs.length ? pairs : [{ source: sourceText, target: '点击"开始翻译"后，结果会显示在这里。' }]).map((pair, index) => (
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
            <Settings size={20} />
            <h2>翻译设置</h2>
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
                  <p key={`${entry.source}-${index}`}>
                    {entry.source} → {entry.target}
                  </p>
                ))}
                {hasMore && <p className="term-more">还有 {glossary.length - previewLimit} 条...</p>}
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
                    <input
                      placeholder="原文术语"
                      value={entry.source}
                      onChange={(event) => updateGlossaryEntry(index, "source", event.target.value)}
                    />
                    <span className="glossary-arrow">→</span>
                    <input
                      placeholder="译文术语"
                      value={entry.target}
                      onChange={(event) => updateGlossaryEntry(index, "target", event.target.value)}
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
