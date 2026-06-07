import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Folder,
  Info,
  Languages,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ScanSearch,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  createStoredDocument,
  deleteStoredDocument,
  getStoredDocument,
  indexStoredDocument,
  invalidateDocumentListCache,
  listStoredDocuments,
  quickUploadDocument,
  recognizeDocument,
  uploadStoredDocument,
  type StoredDocumentDetail,
  type StoredDocumentSummary,
} from "../services/api";
import { userStorage } from "../services/userStorage";
import { loadModelSettings } from "../services/modelSettings";

type HomePageProps = {
  onOpenDocument: (document: StoredDocumentDetail) => void;
  onFormatDocument: (document: StoredDocumentDetail) => void;
  onTranslateDocument: (document: StoredDocumentDetail) => void;
};

type ParsedStatus = "parsed" | "pending" | "updated" | "indexing" | "recognizing" | "failed";

function parseStatus(document: StoredDocumentSummary, recognizingDocs?: Map<string, string>): ParsedStatus {
  if (recognizingDocs?.has(document.id)) return "recognizing";
  if (document.rag_status === "indexed") return "parsed";
  if (document.rag_status === "indexing") return "indexing";
  if (document.rag_status === "recognizing") return "recognizing";
  if (document.rag_status === "failed") return "failed";
  if (document.rag_status === "outdated") return "updated";
  return "pending";
}

function statusLabel(status: ParsedStatus) {
  if (status === "parsed") return "已解析";
  if (status === "updated") return "待更新";
  if (status === "indexing") return "解析中";
  if (status === "recognizing") return "识别中";
  if (status === "failed") return "解析失败";
  return "待解析";
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

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function safeFileName(value: string) {
  return (value.trim() || "无标题文档").replace(/[\\/:*?"<>|]/g, "_");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function HomePage({ onFormatDocument, onOpenDocument, onTranslateDocument }: HomePageProps) {
  const [documents, setDocuments] = useState<StoredDocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [menuDocumentId, setMenuDocumentId] = useState<string | null>(null);
  const [exportDocumentId, setExportDocumentId] = useState<string | null>(null);
  const [showParseModal, setShowParseModal] = useState<string | null>(null);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showTrashConfirmId, setShowTrashConfirmId] = useState<string | null>(null);
  const [recognizingDocs, setRecognizingDocs] = useState<Map<string, string>>(new Map());
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeMessage, setCompleteMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recentDocument = documents[0];
  const parsedCount = documents.filter((document) => parseStatus(document) === "parsed").length;
  const pendingCount = documents.filter((document) => parseStatus(document) === "pending").length;
  const recentUploadCount = documents.filter((document) => {
    const uploadedAt = new Date(document.last_saved_at).getTime();
    return !Number.isNaN(uploadedAt) && Date.now() - uploadedAt < 1000 * 60 * 60 * 24 * 7;
  }).length;

  const showMessage = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2200);
  };

  const refresh = async (force = false) => {
    setLoading(true);
    try {
      const response = await listStoredDocuments(force);
      setDocuments(response.documents);
    } catch {
      showMessage("文档列表加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createDocument = async () => {
    try {
      const document = await createStoredDocument({ title: "", content: "" });
      await refresh();
      onOpenDocument({ ...document, title: "" });
    } catch {
      showMessage("新建文档失败");
    }
  };

  const chooseUploadFiles = (files?: FileList | File[] | null) => {
    const nextFiles = Array.from(files || []);
    if (nextFiles.length === 0) return;

    const supportedFiles = nextFiles.filter((file) => {
      const suffix = file.name.split(".").pop()?.toLowerCase() || "";
      return !["xls", "xlsx"].includes(suffix);
    });
    if (supportedFiles.length !== nextFiles.length) {
      showMessage("暂不支持上传 Excel 文件");
    }

    setSelectedFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const merged = [...current];
      supportedFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existing.has(key) && merged.length < 5) {
          merged.push(file);
          existing.add(key);
        }
      });
      if (current.length + supportedFiles.length > 5) {
        showMessage("每次最多上传 5 个文件");
      }
      return merged;
    });
  };

  const uploadDocuments = async () => {
    if (selectedFiles.length === 0) return;

    const settings = loadModelSettings();
    if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.defaultModel.trim()) {
      showMessage("请先在设置页配置支持图片输入的模型");
      return;
    }

    const filesToUpload = [...selectedFiles];
    setLoading(true);

    // 阶段1：快速上传，创建文件
    const uploaded: { docId: string; file: File }[] = [];
    for (const file of filesToUpload) {
      try {
        const doc = await quickUploadDocument(file);
        setRecognizingDocs((prev) => new Map(prev).set(doc.id, file.name));
        uploaded.push({ docId: doc.id, file });
      } catch {
        showMessage(`${file.name} 上传失败`);
      }
    }

    if (uploaded.length === 0) {
      setLoading(false);
      return;
    }

    // 刷新列表，让新文档立即显示（状态为"识别中"）
    await refresh();

    // 关闭弹窗
    setSelectedFiles([]);
    setShowUploadModal(false);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // 阶段2：后台并行视觉识别（不阻塞 UI）
    const results = await Promise.allSettled(
      uploaded.map(({ docId }) =>
        recognizeDocument({
          documentId: docId,
          api_key: settings.apiKey,
          base_url: settings.baseUrl,
          model: settings.defaultModel,
          vision_model: settings.visionModel || undefined,
        }),
      ),
    );

    let successCount = 0;
    let failCount = 0;
    results.forEach((result, index) => {
      const docId = uploaded[index].docId;
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failCount++;
      }
      setRecognizingDocs((prev) => {
        const next = new Map(prev);
        next.delete(docId);
        return next;
      });
    });

    await refresh();

    if (failCount === 0) {
      setCompleteMessage(`全部 ${successCount} 个文档解析完成`);
      setShowCompleteModal(true);
    } else {
      showMessage(`${successCount} 个成功，${failCount} 个失败，请检查模型或文件`);
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      await deleteStoredDocument(documentId);
      ["editorDocument", "translateDocument", "formatDocument", "currentDocument"].forEach((key) => {
        const raw = userStorage.getItem(key);
        if (!raw) return;
        try {
          const current = JSON.parse(raw) as StoredDocumentDetail;
          if (current.id === documentId) userStorage.removeItem(key);
        } catch {
          // Ignore invalid local cache.
        }
      });
      window.dispatchEvent(new CustomEvent("writerhub:document-deleted", { detail: { documentId } }));
      setMenuDocumentId(null);
      await refresh();
      showMessage("已移至回收站");
    } catch {
      showMessage("删除文档失败");
    }
  };

  const handleParse = async (documentId: string) => {
    setShowParseModal(null);
    setIndexingId(documentId);
    setDocuments((current) =>
      current.map((doc) => (doc.id === documentId ? { ...doc, rag_status: "indexing" as const } : doc)),
    );
    try {
      await indexStoredDocument(documentId);
      await refresh();
      showMessage("解析完成");
    } catch {
      setDocuments((current) =>
        current.map((doc) => (doc.id === documentId ? { ...doc, rag_status: "failed" as const } : doc)),
      );
      showMessage("解析失败");
    } finally {
      setIndexingId(null);
    }
  };

  const exportDocument = async (documentId: string, type: "md" | "word" | "pdf") => {
    setExportDocumentId(null);
    try {
      const document = await getStoredDocument(documentId);
      const title = document.title.trim() || "无标题文档";
      const filename = safeFileName(title);
      const markdown = `# ${title}\n\n${document.content || ""}`;
      if (type === "md") {
        downloadBlob(markdown, `${filename}.md`, "text/markdown;charset=utf-8");
        return;
      }

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;line-height:1.8;padding:40px;color:#17233c;}h1{font-size:28px;}pre{white-space:pre-wrap;font-family:inherit;}</style></head><body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(document.content || "")}</pre></body></html>`;
      if (type === "word") {
        downloadBlob(html, `${filename}.doc`, "application/msword;charset=utf-8");
        return;
      }

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        showMessage("浏览器阻止了 PDF 打印窗口");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch {
      showMessage("导出失败，请稍后重试");
    }
  };

  return (
    <section className="page home-page">
      {message && <div className="copy-toast failed">{message}</div>}
      {showParseModal && (
        <div className="modal-overlay" onClick={() => setShowParseModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>文档解析</h3>
              <button className="modal-close" onClick={() => setShowParseModal(null)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="parse-modal-icon">
                <ScanSearch size={36} />
              </div>
              <div className="parse-steps">
                <div className="parse-step"><span className="parse-step-num">1</span>文档转换为图片页</div>
                <div className="parse-step"><span className="parse-step-num">2</span>视觉模型识别内容</div>
                <div className="parse-step"><span className="parse-step-num">3</span>文本清洗与分段切块</div>
                <div className="parse-step"><span className="parse-step-num">4</span>向量化写入知识库</div>
              </div>
              <p className="modal-hint">解析完成后可在知识库页面进行文档问答。</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowParseModal(null)} type="button">
                取消
              </button>
              <button className="btn-primary" onClick={() => void handleParse(showParseModal)} type="button">
                开始解析
              </button>
            </div>
          </div>
        </div>
      )}
      {showUploadModal && (
        <div className="home-modal-backdrop" onMouseDown={() => setShowUploadModal(false)}>
          <div className="home-upload-modal" onMouseDown={(event) => event.stopPropagation()}>
            <h3>上传文档</h3>
            <button
              className={`home-upload-drop${dragActive ? " active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                chooseUploadFiles(event.dataTransfer.files);
              }}
              type="button"
            >
              <Upload size={30} />
              <strong>点击或拖拽文件到这里</strong>
              <span>支持 txt、md、doc、docx、pdf、ppt、pptx，不支持 Excel</span>
            </button>
            {selectedFiles.length > 0 && (
              <div className="home-upload-file-list">
                {selectedFiles.map((file, index) => (
                  <div className="home-upload-file" key={`${file.name}-${file.size}-${file.lastModified}`}>
                    <span className="home-file-badge text">DOC</span>
                    <div>
                      <strong>{file.name}</strong>
                      <em>{formatFileSize(file.size)}</em>
                    </div>
                    <button
                      onClick={() => setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              accept=".txt,.md,.doc,.docx,.pdf,.ppt,.pptx"
              hidden
              multiple
              onChange={(event) => chooseUploadFiles(event.target.files)}
              ref={fileInputRef}
              type="file"
            />
            <div className="home-upload-actions">
              <button
                disabled={selectedFiles.length === 0 || loading}
                onClick={() => void uploadDocuments()}
                type="button"
              >
                {loading ? <><Loader2 className="spin" size={15} /> 创建中...</> : "普通解析"}
              </button>
              <button
                className="primary-action"
                disabled={selectedFiles.length === 0 || loading}
                onClick={() => void uploadDocuments()}
                type="button"
              >
                {loading ? <><Loader2 className="spin" size={15} /> 创建中...</> : "精细解析"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="home-workspace panel" onClick={() => { setMenuDocumentId(null); setExportDocumentId(null); }}>
        <div className="home-header">
          <div>
            <img alt="文枢 AI WriterHub" className="home-brand-image" src="/logo-calligraphy.png" />
          </div>
          <div className="home-actions">
            <button onClick={createDocument} type="button">
              <Plus size={18} />
              新建文档
            </button>
            <button className="primary-action" onClick={() => setShowUploadModal(true)} type="button">
              <Upload size={18} />
              上传文档
            </button>
            <button onClick={() => void refresh()} type="button" aria-label="刷新">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="home-overview">
          <div className="home-continue-card">
            <div className="home-continue-icon">
              <FileText size={34} />
            </div>
            <div>
              <span>继续上次编辑</span>
              <strong>{recentDocument ? (recentDocument.title.length > 10 ? recentDocument.title.slice(0, 10) + "..." : recentDocument.title) : "暂无最近文档"}</strong>
              <p>
                {recentDocument ? `最近打开：${formatTime(recentDocument.last_saved_at)}` : "编辑页会自动保留您上次打开的文档内容"}
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
            documents.map((document) => {
              const status = parseStatus(document, recognizingDocs);
              const isRecognizing = status === "recognizing";
              return (
              <div
                className={`home-doc-row${isRecognizing ? " recognizing" : ""}`}
                key={document.id}
                onClick={isRecognizing ? undefined : () => void onOpenDocumentClick(document.id, onOpenDocument)}
              >
                <button className="home-doc-title" onClick={isRecognizing ? undefined : (event) => { event.stopPropagation(); void onOpenDocumentClick(document.id, onOpenDocument); }} type="button" disabled={isRecognizing}>
                  <span className="home-file-badge text">DOC</span>
                  <span>
                    <strong>{document.title.length > 10 ? document.title.slice(0, 10) + "..." : document.title}</strong>
                    {!isRecognizing && <small className={`document-language-badge compact ${document.language}`}>{document.language === "zh" ? "中文" : "英文"}</small>}
                  </span>
                </button>
                <span className={`parse-status ${status}`}>{statusLabel(status)}</span>
                <span>{formatTime(document.last_saved_at)}</span>
                {!isRecognizing ? (
                <div className="home-doc-actions">
                  <button onClick={(event) => { event.stopPropagation(); void onOpenDocumentClick(document.id, onTranslateDocument); }} type="button">
                    <Languages size={15} />
                    翻译
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); void onOpenDocumentClick(document.id, onFormatDocument); }} type="button">
                    <LayoutTemplate size={15} />
                    格式整理
                  </button>
                  <div className="home-export-menu">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuDocumentId(null);
                        setExportDocumentId((current) => (current === document.id ? null : document.id));
                      }}
                      type="button"
                    >
                      <Download size={15} />
                      导出
                    </button>
                    {exportDocumentId === document.id && (
                      <div className="home-export-popover" onClick={(event) => event.stopPropagation()}>
                        <button onClick={() => void exportDocument(document.id, "word")} type="button">导出 Word</button>
                        <button onClick={() => void exportDocument(document.id, "pdf")} type="button">导出 PDF</button>
                        <button onClick={() => void exportDocument(document.id, "md")} type="button">导出 MD</button>
                      </div>
                    )}
                  </div>
                  <div className="home-more-menu">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setExportDocumentId(null);
                        setMenuDocumentId((current) => (current === document.id ? null : document.id));
                      }}
                      type="button"
                      aria-label="更多操作"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuDocumentId === document.id && (
                      <div className="home-more-popover" onClick={(event) => event.stopPropagation()}>
                        {parseStatus(document) !== "parsed" && parseStatus(document) !== "indexing" && (
                          <button
                            onClick={() => {
                              setMenuDocumentId(null);
                              setShowParseModal(document.id);
                            }}
                            type="button"
                          >
                            <ScanSearch size={14} />
                            解析
                          </button>
                        )}
                        <button
                          className="danger"
                          onClick={() => {
                            setMenuDocumentId(null);
                            setShowTrashConfirmId(document.id);
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
                ) : null}
              </div>
              );
            })
          )}
        </div>
      </div>

      {showTrashConfirmId && (
        <div className="modal-overlay" onClick={() => setShowTrashConfirmId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认删除</h3>
              <button className="modal-close" onClick={() => setShowTrashConfirmId(null)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>确定要将该文档移至回收站吗？</p>
              <p className="modal-hint">文档将在回收站中保留 15 天，之后自动清除。</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowTrashConfirmId(null)} type="button">
                取消
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  void deleteDocument(showTrashConfirmId);
                  setShowTrashConfirmId(null);
                }}
                type="button"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="modal-overlay" onClick={() => setShowCompleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>解析完成</h3>
              <button className="modal-close" onClick={() => setShowCompleteModal(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="parse-modal-icon">
                <CheckCircle2 size={36} />
              </div>
              <p>{completeMessage}</p>
              <p className="modal-hint">文档已可正常打开和编辑。</p>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowCompleteModal(false)} type="button">
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

async function onOpenDocumentClick(
  documentId: string,
  handler: (document: StoredDocumentDetail) => void,
) {
  handler(await getStoredDocument(documentId));
}
