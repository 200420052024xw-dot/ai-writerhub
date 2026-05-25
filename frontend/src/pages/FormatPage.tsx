import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, FileText, Sparkles } from "lucide-react";
import { exportFormatDocx, parseFormatPrompt, type FormatDocumentBlock } from "../services/api";
import { loadModelSettings } from "../services/modelSettings";

type FormatConfig = {
  font: string;
  fontSize: string;
  lineHeight: string;
  indent: string;
  align: string;
  paperSize: string;
  headingStyle: string;
  margin: string;
  header: string;
  footer: string;
  extraRequirements: string;
};

const defaultFormatConfig: FormatConfig = {
  fontSize: "小四（12pt）",
  font: "宋体（SimSun）",
  margin: "普通：上/下 2.54cm，左/右 3.18cm",
  lineHeight: "1.5 倍行距",
  indent: "首行缩进 2 字符",
  align: "两端对齐",
  paperSize: "A4（21 × 29.7cm）",
  headingStyle: "",
  header: "",
  footer: "",
  extraRequirements: "",
};

const fontOptions = ["宋体（SimSun）", "微软雅黑", "黑体", "仿宋", "楷体"];
const fontSizeOptions = [
  "五号（10.5pt）",
  "小四（12pt）",
  "六号（7.5pt）",
  "小六（6.5pt）",
  "七号（5.5pt）",
  "八号（5pt）",
  "5",
  "5.5",
  "6.5",
  "7.5",
  "8",
  "9",
  "10",
  "10.5",
  "11",
  "12",
  "14",
  "16",
];
const lineHeightOptions = ["单倍行距", "1.25 倍行距", "1.5 倍行距", "2 倍行距"];
const indentOptions = ["无缩进", "首行缩进 2 字符", "左缩进 2 字符", "悬挂缩进 2 字符"];
const alignOptions = ["左对齐", "居中对齐", "右对齐", "两端对齐"];
const paperSizeOptions = ["A4（21 × 29.7cm）", "A5（14.8 × 21cm）", "B5（17.6 × 25cm）", "Letter（21.6 × 27.9cm）"];

const sampleDocument = {
  title: "文枢 AI WriterHub 产品需求文档",
  blocks: [
    { type: "heading1", text: "1. 项目背景" },
    { type: "paragraph", text: "文枢 AI WriterHub 是一款面向开发者与内容创作者的智能文档编辑器，集成 AI 能力，提升写作、编辑与协作效率。" },
    { type: "heading1", text: "2. 核心功能" },
    { type: "heading2", text: "2.1 Markdown 实时编辑与预览" },
    { type: "bullet", text: "AI 智能写作辅助与改写" },
    { type: "bullet", text: "多语言翻译与润色" },
    { type: "heading2", text: "2.2 格式整理与一键美化" },
    { type: "bullet", text: "导出为多种格式" },
    { type: "bullet", text: "模板与样式库，提升文档专业度" },
  ] satisfies FormatDocumentBlock[],
};

export type FormatSourceDocument = {
  id?: string;
  title: string;
  content: string;
};

function contentToBlocks(content: string): FormatDocumentBlock[] {
  const blocks: FormatDocumentBlock[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,2}\s+/.test(trimmed)) {
      blocks.push({ type: "heading1", text: trimmed.replace(/^#{1,2}\s+/, "") });
    } else if (/^#{3,6}\s+/.test(trimmed)) {
      blocks.push({ type: "heading2", text: trimmed.replace(/^#{3,6}\s+/, "") });
    } else if (/^[-*+]\s+/.test(trimmed)) {
      blocks.push({ type: "bullet", text: trimmed.replace(/^[-*+]\s+/, "") });
    } else {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }
  return blocks;
}

function parseFontSizePx(value: string) {
  if (value.includes("小四") || value.includes("12")) return 16;
  if (value.includes("五号") || value.includes("10.5")) return 14;
  if (value.includes("四号") || value.includes("14")) return 18;
  if (value.includes("三号") || value.includes("16")) return 21;
  if (value.includes("六号") || value.includes("7.5")) return 12;
  return 16;
}

function lineHeightValue(value: string) {
  if (value.includes("2")) return 2;
  if (value.includes("1.25")) return 1.25;
  if (value.includes("1.5")) return 1.5;
  return 1.65;
}

function alignValue(value: string): CSSProperties["textAlign"] {
  if (value.includes("居中")) return "center";
  if (value.includes("右")) return "right";
  if (value.includes("两端")) return "justify";
  return "left";
}

function paperSizeStyle(value: string): CSSProperties {
  if (value.includes("A5")) return { maxWidth: 430 };
  if (value.includes("B5")) return { maxWidth: 500 };
  if (value.includes("Letter")) return { maxWidth: 540 };
  return { maxWidth: 560 };
}

export function FormatPage({ sourceDocument }: { sourceDocument?: FormatSourceDocument | null }) {
  const [config, setConfig] = useState<FormatConfig>(defaultFormatConfig);
  const [exportOpen, setExportOpen] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formatPrompt, setFormatPrompt] = useState("");
  const [appliedConfig, setAppliedConfig] = useState<FormatConfig>(defaultFormatConfig);
  const [message, setMessage] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);
  const activeDocument = sourceDocument
    ? {
        title: sourceDocument.title?.trim() || "无标题文档",
        blocks: contentToBlocks(sourceDocument.content),
      }
    : { title: "未选择文件", blocks: [] };

  const updateConfig = (key: keyof FormatConfig, value: string) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const showMessage = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2200);
  };

  const runParse = async () => {
    const prompt = formatPrompt.trim();
    if (!prompt) {
      showMessage("请先输入格式需求");
      return;
    }

    const settings = loadModelSettings();
    if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.defaultModel.trim()) {
      showMessage("请先在设置页配置模型");
      return;
    }

    setParsing(true);
    try {
      const result = await parseFormatPrompt({
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model: settings.defaultModel,
        prompt,
        current_config: config,
      });
      setConfig(result.config);
      showMessage("已解析格式需求");
    } catch {
      showMessage("智能解析失败");
    } finally {
      setParsing(false);
    }
  };

  const startOrganizing = () => {
    setOrganizing(true);
    window.setTimeout(() => {
      setAppliedConfig(config);
      setOrganizing(false);
      showMessage("已整理预览");
    }, 500);
  };

  const downloadDocx = async () => {
    setExporting(true);
    try {
      const blob = await exportFormatDocx({
        title: activeDocument.title,
        blocks: activeDocument.blocks,
        config: appliedConfig,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "文档格式整理.docx";
      link.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch {
      showMessage("Word 导出失败");
    } finally {
      setExporting(false);
    }
  };

  const printPdf = () => {
    setExportOpen(false);
    window.print();
  };

  useEffect(() => {
    if (!exportOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!exportRef.current?.contains(target)) {
        setExportOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [exportOpen]);

  const previewStyle: CSSProperties = {
    ...paperSizeStyle(appliedConfig.paperSize),
    fontFamily: appliedConfig.font || undefined,
    fontSize: parseFontSizePx(appliedConfig.fontSize),
    lineHeight: lineHeightValue(appliedConfig.lineHeight),
    textAlign: alignValue(appliedConfig.align),
  };

  const paragraphStyle: CSSProperties = {
    textIndent: appliedConfig.indent.includes("首行") ? "2em" : undefined,
  };

  return (
    <section className="page format-page">
      {message && <div className="copy-toast done">{message}</div>}
      <div className="format-layout">
        <article className="panel format-config">
          <div className="format-config-header">
            <div>
              <h2>文档格式整理</h2>
              <p>设置全文格式，预览确认后开始整理。</p>
            </div>
          </div>

          <div className="format-prompt-panel">
            <label className="instruction-box">
              <textarea
                maxLength={300}
                onChange={(event) => setFormatPrompt(event.target.value)}
                placeholder="用一句话描述你想要的格式效果"
                value={formatPrompt}
              />
              <span className="format-prompt-count">{formatPrompt.length} / 300</span>
            </label>
            <div className="format-prompt-actions">
              <button className="primary-action" disabled={parsing} onClick={() => void runParse()} type="button">
                <Sparkles size={18} />
                {parsing ? "解析中..." : "智能解析"}
              </button>
            </div>
          </div>

          <div className="format-config-section">
            <h3>格式配置</h3>
            <div className="format-field-grid">
              <label className="format-field">
                <span>字体</span>
                <select value={config.font} onChange={(event) => updateConfig("font", event.target.value)}>
                  {fontOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="format-field">
                <span>字号</span>
                <input
                  list="fontSize-options"
                  value={config.fontSize}
                  onChange={(event) => updateConfig("fontSize", event.target.value)}
                />
                <datalist id="fontSize-options">
                  {fontSizeOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>
              <label className="format-field">
                <span>行间距</span>
                <select value={config.lineHeight} onChange={(event) => updateConfig("lineHeight", event.target.value)}>
                  {lineHeightOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="format-field">
                <span>段落缩进</span>
                <select value={config.indent} onChange={(event) => updateConfig("indent", event.target.value)}>
                  {indentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="format-field">
                <span>对齐方式</span>
                <select value={config.align} onChange={(event) => updateConfig("align", event.target.value)}>
                  {alignOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="format-field">
                <span>纸张大小</span>
                <select value={config.paperSize} onChange={(event) => updateConfig("paperSize", event.target.value)}>
                  {paperSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="format-field">
                <span>标题样式</span>
                <input placeholder="可不填" value={config.headingStyle} onChange={(event) => updateConfig("headingStyle", event.target.value)} />
              </label>
              <label className="format-field">
                <span>页眉</span>
                <input placeholder="可不填" value={config.header} onChange={(event) => updateConfig("header", event.target.value)} />
              </label>
              <label className="format-field">
                <span>页脚</span>
                <input placeholder="可不填" value={config.footer} onChange={(event) => updateConfig("footer", event.target.value)} />
              </label>
              <label className="format-field format-field-wide">
                <span>其余要求</span>
                <textarea
                  placeholder="可不填"
                  value={config.extraRequirements}
                  onChange={(event) => updateConfig("extraRequirements", event.target.value)}
                />
              </label>
            </div>
          </div>
          <button className="start-format-action" disabled={organizing} onClick={startOrganizing} type="button">
            {organizing ? "正在整理..." : "开始整理"}
          </button>
        </article>

        <article className="panel paper-preview">
          <div className="paper-toolbar">
            <div className="paper-pager">
              <button type="button">‹</button>
              <strong>1 / 24</strong>
              <button type="button">›</button>
              <span>100%</span>
            </div>
            <div className="preview-export" ref={exportRef}>
              <button className="preview-export-trigger" onClick={() => setExportOpen((open) => !open)} type="button">
                <FileText size={16} />
                {exporting ? "导出中" : "导出"}
                <ChevronDown size={14} />
              </button>
              {exportOpen && (
                <div className="preview-export-menu">
                  <button onClick={() => void downloadDocx()} type="button">导出 Word</button>
                  <button onClick={printPdf} type="button">导出 PDF</button>
                </div>
              )}
            </div>
          </div>
          <div className="paper" style={previewStyle}>
            <header>
              <span>{appliedConfig.header || "产品需求文档"}</span>
              <span>文枢 AI WriterHub</span>
            </header>
            <h1>{activeDocument.title}</h1>
            {activeDocument.blocks.map((block, index) => {
              if (block.type === "heading1") return <h2 key={index}>{block.text}</h2>;
              if (block.type === "heading2") return <h3 key={index}>{block.text}</h3>;
              if (block.type === "bullet") return <li key={index}>{block.text}</li>;
              return <p key={index} style={paragraphStyle}>{block.text}</p>;
            })}
            <footer>{appliedConfig.footer || "第 1 页 / 共 24 页"}</footer>
          </div>
        </article>
      </div>
    </section>
  );
}
