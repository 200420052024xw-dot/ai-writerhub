import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, FileText, Sparkles } from "lucide-react";
import { exportFormatDocx, parseFormatPrompt, type FormatConfig, type FormatDocumentParagraph, type StoredDocumentParagraph } from "../services/api";
import { loadModelSettings } from "../services/modelSettings";

const defaultFormatConfig: FormatConfig = {
  bodyFont: "宋体（SimSun）",
  bodyFontSize: "小四（12pt）",
  bodyBold: false,
  lineHeight: "1.5 倍行距",
  indent: "首行缩进 2 字符",
  align: "两端对齐",
  titleFont: "黑体",
  titleFontSize: "三号（16pt）",
  titleBold: true,
  h1Font: "黑体",
  h1FontSize: "三号（16pt）",
  h1Bold: true,
  h2Font: "黑体",
  h2FontSize: "四号（14pt）",
  h2Bold: true,
  h3Font: "黑体",
  h3FontSize: "小四（12pt）",
  h3Bold: true,
  paperSize: "A4（21 × 29.7cm）",
  orientation: "纵向",
  margin: "普通：上/下 2.54cm，左/右 3.18cm",
  header: "",
  footer: "",
  extraRequirements: "",
};

const fontOptions = ["宋体（SimSun）", "微软雅黑", "黑体", "仿宋", "楷体"];
const fontSizeOptions = [
  "初号（42pt）", "小初（36pt）", "一号（26pt）", "小一（24pt）",
  "二号（22pt）", "小二（18pt）", "三号（16pt）", "小三（15pt）",
  "四号（14pt）", "小四（12pt）", "五号（10.5pt）", "小五（9pt）",
  "六号（7.5pt）", "小六（6.5pt）", "七号（5.5pt）", "八号（5pt）",
];
const lineHeightOptions = ["单倍行距", "1.25 倍行距", "1.5 倍行距", "2 倍行距"];
const indentOptions = ["无缩进", "首行缩进 2 字符", "左缩进 2 字符", "悬挂缩进 2 字符"];
const alignOptions = ["左对齐", "居中对齐", "右对齐", "两端对齐"];
const paperSizeOptions = ["A4（21 × 29.7cm）", "A5（14.8 × 21cm）", "B5（17.6 × 25cm）", "Letter（21.6 × 27.9cm）"];
const orientationOptions = ["纵向", "横向"];
const marginOptions = ["普通：上/下 2.54cm，左/右 3.18cm", "窄边距：上/下/左/右 1.27cm"];

export type FormatSourceDocument = {
  id?: string;
  title: string;
  content: string;
  paragraphs?: StoredDocumentParagraph[];
};

function storedParagraphsToFormatParagraphs(paragraphs?: StoredDocumentParagraph[]): FormatDocumentParagraph[] {
  if (!paragraphs?.length) return [];
  return paragraphs.map((paragraph) => ({
    paragraph_id: paragraph.id,
    type: paragraph.type,
    level: paragraph.level,
    content: paragraph.content,
  }));
}

function parseFontSizePx(value: string) {
  const m = value.match(/([\d.]+)\s*pt/);
  if (m) return Math.round(parseFloat(m[1]) * 4 / 3);
  if (value.includes("初号")) return 56;
  if (value.includes("小初")) return 48;
  if (value.includes("小一")) return 32;
  if (value.includes("一号")) return 35;
  if (value.includes("小二")) return 24;
  if (value.includes("二号")) return 29;
  if (value.includes("小三")) return 20;
  if (value.includes("三号")) return 21;
  if (value.includes("小四")) return 16;
  if (value.includes("四号")) return 19;
  if (value.includes("小五")) return 12;
  if (value.includes("五号")) return 14;
  if (value.includes("六号")) return 10;
  if (value.includes("小六")) return 9;
  if (value.includes("七号")) return 7;
  if (value.includes("八号")) return 7;
  return 16;
}

function SelectUp({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="select-up" ref={ref}>
      <button className="select-up-trigger" onClick={() => setOpen(!open)} type="button">
        <span className={value ? "" : "select-up-placeholder"}>{value || placeholder || "未设置"}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="select-up-menu">
          {placeholder && (
            <button className={value === "" ? "active" : ""} onClick={() => { onChange(""); setOpen(false); }} type="button">{placeholder}</button>
          )}
          {options.map((o) => (
            <button key={o} className={value === o ? "active" : ""} onClick={() => { onChange(o); setOpen(false); }} type="button">{o}</button>
          ))}
        </div>
      )}
    </div>
  );
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

function paperSizeStyle(value: string, orientation: string): CSSProperties {
  let w: number, h: number;
  if (value.includes("A5")) { w = 470; h = 665; }
  else if (value.includes("B5")) { w = 550; h = 778; }
  else if (value.includes("Letter")) { w = 600; h = 851; }
  else { w = 620; h = 877; }
  if (orientation.includes("横")) return { width: h, height: w };
  return { width: w, height: h };
}

/* 与后端 Word 标准边距一致：普通 2.54cm/3.18cm，窄 1.27cm */
const MARGIN_NORMAL = { top: 72, bottom: 72, left: 90, right: 90 };
const MARGIN_NARROW = { top: 36, bottom: 36, left: 36, right: 36 };

function marginPadding(value: string): CSSProperties {
  if (value.includes("窄")) return { padding: `${MARGIN_NARROW.top}px ${MARGIN_NARROW.right}px ${MARGIN_NARROW.bottom}px ${MARGIN_NARROW.left}px` };
  return { padding: `${MARGIN_NORMAL.top}px ${MARGIN_NORMAL.right}px ${MARGIN_NORMAL.bottom}px ${MARGIN_NORMAL.left}px` };
}

export function FormatPage({ sourceDocument }: { sourceDocument?: FormatSourceDocument | null }) {
  const [config, setConfig] = useState<FormatConfig>(defaultFormatConfig);
  const [exportOpen, setExportOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [formatPrompt, setFormatPrompt] = useState("");
  const [editedParagraphs, setEditedParagraphs] = useState<FormatDocumentParagraph[] | null>(null);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ type: string; level: number; content: string }>({ type: "paragraph", level: 0, content: "" });
  const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic");
  const [headingTab, setHeadingTab] = useState<"title" | "h1" | "h2" | "h3">("title");
  const measureRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [elementHeights, setElementHeights] = useState<number[]>([]);

  const activeDocument = useMemo(() => sourceDocument
    ? { title: sourceDocument.title?.trim() || "无标题文档", paragraphs: storedParagraphsToFormatParagraphs(sourceDocument.paragraphs) }
    : { title: "未选择文件", paragraphs: [] }, [sourceDocument]);
  const displayedParagraphs = useMemo(() => editedParagraphs ?? activeDocument.paragraphs, [editedParagraphs, activeDocument.paragraphs]);
  const displayedTitle = displayedParagraphs.find((p) => p.type === "title")?.content.trim() || activeDocument.title;

  const updateConfig = (key: keyof FormatConfig, value: string | boolean) => setConfig((c) => ({ ...c, [key]: value }));
  const showMessage = (v: string) => { setMessage(v); window.setTimeout(() => setMessage(""), 2200); };

  const startEdit = (p: FormatDocumentParagraph) => { setEditingId(p.paragraph_id); setEditDraft({ type: p.type, level: p.level, content: p.content }); };
  const saveEdit = () => {
    if (!editingId) return;
    setEditedParagraphs(displayedParagraphs.map((p) => p.paragraph_id === editingId ? { ...p, type: editDraft.type as FormatDocumentParagraph["type"], level: editDraft.level, content: editDraft.content } : p));
    setDocxBlob(null);
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  const runParse = async () => {
    const prompt = formatPrompt.trim();
    if (!prompt) { showMessage("请先输入格式需求"); return; }
    const s = loadModelSettings();
    const ready = s.useSystemModel ? (s.baseUrl.trim() && s.defaultModel.trim()) : (s.apiKey.trim() && s.baseUrl.trim() && s.defaultModel.trim());
    if (!ready) { showMessage("请先在设置页配置模型"); return; }
    setParsing(true);
    try { const r = await parseFormatPrompt({ api_key: s.apiKey, base_url: s.baseUrl, model: s.defaultModel, use_system_model: s.useSystemModel || undefined, prompt, current_config: config }); setConfig(r.config); showMessage("已解析格式需求"); } catch { showMessage("智能解析失败"); } finally { setParsing(false); }
  };

  const startGenerating = async () => {
    if (!displayedParagraphs.length) { showMessage("请先选择文档"); return; }
    setGenerating(true);
    setDocxBlob(null);
    try {
      const blob = await exportFormatDocx({ title: displayedTitle, paragraphs: displayedParagraphs, config });
      setDocxBlob(blob);
      showMessage("生成完成，可导出");
    } catch { showMessage("生成失败，请重试"); } finally { setGenerating(false); }
  };

  const downloadDocx = () => {
    if (!docxBlob) { showMessage("请先点击生成文档"); return; }
    const u = URL.createObjectURL(docxBlob);
    const a = document.createElement("a"); a.href = u; a.download = `${displayedTitle}.docx`; a.click();
    URL.revokeObjectURL(u);
    setExportOpen(false);
  };
  const printPdf = () => { setExportOpen(false); window.print(); };

  useEffect(() => { setEditedParagraphs(null); setDocxBlob(null); }, [sourceDocument?.id]);

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const children = measureRef.current.children;
    const heights: number[] = [];
    for (let i = 0; i < children.length; i++) {
      heights.push((children[i] as HTMLElement).offsetHeight);
    }
    setElementHeights(heights);
  }, [displayedParagraphs, config, editingId, containerWidth]);

  useEffect(() => {
    if (!exportOpen) return;
    const h = (e: MouseEvent) => { if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [exportOpen]);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => { setContainerWidth(entries[0].contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isNarrow = config.margin.includes("窄");
  const m = isNarrow ? MARGIN_NARROW : MARGIN_NORMAL;
  const previewStyle: CSSProperties = {
    ...paperSizeStyle(config.paperSize, config.orientation),
    ...marginPadding(config.margin),
    lineHeight: lineHeightValue(config.lineHeight),
    textAlign: alignValue(config.align),
    "--crop-top": `${m.top}px`, "--crop-bottom": `${m.bottom}px`,
    "--crop-left": `${m.left}px`, "--crop-right": `${m.right}px`,
  } as CSSProperties;
  const paperW = (previewStyle.width as number) || 620;
  const paperH = (previewStyle.height as number) || 877;
  const scale = containerWidth > 0 ? Math.min(1, (containerWidth - 48) / paperW) : 1;
  const bodyTextStyle: CSSProperties = { fontFamily: config.bodyFont || undefined, fontSize: parseFontSizePx(config.bodyFontSize), fontWeight: config.bodyBold ? "bold" : undefined };
  const paragraphStyle: CSSProperties = { ...bodyTextStyle, textIndent: config.indent.includes("首行") ? "2em" : undefined };
  const titleStyle: CSSProperties = { fontFamily: config.titleFont || undefined, fontSize: parseFontSizePx(config.titleFontSize), fontWeight: config.titleBold ? "bold" : "normal", margin: "0 0 28px", textAlign: "center" as const };
  const headingStyle = (level: number): CSSProperties => {
    const prefix = level <= 1 ? "h1" : level === 2 ? "h2" : "h3";
    const font = config[`${prefix}Font` as keyof FormatConfig] as string || undefined;
    const size = parseFontSizePx(config[`${prefix}FontSize` as keyof FormatConfig] as string);
    const bold = config[`${prefix}Bold` as keyof FormatConfig] as boolean;
    return { fontFamily: font, fontSize: size, fontWeight: bold ? "bold" : "normal" };
  };

  const headingPrefix = headingTab === "title" ? "title" : headingTab;
  const headingFontKey = `${headingPrefix}Font` as keyof FormatConfig;
  const headingSizeKey = `${headingPrefix}FontSize` as keyof FormatConfig;
  const headingBoldKey = `${headingPrefix}Bold` as keyof FormatConfig;

  return (
    <section className="page format-page">
      {message && <div className="copy-toast done">{message}</div>}
      <div className="format-layout">
        <article className="panel format-config">
          <div className="format-config-header"><div><h2>文档格式整理</h2><p>设置全文格式，预览确认后开始整理。</p></div></div>

          <div className="format-prompt-panel">
            <label className="instruction-box">
              <textarea maxLength={300} onChange={(e) => setFormatPrompt(e.target.value)} placeholder="用一句话描述你想要的格式效果" value={formatPrompt} />
              <span className="format-prompt-count">{formatPrompt.length} / 300</span>
            </label>
            <div className="format-prompt-actions">
              <button className="primary-action" disabled={parsing} onClick={() => void runParse()} type="button"><Sparkles size={18} />{parsing ? "解析中..." : "智能解析"}</button>
            </div>
          </div>

          <div className="format-config-section">
            <div className="format-tab-bar">
              <button className={activeTab === "basic" ? "format-tab active" : "format-tab"} onClick={() => setActiveTab("basic")} type="button">基础设置</button>
              <button className={activeTab === "advanced" ? "format-tab active" : "format-tab"} onClick={() => setActiveTab("advanced")} type="button">高级设置</button>
            </div>

            {activeTab === "basic" && (
              <div className="format-tab-content">
                <div className="format-group-box">
                  <h4>正文</h4>
                  <div className="format-field-grid">
                    <label className="format-field"><span>字体</span><SelectUp value={config.bodyFont} options={fontOptions} placeholder="未设置" onChange={(v) => updateConfig("bodyFont", v)} /></label>
                    <label className="format-field"><span>字号</span><SelectUp value={config.bodyFontSize} options={fontSizeOptions} placeholder="未设置" onChange={(v) => updateConfig("bodyFontSize", v)} /></label>
                    <label className="format-field"><span>加粗</span><label className="format-toggle"><input type="checkbox" checked={config.bodyBold} onChange={(e) => updateConfig("bodyBold", e.target.checked)} /><span className="format-toggle-track" /><span className="format-toggle-label">{config.bodyBold ? "加粗" : "正常"}</span></label></label>
                  </div>
                </div>
                <div className="format-field-grid" style={{ marginTop: 8 }}>
                  <label className="format-field"><span>行间距</span><SelectUp value={config.lineHeight} options={lineHeightOptions} onChange={(v) => updateConfig("lineHeight", v)} /></label>
                  <label className="format-field"><span>段落缩进</span><SelectUp value={config.indent} options={indentOptions} onChange={(v) => updateConfig("indent", v)} /></label>
                  <label className="format-field"><span>对齐方式</span><SelectUp value={config.align} options={alignOptions} onChange={(v) => updateConfig("align", v)} /></label>
                </div>
              </div>
            )}

            {activeTab === "advanced" && (
              <div className="format-tab-content">
                <div className="format-tab-bar sub">
                  {([["title", "大标题"], ["h1", "1级标题"], ["h2", "2级标题"], ["h3", "3级标题"]] as const).map(([k, l]) => (
                    <button key={k} className={headingTab === k ? "format-tab active" : "format-tab"} onClick={() => setHeadingTab(k)} type="button">{l}</button>
                  ))}
                </div>
                <div className="format-group-box">
                  <div className="format-field-grid">
                    <label className="format-field"><span>字体</span><SelectUp value={config[headingFontKey] as string} options={fontOptions} placeholder="未设置" onChange={(v) => updateConfig(headingFontKey, v)} /></label>
                    <label className="format-field"><span>字号</span><SelectUp value={config[headingSizeKey] as string} options={fontSizeOptions} placeholder="未设置" onChange={(v) => updateConfig(headingSizeKey, v)} /></label>
                    <label className="format-field"><span>加粗</span><label className="format-toggle"><input type="checkbox" checked={config[headingBoldKey] as boolean} onChange={(e) => updateConfig(headingBoldKey, e.target.checked)} /><span className="format-toggle-track" /><span className="format-toggle-label">{config[headingBoldKey] ? "加粗" : "正常"}</span></label></label>
                  </div>
                </div>

                <div className="format-field-grid" style={{ marginTop: 10 }}>
                  <label className="format-field"><span>纸张大小</span><SelectUp value={config.paperSize} options={paperSizeOptions} onChange={(v) => updateConfig("paperSize", v)} /></label>
                  <label className="format-field"><span>纸张方向</span><SelectUp value={config.orientation} options={orientationOptions} onChange={(v) => updateConfig("orientation", v)} /></label>
                  <label className="format-field"><span>页边距</span><SelectUp value={config.margin} options={marginOptions} onChange={(v) => updateConfig("margin", v)} /></label>
                </div>
                <div className="format-field-grid" style={{ marginTop: 8, gridTemplateColumns: "1fr 1fr" }}>
                  <label className="format-field"><span>页眉</span><input className="format-input-ellipsis" placeholder="可不填" value={config.header} onChange={(e) => updateConfig("header", e.target.value)} /></label>
                  <label className="format-field"><span>页脚</span><input className="format-input-ellipsis" placeholder="可不填" value={config.footer} onChange={(e) => updateConfig("footer", e.target.value)} /></label>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="format-field format-field-wide"><span>其余要求</span><textarea placeholder='可不填' value={config.extraRequirements} readOnly /></label>
                </div>
              </div>
            )}
          </div>
          {activeTab === "basic" && (
            <button className="start-format-action" disabled={generating || activeDocument.paragraphs.length === 0} onClick={startGenerating} type="button">{generating ? "正在生成..." : "生成文档"}</button>
          )}
        </article>

        <article className="panel paper-preview">
          <div className="paper-toolbar">
            <div className="paper-pager"><span>预览</span></div>
            <div className="preview-export" ref={exportRef}>
              <button className="preview-export-trigger" disabled={!docxBlob} onClick={() => setExportOpen((o) => !o)} type="button"><FileText size={16} />{generating ? "生成中..." : "导出"}<ChevronDown size={14} /></button>
              {exportOpen && (<div className="preview-export-menu"><button onClick={() => void downloadDocx()} type="button">导出 Word</button><button onClick={printPdf} type="button">导出 PDF</button></div>)}
            </div>
          </div>
          <div className="paper-workspace" ref={previewContainerRef}>
            {(() => {
              const renderEditable = (p: FormatDocumentParagraph, child: React.JSX.Element) => {
                if (editingId === p.paragraph_id) {
                  return (
                    <div key={p.paragraph_id} className="paragraph-edit-form" style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}>
                      <select value={editDraft.type} onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))} style={{ fontSize: 12, padding: "2px 4px" }}>
                        <option value="paragraph">正文</option><option value="heading">标题</option><option value="list">列表</option><option value="table">表格</option>
                      </select>
                      {editDraft.type === "heading" && <input type="number" min={1} max={4} value={editDraft.level} onChange={(e) => setEditDraft((d) => ({ ...d, level: Number(e.target.value) }))} style={{ width: 40, fontSize: 12, padding: "2px 4px" }} />}
                      <input value={editDraft.content} onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))} style={{ flex: 1, fontSize: 12, padding: "2px 4px" }} />
                      <button onClick={saveEdit} style={{ fontSize: 11, cursor: "pointer" }} type="button">保存</button>
                      <button onClick={cancelEdit} style={{ fontSize: 11, cursor: "pointer" }} type="button">取消</button>
                    </div>
                  );
                }
                return <div key={p.paragraph_id} className="paragraph-editable" style={{ position: "relative" }}>{child}<button onClick={() => startEdit(p)} type="button" style={{ position: "absolute", right: -8, top: 0, fontSize: 10, opacity: 0, cursor: "pointer", transition: "opacity 0.15s", padding: "1px 4px" }} className="paragraph-edit-btn">编辑</button></div>;
              };
              const pageH = (previewStyle.height as number) || 877;
              const contentH = pageH - m.top - m.bottom;
              const contentW = paperW - m.left - m.right;
              const bodyFontSizePx = parseFontSizePx(config.bodyFontSize);
              const lineHeightPx = bodyFontSizePx * lineHeightValue(config.lineHeight);
              const charsPerLine = Math.max(8, Math.floor(contentW / bodyFontSizePx));
              const linesPerChunk = Math.max(4, Math.floor((contentH - 80) / lineHeightPx));
              const charsPerChunk = Math.max(80, charsPerLine * linesPerChunk);
              const splitText = (text: string, maxChars: number) => {
                const chunks: string[] = [];
                for (let start = 0; start < text.length; start += maxChars) {
                  chunks.push(text.slice(start, start + maxChars));
                }
                return chunks.length ? chunks : [""];
              };
              const renderSplitParagraph = (paragraph: FormatDocumentParagraph) => {
                const chunks = splitText(paragraph.content, charsPerChunk);
                if (chunks.length === 1) {
                  allElements.push(renderEditable(paragraph, <p style={paragraphStyle}>{paragraph.content}</p>));
                  return;
                }
                chunks.forEach((chunk, index) => {
                  allElements.push(
                    <p key={`${paragraph.paragraph_id}-part-${index}`} style={index === 0 ? paragraphStyle : bodyTextStyle}>
                      {chunk}
                    </p>
                  );
                });
              };
              const renderSplitPre = (paragraph: FormatDocumentParagraph) => {
                const maxPreChars = Math.max(120, Math.floor(charsPerChunk * 0.75));
                const chunks = splitText(paragraph.content, maxPreChars);
                chunks.forEach((chunk, index) => {
                  allElements.push(
                    <pre key={`${paragraph.paragraph_id}-part-${index}`} style={{ fontFamily: "monospace", background: "#f5f5f5", padding: "8px", borderRadius: "4px", whiteSpace: "pre-wrap", fontSize: "0.9em" }}>
                      {chunk}
                    </pre>
                  );
                });
              };
              const allElements: React.JSX.Element[] = [];
              let listBuffer: FormatDocumentParagraph[] = [];
              const flushList = () => {
                if (listBuffer.length > 0) {
                  if (editingId && listBuffer.some((p) => p.paragraph_id === editingId)) {
                    const p = listBuffer.find((pp) => pp.paragraph_id === editingId)!;
                    allElements.push(renderEditable(p, <li>{p.content}</li>));
                    const rest = listBuffer.filter((pp) => pp.paragraph_id !== editingId);
                    if (rest.length > 0) allElements.push(<ul key={rest[0].paragraph_id}>{rest.map((pp) => <li key={pp.paragraph_id}>{pp.content}</li>)}</ul>);
                  } else {
                    allElements.push(<ul key={listBuffer[0].paragraph_id}>{listBuffer.map((p) => renderEditable(p, <li>{p.content}</li>))}</ul>);
                  }
                  listBuffer = [];
                }
              };
              for (const paragraph of displayedParagraphs) {
                if (paragraph.type === "title") continue;
                if (paragraph.type === "list") { listBuffer.push(paragraph); continue; }
                flushList();
                if (paragraph.type === "heading") {
                  const hs = headingStyle(paragraph.level);
                  let h: React.JSX.Element;
                  if (paragraph.level <= 1) h = <h2 style={hs}>{paragraph.content}</h2>;
                  else if (paragraph.level === 2) h = <h3 style={hs}>{paragraph.content}</h3>;
                  else h = <h4 style={hs}>{paragraph.content}</h4>;
                  allElements.push(renderEditable(paragraph, h));
                } else if (paragraph.type === "table") {
                  renderSplitPre(paragraph);
                } else {
                  renderSplitParagraph(paragraph);
                }
              }
              flushList();

              // Split into pages
              const titleH = elementHeights.length > 0 ? elementHeights[0] : 40;
              const pages: React.JSX.Element[][] = [[]];
              let used = titleH + 10; // title + gap
              for (let i = 0; i < allElements.length; i++) {
                const h = (elementHeights[i + 1] ?? 28) + 4;
                if (used + h > contentH && (pages[pages.length - 1].length > 0 || used > 0)) {
                  pages.push([]);
                  used = 0;
                }
                pages[pages.length - 1].push(allElements[i]);
                used += h;
              }

              return (
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top center", width: paperW, height: paperH * pages.length + (pages.length - 1) * 12, margin: "0 auto" }}>
                  {/* Hidden measurement container - visibility:hidden keeps real heights */}
                  <div ref={measureRef} style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", width: paperW - m.left - m.right, padding: 0, lineHeight: previewStyle.lineHeight }}>
                    <h1 style={{ ...titleStyle, fontSize: (titleStyle.fontSize as number) || 26 }}>{displayedTitle}</h1>
                    {allElements}
                  </div>
                  {/* Rendered pages */}
                  {pages.map((pageEls, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <div className="paper-page-break" style={{ width: paperW }} />}
                      <div className="paper" style={{ ...previewStyle, height: paperH, overflow: "hidden" }}>
                        <div className="paper-crop-marks" />
                        <div className="paper-crop-top-right" />
                        <div className="paper-crop-bottom" />
                        <div className="paper-crop-bottom-right" />
                        <div className="paper-content-boundary">
                          {idx === 0 && <h1 style={titleStyle}>{displayedTitle}</h1>}
                          {pageEls}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              );
            })()}
          </div>
        </article>
      </div>
    </section>
  );
}
