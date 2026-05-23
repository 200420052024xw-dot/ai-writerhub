import { useMemo, useState } from "react";
import { ClipboardCheck, Copy, Download, Languages, Loader2, Settings } from "lucide-react";
import {
  translateText,
  type TranslationDirection,
  type TranslationDisplayMode,
  type TranslationOptions,
  type TranslationPair,
  type TranslationResponse,
} from "../services/api";

const initialSource = `# 1. 项目背景
文枢 AI WriterHub 是一款面向开发者与内容创作者的智能文本编辑器，集成 AI 能力，提升写作、编辑与协作效率。

# 2. 核心功能
Markdown 实时编辑与预览。AI 智能写作辅助与改写。多语言翻译与润色。格式整理与一键美化。`;

const optionLabels: Array<[keyof TranslationOptions, string]> = [
  ["academic_style", "学术风格"],
  ["business_style", "商务风格"],
  ["natural_tone", "口语自然"],
  ["unified_terms", "术语统一"],
  ["preserve_names", "保留专有名词"],
];

const defaultOptions: TranslationOptions = {
  academic_style: true,
  business_style: true,
  natural_tone: true,
  unified_terms: true,
  preserve_names: true,
};

export function TranslatePage() {
  const [sourceText, setSourceText] = useState(initialSource);
  const [direction, setDirection] = useState<TranslationDirection>("zh-en");
  const [displayMode, setDisplayMode] = useState<TranslationDisplayMode>("split");
  const [options, setOptions] = useState<TranslationOptions>(defaultOptions);
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const targetText = result?.target_text ?? "";
  const sourceTitle = direction === "zh-en" ? "中文原文" : "English Source";
  const targetTitle = direction === "zh-en" ? "English Translation" : "中文译文";

  const pairs: TranslationPair[] = useMemo(() => {
    if (!result) return [];
    return displayMode === "sentence" ? result.sentence_pairs : result.paragraph_pairs;
  }, [displayMode, result]);

  const runTranslation = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await translateText({
        source_text: sourceText,
        direction,
        display_mode: displayMode,
        options,
      });
      setResult(response);
    } catch {
      setMessage("翻译失败，请检查后端服务或模型配置");
    } finally {
      setIsLoading(false);
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
                {targetText || "点击“开始翻译”后，译文会显示在这里。"}
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
              {(pairs.length ? pairs : [{ source: sourceText, target: "点击“开始翻译”后，结果会显示在这里。" }]).map((pair, index) => (
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
          {optionLabels.map(([key, label]) => (
            <label className="check-row" key={key}>
              <span>
                <ClipboardCheck size={17} />
                {label}
              </span>
              <input
                checked={options[key]}
                onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))}
                type="checkbox"
              />
            </label>
          ))}
          <div className="term-box">
            <strong>术语表 / 记忆库</strong>
            <p>产品需求文档 → PRD</p>
            <p>用户体验 → User Experience</p>
            <p>实时预览 → Real-time Preview</p>
          </div>
          <button className="assist-action" onClick={copyTranslation} type="button">
            <Download size={16} />
            导出译文
          </button>
        </aside>
      </div>
    </section>
  );
}
