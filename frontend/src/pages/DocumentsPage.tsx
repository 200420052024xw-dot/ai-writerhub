import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, CheckCircle2, FileText, History, Loader2, MoreHorizontal, Send, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  createKnowledgeConversation,
  deleteKnowledgeConversation,
  indexStoredDocumentWithRag,
  listKnowledgeConversations,
  listStoredDocuments,
  queryRagStream,
  renameKnowledgeConversation,
  updateKnowledgeConversationContent,
  type KnowledgeConversation,
  type RagSearchResult,
  type StoredDocumentSummary,
} from "../services/api";
import { loadModelSettings } from "../services/modelSettings";
import { loadRagSettings, toRagRuntimeConfig } from "../services/ragSettings";

const KNOWLEDGE_STATE_KEY = "writerhub.knowledgePageState";

type KnowledgePageState = {
  selectedDocs: string[];
  question: string;
  answer: string;
  chatTurns?: ChatTurn[];
  searchResults: RagSearchResult[];
  showDocLibrary: boolean;
  currentConversationId?: string | null;
};

type ChatTurn = {
  id: string;
  question: string;
  answer: string;
  searchResults?: RagSearchResult[];
};

type SourceGroup = {
  document_id: string;
  document_title: string;
  items: Array<{ index: number; result: RagSearchResult }>;
};

function createTurn(question: string): ChatTurn {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, question, answer: "" };
}

function conversationToTurns(conversation: KnowledgeConversation): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let pendingQuestion = "";
  let assistantIndex = 0;
  conversation.messages.forEach((message) => {
    if (message.role === "user") {
      if (pendingQuestion) turns.push(createTurn(pendingQuestion));
      pendingQuestion = message.content;
      return;
    }
    if (message.role === "assistant") {
      const turn = createTurn(pendingQuestion || "");
      turn.answer = message.content;
      turn.searchResults = conversation.turn_search_results?.[assistantIndex] || conversation.search_results;
      assistantIndex += 1;
      turns.push(turn);
      pendingQuestion = "";
    }
  });
  if (pendingQuestion) turns.push(createTurn(pendingQuestion));
  return turns;
}

export function DocumentsPage() {
  const cachedState = (() => {
    try {
      return JSON.parse(localStorage.getItem(KNOWLEDGE_STATE_KEY) || "null") as KnowledgePageState | null;
    } catch {
      return null;
    }
  })();
  const [documents, setDocuments] = useState<StoredDocumentSummary[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(() => new Set(cachedState?.selectedDocs || []));
  const [showDocLibrary, setShowDocLibrary] = useState(cachedState?.showDocLibrary ?? false);
  const docSelectRef = useRef<HTMLDivElement | null>(null);
  const [selectingChats, setSelectingChats] = useState(false);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [question, setQuestion] = useState(cachedState?.question ?? "");
  const [answer, setAnswer] = useState(cachedState?.answer ?? "");
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>(() => cachedState?.chatTurns ?? (cachedState?.question || cachedState?.answer ? [{ id: "cached", question: cachedState?.question ?? "", answer: cachedState?.answer ?? "" }] : []));
  const [searchResults, setSearchResults] = useState<RagSearchResult[]>(cachedState?.searchResults ?? []);
  const [citationResult, setCitationResult] = useState<{ index: number; result: RagSearchResult } | null>(null);
  const [citationGroup, setCitationGroup] = useState<SourceGroup | null>(null);
  const [historyItems, setHistoryItems] = useState<KnowledgeConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(cachedState?.currentConversationId ?? null);
  const [historyMenuId, setHistoryMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const availableDocuments = documents.filter((doc) => doc.rag_status === "indexed" || doc.rag_status === "outdated" || doc.rag_status === "failed");
  const latestAnswer = useMemo(() => chatTurns.at(-1)?.answer ?? answer, [answer, chatTurns]);
  const ragSettings = loadRagSettings();
  const ragStrategyLabel = `${ragSettings.embeddingSource === "api" ? "API 向量模型" : "默认向量模型"} / ${ragSettings.recallStrategy === "hybrid" ? "BM25 + Vector 混合召回" : "默认召回"}${ragSettings.enableRerank ? " / 启用重排" : ""}`;
  const sourceGroups = useMemo<SourceGroup[]>(() => {
    const groups = new Map<string, SourceGroup>();
    searchResults.forEach((result, index) => {
      const key = result.document_id || result.document_title;
      const group = groups.get(key) || {
        document_id: result.document_id,
        document_title: result.document_title,
        items: [],
      };
      group.items.push({ index: index + 1, result });
      groups.set(key, group);
    });
    return [...groups.values()];
  }, [searchResults]);

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
    void refreshHistory();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      KNOWLEDGE_STATE_KEY,
      JSON.stringify({ selectedDocs: [...selectedDocs], question, answer: latestAnswer, chatTurns, searchResults, showDocLibrary, currentConversationId }),
    );
  }, [selectedDocs, question, latestAnswer, chatTurns, searchResults, showDocLibrary, currentConversationId]);

  useEffect(() => {
    const closeDocDropdown = (event: MouseEvent) => {
      if (!showDocLibrary) return;
      if (docSelectRef.current?.contains(event.target as Node)) return;
      setShowDocLibrary(false);
    };
    document.addEventListener("mousedown", closeDocDropdown);
    return () => document.removeEventListener("mousedown", closeDocDropdown);
  }, [showDocLibrary]);

  const refreshHistory = async () => {
    try {
      const result = await listKnowledgeConversations();
      setHistoryItems(result.conversations);
    } catch {
      setHistoryItems([]);
    }
  };

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
    } catch (error) {
      setMessage(error instanceof Error && error.message ? `解析失败：${error.message}` : "解析失败，请检查 RAG 配置和后端依赖");
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
    const nextTurn = createTurn(trimmed);
    setChatTurns((current) => [...current, nextTurn]);
    setQuestion("");
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
          if (event.type === "retrieval") {
            setSearchResults(event.results);
            setChatTurns((current) => current.map((turn) => (turn.id === nextTurn.id ? { ...turn, searchResults: event.results } : turn)));
          }
          if (event.type === "chunk") {
            setAnswer((current) => current + event.content);
            setChatTurns((current) => current.map((turn) => (turn.id === nextTurn.id ? { ...turn, answer: turn.answer + event.content } : turn)));
          }
        },
      );
    } catch {
      setMessage("问答失败，请检查后端服务、索引或模型配置");
    } finally {
      setLoading(false);
      window.setTimeout(() => setMessage(""), 2200);
    }
  };

  const saveConversationFromTurns = async (turns: ChatTurn[]) => {
    const completeTurns = turns.filter((turn) => turn.question.trim() && turn.answer.trim());
    if (completeTurns.length === 0) return false;
    const title = completeTurns[0].question.trim().slice(0, 30);
    const messages = completeTurns.flatMap((turn) => [
      { role: "user" as const, content: turn.question.trim() },
      { role: "assistant" as const, content: turn.answer.trim() },
    ]);
    const turnSearchResults = completeTurns.map((turn) => turn.searchResults || []);
    const latestSearchResults = [...turnSearchResults].reverse().find((items) => items.length > 0) || searchResults;
    const saved = currentConversationId
      ? await updateKnowledgeConversationContent(currentConversationId, {
        document_ids: [...selectedDocs],
        messages,
        search_results: latestSearchResults,
        turn_search_results: turnSearchResults,
      })
      : await createKnowledgeConversation({
        title,
        document_ids: [...selectedDocs],
        messages,
        search_results: latestSearchResults,
        turn_search_results: turnSearchResults,
      });
    setCurrentConversationId(saved.id);
    await refreshHistory();
    return true;
  };

  const saveCurrentConversation = async () => {
    const completeTurns = chatTurns.filter((turn) => turn.question.trim() && turn.answer.trim());
    if (completeTurns.length === 0) return;
    try {
      await saveConversationFromTurns(completeTurns);
      setSelectingChats(false);
      setMessage("对话已保存");
    } catch {
      setMessage("保存对话失败");
    } finally {
      window.setTimeout(() => setMessage(""), 1800);
    }
  };

  const loadConversation = (conversation: KnowledgeConversation) => {
    setQuestion("");
    const turns = conversationToTurns(conversation);
    setChatTurns(turns);
    setAnswer(turns.at(-1)?.answer || "");
    setSearchResults(conversation.search_results);
    setSelectedDocs(new Set(conversation.document_ids));
    setCurrentConversationId(conversation.id);
    setHistoryMenuId(null);
  };

  const startNewConversation = async () => {
    try {
      const saved = await saveConversationFromTurns(chatTurns);
      if (saved) setMessage("当前对话已保存到历史记录");
    } catch {
      setMessage("当前对话保存失败，已新建空对话");
    }
    setQuestion("");
    setAnswer("");
    setChatTurns([]);
    setSearchResults([]);
    setCurrentConversationId(null);
    setSelectingChats(false);
    setCitationResult(null);
    setCitationGroup(null);
    window.setTimeout(() => setMessage(""), 1800);
  };

  const renderAnswer = (content: string, turnResults: RagSearchResult[] = searchResults) => content.split(/(\[\d+\])/g).map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    const citationIndex = Number(match[1]);
    const result = turnResults[citationIndex - 1];
    const hasCitation = Boolean(result);
    return (
      <button
        className="citation-link"
        disabled={!hasCitation}
        key={`${part}-${index}`}
        onClick={() => result && setCitationResult({ index: citationIndex, result })}
        type="button"
      >
        {part}
      </button>
    );
  });

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
            {historyItems.length === 0 ? (
              <div className="knowledge-empty compact">暂无历史对话</div>
            ) : (
              <div className="history-list">
                {historyItems.map((item) => (
                  <div className="history-item" key={item.id} onClick={() => loadConversation(item)}>
                    <span className="history-title">{item.title}</span>
                    <div className="history-more-wrapper" onClick={(event) => event.stopPropagation()}>
                      <button className="history-more-btn" onClick={() => setHistoryMenuId((current) => current === item.id ? null : item.id)} type="button">
                        <MoreHorizontal size={16} />
                      </button>
                      {historyMenuId === item.id && (
                        <div className="history-more-menu">
                          <button
                            onClick={async () => {
                              const title = window.prompt("重命名对话", item.title);
                              if (!title) return;
                              await renameKnowledgeConversation(item.id, title);
                              await refreshHistory();
                              setHistoryMenuId(null);
                            }}
                            type="button"
                          >
                            重命名
                          </button>
                          <button
                            className="danger"
                            onClick={async () => {
                              await deleteKnowledgeConversation(item.id);
                              await refreshHistory();
                              setHistoryMenuId(null);
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
                ))}
              </div>
            )}
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
                {sourceGroups.map((group) => (
                  <button className="search-result source-only" key={group.document_id || group.document_title} onClick={() => setCitationGroup(group)} type="button">
                    <div className="search-result-left">
                      <span className="search-file-icon">
                        <FileText size={14} />
                      </span>
                      <div className="search-file-main">
                        <span className="search-file-name">{group.document_title}</span>
                      </div>
                    </div>
                    <span className="search-source-count">{group.items.map((item) => `[${item.index}]`).join(" ")}</span>
                  </button>
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
                  <button className="save-chat-top-btn" disabled={!chatTurns.some((turn) => turn.answer.trim())} onClick={() => void saveCurrentConversation()} type="button">
                    <Bookmark size={14} />
                    保存选中
                  </button>
                  <button className="chat-select-secondary" disabled={!chatTurns.some((turn) => turn.answer.trim())} type="button">
                    全选
                  </button>
                  <button className="chat-select-secondary" onClick={() => setSelectingChats(false)} type="button">
                    取消
                  </button>
                </>
              )}
              <button className="chat-select-secondary" onClick={() => void startNewConversation()} type="button">
                新建对话
              </button>
            </div>

            <div className="doc-select-wrapper" ref={docSelectRef}>
              <button className="doc-select-btn" onClick={() => setShowDocLibrary((current) => !current)} type="button">
                <SlidersHorizontal size={15} />
                选择文档
                <span className="doc-count">{selectedDocs.size}/{availableDocuments.length}</span>
              </button>
              {showDocLibrary && (
                <div className="doc-dropdown">
                  <div className="doc-dropdown-header">
                    <span>点击解析/更新将按当前策略执行：{ragStrategyLabel}</span>
                  </div>
                  <div className="doc-dropdown-list">
                    {availableDocuments.length === 0 && <div className="file-selector-empty">暂无已解析、待更新或可重试文档</div>}
                    {availableDocuments.map((doc) => {
                      const isSelected = selectedDocs.has(doc.id);
                      const canUse = doc.rag_status === "indexed";
                      const isFailed = doc.rag_status === "failed";
                      const isIndexing = indexingId === doc.id;
                      return (
                        <div
                          className={`doc-dropdown-item${!canUse ? " outdated" : ""}${isSelected ? " selected" : ""}${isIndexing ? " indexing" : ""}`}
                          key={doc.id}
                          onClick={() => {
                            if (isIndexing) return;
                            if (canUse) toggleDoc(doc.id);
                            else void runIndex(doc.id);
                          }}
                        >
                          <span className="doc-icon">
                            <FileText size={16} />
                          </span>
                          <span className="doc-info">
                            <span className="doc-name">{doc.title || "无标题文档"}</span>
                            <span className="doc-meta">{isIndexing ? "正在解析并更新索引..." : canUse ? "点击选择该文档" : isFailed ? "上次解析失败，点击重试" : "点击更新后将自动选中"}</span>
                          </span>
                          {!canUse && <span className={`status-outdated${isFailed ? " failed" : ""}${isIndexing ? " indexing" : ""}`}>{isIndexing ? "解析中" : isFailed ? "解析失败" : "待更新"}</span>}
                          {!canUse && (
                            <button
                              className="doc-update-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (isIndexing) return;
                                void runIndex(doc.id);
                              }}
                              disabled={isIndexing}
                              type="button"
                            >
                              {isIndexing ? <Loader2 className="spin" size={13} /> : isFailed ? "重试解析" : "立即更新"}
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
            {chatTurns.length === 0 ? (
              <div className="knowledge-empty qa-empty">
                <strong>选择文档后开始问答</strong>
                <span>解析完成的文档会参与知识库检索，答案和来源会显示在这里。</span>
              </div>
            ) : (
              <>
                {chatTurns.map((turn, index) => (
                  <Fragment key={turn.id}>
                    <div className="chat-message user">
                      <span className="chat-avatar">Q</span>
                      <div className="chat-bubble">{turn.question}</div>
                    </div>
                    {(turn.answer.trim() || (loading && index === chatTurns.length - 1)) && (
                      <div className="chat-message ai">
                        <span className="chat-avatar">AI</span>
                        <div className="chat-bubble">{turn.answer ? renderAnswer(turn.answer, turn.searchResults || searchResults) : "正在检索并生成答案..."}</div>
                      </div>
                    )}
                  </Fragment>
                ))}
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
      {citationGroup && (
        <div className="citation-modal-overlay" onClick={() => setCitationGroup(null)}>
          <div className="citation-modal" onClick={(event) => event.stopPropagation()}>
            <div className="citation-modal-header">
              <strong>{citationGroup.document_title}</strong>
              <button className="icon-btn" onClick={() => setCitationGroup(null)} type="button">×</button>
            </div>
            <div className="citation-group-list">
              {citationGroup.items.map((item) => (
                <div className="citation-group-item" key={item.result.chunk_id}>
                  <div className="citation-modal-source">
                    <FileText size={15} />
                    <span>依据 [{item.index}]</span>
                    <em>{Math.round(item.result.score * 100)}%</em>
                  </div>
                  <p>{item.result.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {citationResult && (
        <div className="citation-modal-overlay" onClick={() => setCitationResult(null)}>
          <div className="citation-modal" onClick={(event) => event.stopPropagation()}>
            <div className="citation-modal-header">
              <strong>依据 [{citationResult.index}]</strong>
              <button className="icon-btn" onClick={() => setCitationResult(null)} type="button">×</button>
            </div>
            <div className="citation-modal-source">
              <FileText size={15} />
              <span>{citationResult.result.document_title}</span>
              <em>{Math.round(citationResult.result.score * 100)}%</em>
            </div>
            <p>{citationResult.result.content}</p>
          </div>
        </div>
      )}
    </section>
  );
}
