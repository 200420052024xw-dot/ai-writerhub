import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Folder,
  Info,
  Languages,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createStoredDocument,
  getStoredDocument,
  listStoredDocuments,
  uploadStoredDocument,
  type StoredDocumentDetail,
  type StoredDocumentSummary,
} from "../services/api";
import { loadModelSettings } from "../services/modelSettings";

type HomePageProps = {
  onOpenDocument: (document: StoredDocumentDetail) => void;
  onFormatDocument: (document: StoredDocumentDetail) => void;
  onTranslateDocument: (document: StoredDocumentDetail) => void;
};

const mockNow = new Date("2026-05-24T10:24:00+08:00").toISOString();
const mockDocuments: StoredDocumentDetail[] = [
  {
    id: "mock-prd",
    title: "产品需求文档 PRD 示例",
    filename: "产品需求文档 PRD 示例.docx",
    file_type: "docx",
    uploaded_at: mockNow,
    updated_at: mockNow,
    parse_method: "vision",
    content: "# 产品需求文档 PRD 示例\n\n## 1. 项目背景\n文枢 AI WriterHub 是一款面向内容创作者和知识工作者的智能文档编辑器。\n\n## 2. 核心功能\n- AI 辅助写作\n- 多语言翻译\n- 文档格式整理\n- 多文档问答",
  },
  {
    id: "mock-report",
    title: "AI 产品方案汇报",
    filename: "AI 产品方案汇报.pdf",
    file_type: "pdf",
    uploaded_at: "2026-05-20T08:47:00+08:00",
    updated_at: "2026-05-20T08:47:00+08:00",
    parse_method: "manual",
    content: "# AI 产品方案汇报\n\n本文档用于汇报产品定位、目标用户、核心场景和后续迭代计划。\n\n## 关键结论\n- 优先完善文档编辑体验\n- 强化上传解析和文档工作台\n- 为后续 RAG 检索建立统一文档入口",
  },
  {
    id: "mock-course",
    title: "智能文本编辑器课程设计说明书",
    filename: "智能文本编辑器课程设计说明书.md",
    file_type: "md",
    uploaded_at: "2026-05-19T22:11:00+08:00",
    updated_at: "2026-05-19T22:11:00+08:00",
    parse_method: "vision",
    content: "# 智能文本编辑器课程设计说明书\n\n## 系统目标\n构建一个支持写作、翻译、格式整理和文档管理的一体化编辑系统。\n\n## 模块设计\n- 前端工作台\n- Tiptap 编辑器\n- FastAPI 后端\n- 模型配置与调用",
  },
  {
    id: "mock-translation",
    title: "长文翻译实践记录",
    filename: "长文翻译实践记录.pptx",
    file_type: "pptx",
    uploaded_at: "2026-05-18T15:36:00+08:00",
    updated_at: "2026-05-18T15:36:00+08:00",
    parse_method: "manual",
    content: "# 长文翻译实践记录\n\n本记录总结了长文本翻译过程中的术语统一、上下文保持和分段显示策略。\n\n## 观察\n长文本需要先建立上下文摘要，再逐块翻译，最后合并输出。",
  },
];

function mockSummary(document: StoredDocumentDetail): StoredDocumentSummary {
  const { content: _content, ...summary } = document;
  return summary;
}

function parseStatus(document: StoredDocumentSummary): "parsed" | "pending" {
  return document.parse_method === "vision" ? "parsed" : "pending";
}

function statusLabel(status: "parsed" | "pending") {
  return status === "parsed" ? "已解析" : "待解析";
}

function fileTypeClass(fileType: string) {
  if (fileType.includes("pdf")) return "pdf";
  if (fileType.includes("ppt")) return "ppt";
  if (fileType.includes("doc")) return "word";
  if (fileType.includes("md") || fileType.includes("txt")) return "text";
  return "text";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HomePage({ onFormatDocument, onOpenDocument, onTranslateDocument }: HomePageProps) {
  const [documents, setDocuments] = useState<StoredDocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [menuDocumentId, setMenuDocumentId] = useState<string | null>(null);
  const [showParseModal, setShowParseModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recentDocument = documents[0];
  const parsedCount = documents.filter((document) => parseStatus(document) === "parsed").length;
  const pendingCount = documents.length - parsedCount;
  const recentUploadCount = documents.filter((document) => {
    const uploadedAt = new Date(document.uploaded_at).getTime();
    return !Number.isNaN(uploadedAt) && Date.now() - uploadedAt < 1000 * 60 * 60 * 24 * 7;
  }).length;

  const showMessage = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2200);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await listStoredDocuments();
      setDocuments(response.documents.length > 0 ? response.documents : mockDocuments.map(mockSummary));
    } catch {
      setDocuments(mockDocuments.map(mockSummary));
      showMessage("已显示模拟文档");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createDocument = async () => {
    try {
      const document = await createStoredDocument({ title: "无标题文档", content: "" });
      await refresh();
      onOpenDocument(document);
    } catch {
      showMessage("新建文档失败");
    }
  };

  const uploadDocument = async (file: File) => {
    const suffix = file.name.split(".").pop()?.toLowerCase() || "";
    if (["xls", "xlsx"].includes(suffix)) {
      showMessage("暂不支持上传 Excel 文件");
      return;
    }

    const settings = loadModelSettings();
    if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.defaultModel.trim()) {
      showMessage("请先在设置页配置支持图片输入的模型");
      return;
    }

    setLoading(true);
    try {
      const document = await uploadStoredDocument({
        file,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model: settings.defaultModel,
      });
      await refresh();
      onOpenDocument(document);
    } catch {
      showMessage("上传解析失败，请检查模型或文件转换环境");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section className="page home-page">
      {message && <div className="copy-toast failed">{message}</div>}
      {showParseModal && (
        <div className="home-modal-backdrop" onMouseDown={() => setShowParseModal(false)}>
          <div className="home-parse-modal" onMouseDown={(event) => event.stopPropagation()}>
            <h3>解析策略</h3>
            <p>文档会先转换为图片页，再使用设置页配置的视觉模型识别内容。</p>
            <p>解析结果将用于文本提取、清洗、分段切块、向量化并写入知识库索引，供后续文档问答使用。</p>
            <button className="primary-action" onClick={() => setShowParseModal(false)} type="button">知道了</button>
          </div>
        </div>
      )}
      <div className="home-workspace panel">
        <div className="home-header">
          <div>
            <h2>文档首页</h2>
          </div>
          <div className="home-actions">
            <button onClick={createDocument} type="button">
              <Plus size={18} />
              新建文档
            </button>
            <button className="primary-action" onClick={() => fileInputRef.current?.click()} type="button">
              <Upload size={18} />
              上传文档
            </button>
            <button onClick={() => void refresh()} type="button" aria-label="刷新">
              <RefreshCw size={18} />
            </button>
            <input
              accept=".txt,.md,.doc,.docx,.pdf,.ppt,.pptx"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadDocument(file);
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </div>

        <div className="home-overview">
          <div className="home-continue-card">
            <div className="home-continue-icon">
              <FileText size={34} />
            </div>
            <div>
              <span>继续上次编辑</span>
              <strong>{recentDocument?.title || "暂无最近文档"}</strong>
              <p>
                {recentDocument ? `最近打开：${formatTime(recentDocument.updated_at)}` : "编辑页会自动保留您上次打开的文档内容"}
              </p>
            </div>
            <button
              className="primary-action"
              disabled={!recentDocument}
              onClick={() => {
                if (recentDocument) void onOpenDocumentClick(recentDocument.id, onOpenDocument);
              }}
              type="button"
            >
              继续编辑
            </button>
          </div>

          <div className="home-stat-card">
            <Folder size={24} />
            <span>全部文档</span>
            <strong>{documents.length}</strong>
          </div>
          <div className="home-stat-card">
            <Upload size={24} />
            <span>最近上传</span>
            <strong>{recentUploadCount}</strong>
          </div>
          <div className="home-stat-card">
            <Clock3 size={24} />
            <span>待解析</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className="home-stat-card">
            <CheckCircle2 size={24} />
            <span>已解析</span>
            <strong>{parsedCount}</strong>
          </div>
        </div>

        <div className="home-doc-table">
          <div className="home-doc-tip">
            <Info size={16} />
            点击文档标题或任意一行，将在编辑器页面加载并展示该文档内容。
          </div>
          <div className="home-doc-head">
            <span>标题</span>
            <span>解析状态</span>
            <span>修改时间</span>
            <span>操作</span>
          </div>
          {documents.length === 0 ? (
            <div className="home-empty">{loading ? "正在加载..." : "暂无文档，先新建或上传一个文档。"}</div>
          ) : (
            documents.map((document) => (
              <div
                className="home-doc-row"
                key={document.id}
                onClick={() => void onOpenDocumentClick(document.id, onOpenDocument)}
              >
                <button className="home-doc-title" onClick={(event) => { event.stopPropagation(); void onOpenDocumentClick(document.id, onOpenDocument); }} type="button">
                  <span className={`home-file-badge ${fileTypeClass(document.file_type)}`}>{document.file_type.toUpperCase().slice(0, 3)}</span>
                  <span>
                    <strong>{document.title}</strong>
                    <em>{document.filename} · {document.file_type}</em>
                  </span>
                </button>
                <span className={`parse-status ${parseStatus(document)}`}>{statusLabel(parseStatus(document))}</span>
                <span>{formatTime(document.updated_at)}</span>
                <div className="home-doc-actions">
                  <button onClick={(event) => { event.stopPropagation(); void onOpenDocumentClick(document.id, onTranslateDocument); }} type="button">
                    <Languages size={15} />
                    翻译
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); void onOpenDocumentClick(document.id, onFormatDocument); }} type="button">
                    <LayoutTemplate size={15} />
                    格式整理
                  </button>
                  <div className="home-more-menu">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuDocumentId((current) => (current === document.id ? null : document.id));
                      }}
                      type="button"
                      aria-label="更多操作"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuDocumentId === document.id && (
                      <div className="home-more-popover" onClick={(event) => event.stopPropagation()}>
                        {parseStatus(document) !== "parsed" && (
                          <button
                            onClick={() => {
                              setMenuDocumentId(null);
                              setShowParseModal(true);
                            }}
                            type="button"
                          >
                            解析
                          </button>
                        )}
                        <button
                          className="danger"
                          onClick={() => {
                            setMenuDocumentId(null);
                            showMessage("删除功能稍后接入");
                          }}
                          type="button"
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

async function onOpenDocumentClick(
  documentId: string,
  handler: (document: StoredDocumentDetail) => void,
) {
  const mockDocument = mockDocuments.find((document) => document.id === documentId);
  if (mockDocument) {
    handler(mockDocument);
    return;
  }
  handler(await getStoredDocument(documentId));
}
