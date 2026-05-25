import { useEffect, useState } from "react";
import { Bookmark, Check, CheckCircle2, FileText, History, Loader2, Send, SlidersHorizontal } from "lucide-react";
import {
  indexStoredDocumentWithRag,
  listStoredDocuments,
  queryRagStream,
  type RagSearchResult,
  type StoredDocumentSummary,
} from "../services/api";
import { loadModelSettings } from "../services/modelSettings";
import { loadRagSettings, toRagRuntimeConfig } from "../services/ragSettings";

export function DocumentsPage() {
  const [documents, setDocuments] = useState<StoredDocumentSummary[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [showDocLibrary, setShowDocLibrary] = useState(false);
  const [selectingChats, setSelectingChats] = useState(false);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [searchResults, setSearchResults] = useState<RagSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const availableDocuments = documents.filter((doc) => doc.rag_status === "indexed" || doc.rag_status === "outdated");

  const refreshDocuments = async () => {
    try {
      const result = await listStoredDocuments();
      setDocuments(result.documents);
      setSelectedDocs((current) => new Set([...current].filter((id) => result.documents.some((doc) => doc.id === id && doc.rag_status === "indexed"))));
    } catch {
      setMessage("文档列表加载失败");
    }
  };

  useEffect(() => {
    void refreshDocuments();
  }, []);

  const toggleDoc = (documentId: string) => {
    setSelectedDocs((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  };

  const runIndex = async (documentId: string) => {
    setIndexingId(documentId);
    setMessage("");
    try {
      await indexStoredDocumentWithRag(documentId, toRagRuntimeConfig(loadRagSettings()));
      await refreshDocuments();
      setSelectedDocs((current) => new Set([...current, documentId]));
      setMessage("文档解析完成");
    } catch {
      setMessage("解析失败，请检查 RAG 配置和后端依赖");
    } finally {
      setIndexingId(null);
      window.setTimeout(() => setMessage(""), 2200);
    }
  };

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    if (selectedDocs.size === 0) {
      setMessage("请先选择要检索的文档");
      return;
    }
    const settings = loadModelSettings();
    if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.defaultModel.trim()) {
      setMessage("请先在设置页配置聊天模型");
      return;
    }

    setLoading(true);
    setMessage("");
    setAnswer("");
    setSearchResults([]);
    try {
      await queryRagStream(
        {
          question: trimmed,
          document_ids: [...selectedDocs],
          rag_config: toRagRuntimeConfig(loadRagSettings()),
          chat_config: {
            api_key: settings.apiKey,
            base_url: settings.baseUrl,
            model: settings.defaultModel,
          },
        },
        (event) => {
          if (event.type === "retrieval") setSearchResults(event.results);
          if (event.type === "chunk") setAnswer((current) => current + event.content);
        },
      );
    } catch {
      setMessage("问答失败，请检查后端服务、索引或模型配置");
    } finally {
      setLoading(false);
      window.setTimeout(() => setMessage(""), 2200);
    }
  };

  return (
    <section className="page documents-page">
      {message && <div className="copy-toast done">{message}</div>}
      <div className="documents-layout">
        <aside className="panel kb-left-panel">
          <div className="side-section">
            <div className="panel-title">
              <History size={18} />
              <h2>历史对话</h2>
            </div>
            <div className="knowledge-empty compact">暂无历史对话</div>
          </div>

          <div className="side-divider" />

          <div className="side-section retrieval-section">
            <div className="panel-title">
              <CheckCircle2 size={18} />
              <h2>检索结果 Top 5</h2>
            </div>
            {searchResults.length === 0 ? (
              <div className="knowledge-empty compact">提问后将在这里显示相关片段</div>
            ) : (
              <div className="search-result-list">
                {searchResults.map((result, index) => (
                  <div className="search-result" key={result.chunk_id}>
                    <div className="search-result-left">
                      <span className="search-file-icon">
                        <FileText size={14} />
                      </span>
                      <div className="search-file-main">
                        <span className="search-file-name">[{index + 1}] {result.document_title}</span>
                        <span className="search-snippet">{result.content.slice(0, 90)}</span>
                        <span className="search-score-bar">
                          <span style={{ width: `${Math.round(result.score * 100)}%` }} />
                        </span>
                      </div>
                    </div>
                    <span className="search-score">{Math.round(result.score * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <article className="panel qa-panel">
          <div className="qa-controls">
            <div className="qa-controls-left">
              {!selectingChats ? (
                <button className="save-chat-top-btn" onClick={() => setSelectingChats(true)} type="button">
                  <Bookmark size={14} />
                  保存对话
                </button>
              ) : (
                <>
                  <button className="save-chat-top-btn" disabled={!answer.trim()} type="button">
                    <Bookmark size={14} />
                    保存选中
                  </button>
                  <button className="chat-select-secondary" disabled={!answer.trim()} type="button">
                    全选
                  </button>
                  <button className="chat-select-secondary" onClick={() => setSelectingChats(false)} type="button">
                    取消
                  </button>
                </>
              )}
            </div>

            <div className="doc-select-wrapper">
              <button className="doc-select-btn" onClick={() => setShowDocLibrary((current) => !current)} type="button">
                <SlidersHorizontal size={15} />
                选择文档
                <span className="doc-count">{selectedDocs.size}/{availableDocuments.length}</span>
              </button>
              {showDocLibrary && (
                <div className="doc-dropdown">
                  <div className="doc-dropdown-header">
                    <span>解析后的文档才会参与问答，待更新文档需重新解析</span>
                  </div>
                  <div className="doc-dropdown-list">
                    {availableDocuments.length === 0 && <div className="file-selector-empty">暂无已解析或待更新文档</div>}
                    {availableDocuments.map((doc) => {
                      const isSelected = selectedDocs.has(doc.id);
                      const canUse = doc.rag_status === "indexed";
                      return (
                        <div
                          className={`doc-dropdown-item${!canUse ? " outdated" : ""}${isSelected ? " selected" : ""}`}
                          key={doc.id}
                          onClick={() => {
                            if (canUse) toggleDoc(doc.id);
                            else void runIndex(doc.id);
                          }}
                        >
                          <span className="doc-icon">
                            <FileText size={16} />
                          </span>
                          <span className="doc-info">
                            <span className="doc-name">{doc.title || "无标题文档"}</span>
                            <span className="doc-meta">{canUse ? "点击选择该文档" : "点击更新后将自动选中"}</span>
                          </span>
                          {!canUse && <span className="status-outdated">待更新</span>}
                          {!canUse && (
                            <button
                              className="doc-update-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                void runIndex(doc.id);
                              }}
                              disabled={indexingId === doc.id}
                              type="button"
                            >
                              {indexingId === doc.id ? <Loader2 className="spin" size={13} /> : "更新"}
                            </button>
                          )}
                          <span className={`custom-checkbox${isSelected ? " checked" : ""}`}>
                            {isSelected && <Check size={12} />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="doc-dropdown-footer">已选择 {selectedDocs.size} / {availableDocuments.length} 个文档</div>
                </div>
              )}
            </div>
          </div>

          <div className="chat-area">
            {!question.trim() && !answer.trim() ? (
              <div className="knowledge-empty qa-empty">
                <strong>选择文档后开始问答</strong>
                <span>解析完成的文档会参与知识库检索，答案和来源会显示在这里。</span>
              </div>
            ) : (
              <>
                {question.trim() && (
                  <div className="chat-message user">
                    <span className="chat-avatar">Q</span>
                    <div className="chat-bubble">{question}</div>
                  </div>
                )}
                {(answer.trim() || loading) && (
                  <div className="chat-message ai">
                    <span className="chat-avatar">AI</span>
                    <div className="chat-bubble">{answer || "正在检索并生成答案..."}</div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="ask-box">
            <input
              disabled={loading}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void ask();
              }}
              type="text"
              value={question}
              placeholder="输入你的问题，基于已解析文档进行问答..."
            />
            <button disabled={loading} onClick={() => void ask()} type="button">
              {loading ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
              {loading ? "生成中" : "发送"}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
