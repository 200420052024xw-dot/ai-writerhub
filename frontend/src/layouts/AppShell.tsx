import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, FileQuestion, FileText, Home, Languages, Menu, Plus, Search, Settings, X } from "lucide-react";
import { EditorPage } from "../pages/EditorPage";
import { TranslatePage } from "../pages/TranslatePage";
import { FormatPage } from "../pages/FormatPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { HomePage } from "../pages/HomePage";
import { SettingsPage } from "../pages/SettingsPage";
import { loadModelSettings } from "../services/modelSettings";
import { createStoredDocument, listStoredDocuments, getStoredDocument, type StoredDocumentDetail, type StoredDocumentSummary } from "../services/api";
import type { HealthState, NavigationKey } from "../types";

type AppShellProps = {
  healthState: HealthState;
};

const navItems = [
  { key: "home", label: "首页", icon: Home },
  { key: "editor", label: "编辑", icon: FileText },
  { key: "translate", label: "翻译", icon: Languages },
  { key: "documents", label: "知识库", icon: FileQuestion },
  { key: "format", label: "格式整理", icon: ClipboardList },
] satisfies Array<{ key: NavigationKey; label: string; icon: typeof FileText }>;

const pageTitles: Record<NavigationKey, string> = {
  home: "首页",
  editor: "无标题文档",
  translate: "产品需求文档 PRD 示例",
  format: "产品需求文档 PRD 示例",
  documents: "知识库",
  export: "导出中心",
  settings: "模型与系统设置",
};

function loadCachedDocument(key: string): StoredDocumentDetail | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDocumentDetail;
  } catch {
    return null;
  }
}

export function AppShell({ healthState }: AppShellProps) {
  const [activePage, setActivePage] = useState<NavigationKey>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modelSettings, setModelSettings] = useState(() => loadModelSettings());
  const [editorTitle, setEditorTitle] = useState("");
  const [saveState, setSaveState] = useState<{ label: string; status: "idle" | "saving" | "saved" | "failed" }>({
    label: "已保存 10:24",
    status: "saved",
  });
  const [editorDocument, setEditorDocument] = useState<StoredDocumentDetail | null>(() => loadCachedDocument("writerhub.editorDocument"));
  const [translateDocument, setTranslateDocument] = useState<StoredDocumentDetail | null>(() => loadCachedDocument("writerhub.translateDocument"));
  const [formatDocument, setFormatDocument] = useState<StoredDocumentDetail | null>(() => loadCachedDocument("writerhub.formatDocument"));
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [fileList, setFileList] = useState<StoredDocumentSummary[]>([]);
  const [fileListLoading, setFileListLoading] = useState(false);

  const loadFileList = async () => {
    setFileListLoading(true);
    try {
      const result = await listStoredDocuments();
      setFileList(result.documents);
    } catch {
      setFileList([]);
    } finally {
      setFileListLoading(false);
    }
  };

  const handleOpenFileSelector = () => {
    if (activePage === "home" || activePage === "documents") return;
    setShowFileSelector((current) => {
      const next = !current;
      if (next) void loadFileList();
      return next;
    });
  };

  const handleSelectFile = async (doc: StoredDocumentSummary) => {
    try {
      const detail = await getStoredDocument(doc.id);
      if (activePage === "editor") {
        setEditorDocument(detail);
        setEditorTitle(detail.title.trim());
        window.localStorage.setItem("writerhub.editorDocument", JSON.stringify(detail));
      } else if (activePage === "translate") {
        setTranslateDocument(detail);
        window.localStorage.setItem("writerhub.translateDocument", JSON.stringify(detail));
      } else if (activePage === "format") {
        setFormatDocument(detail);
        window.localStorage.setItem("writerhub.formatDocument", JSON.stringify(detail));
      }
      setShowFileSelector(false);
    } catch {
      // ignore
    }
  };

  const handleCreateDocumentFromSelector = async () => {
    try {
      const document = await createStoredDocument({ title: "", content: "" });
      setEditorDocument({ ...document, title: "" });
      setEditorTitle("");
      window.localStorage.setItem("writerhub.editorDocument", JSON.stringify({ ...document, title: "" }));
      setShowFileSelector(false);
      setActivePage("editor");
    } catch {
      // ignore
    }
  };

  const handleEditorTitleChange = (title: string) => {
    setEditorTitle(title);
    setEditorDocument((current) => {
      if (!current) return current;
      const next = { ...current, title };
      window.localStorage.setItem("writerhub.editorDocument", JSON.stringify(next));
      return next;
    });
  };

  const modelConfigured = Boolean(
    modelSettings.apiKey.trim() && modelSettings.baseUrl.trim() && modelSettings.defaultModel.trim(),
  );

  const modelStatusClass = modelConfigured ? "online" : "offline";
  const modelStatusText = modelConfigured ? modelSettings.defaultModel : "暂未配置模型";
  const fileSelectorDisabled = activePage === "home" || activePage === "documents";
  const fileSelectorTitle = fileSelectorDisabled ? "当前页面不可用" : "选择文件";
  const currentPageTitle =
    activePage === "editor"
      ? editorTitle || "无标题文档"
      : activePage === "translate"
        ? translateDocument?.title?.trim() || "未选择文件"
        : activePage === "format"
          ? formatDocument?.title?.trim() || "未选择文件"
        : pageTitles[activePage];
  const showSaveState = activePage === "editor";

  const pageContent = useMemo(() => {
    const openDocument = (document: StoredDocumentDetail, page: NavigationKey = "editor") => {
      if (page === "editor") {
        setEditorDocument(document);
        setEditorTitle(document.title.trim());
        window.localStorage.setItem("writerhub.editorDocument", JSON.stringify(document));
      } else if (page === "translate") {
        setTranslateDocument(document);
        window.localStorage.setItem("writerhub.translateDocument", JSON.stringify(document));
      } else if (page === "format") {
        setFormatDocument(document);
        window.localStorage.setItem("writerhub.formatDocument", JSON.stringify(document));
      }
      setActivePage(page);
    };

    if (activePage === "home") {
      return (
        <HomePage
          onFormatDocument={(document) => openDocument(document, "format")}
          onOpenDocument={(document) => openDocument(document, "editor")}
          onTranslateDocument={(document) => openDocument(document, "translate")}
        />
      );
    }
    if (activePage === "editor") {
      return (
        <EditorPage
          documentContent={editorDocument?.content}
          documentId={editorDocument?.id}
          documentTitle={editorDocument?.title}
          onTitleChange={handleEditorTitleChange}
          onSaveStateChange={setSaveState}
          onDocumentSaved={(document) => {
            setEditorDocument((current) => {
              if (!current || current.id !== document.id) return current;
              const next = {
                ...current,
                title: document.title,
                content: document.content,
                last_saved_at: document.last_saved_at,
              };
              window.localStorage.setItem("writerhub.editorDocument", JSON.stringify(next));
              return next;
            });
          }}
        />
      );
    }
    if (activePage === "translate") return <TranslatePage sourceDocument={translateDocument} />;
    if (activePage === "format") return <FormatPage sourceDocument={formatDocument} />;
    if (activePage === "documents") return <DocumentsPage />;
    if (activePage === "settings") return <SettingsPage />;

    return (
      <section className="empty-workspace">
        <h2>{pageTitles[activePage]}</h2>
        <p>该页面将在后续阶段完善。</p>
      </section>
    );
  }, [activePage, editorDocument, translateDocument, formatDocument]);

  useEffect(() => {
    const refreshModelSettings = () => setModelSettings(loadModelSettings());
    window.addEventListener("storage", refreshModelSettings);
    window.addEventListener("writerhub:model-settings-saved", refreshModelSettings);
    return () => {
      window.removeEventListener("storage", refreshModelSettings);
      window.removeEventListener("writerhub:model-settings-saved", refreshModelSettings);
    };
  }, []);

  useEffect(() => {
    if (!showFileSelector) return;
    const closeFileSelector = () => setShowFileSelector(false);
    window.addEventListener("click", closeFileSelector);
    return () => window.removeEventListener("click", closeFileSelector);
  }, [showFileSelector]);

  useEffect(() => {
    const handleDeleted = (event: Event) => {
      const documentId = (event as CustomEvent<{ documentId?: string }>).detail?.documentId;
      if (!documentId) return;
      setEditorDocument((current) => {
        if (current?.id !== documentId) return current;
        setEditorTitle("");
        return null;
      });
      setTranslateDocument((current) => (current?.id === documentId ? null : current));
      setFormatDocument((current) => (current?.id === documentId ? null : current));
      setFileList((current) => current.filter((document) => document.id !== documentId));
    };
    window.addEventListener("writerhub:document-deleted", handleDeleted);
    return () => window.removeEventListener("writerhub:document-deleted", handleDeleted);
  }, []);

  const openPage = (page: NavigationKey) => {
    setActivePage(page);
    setModelSettings(loadModelSettings());
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="brand">
          <img alt="文枢 AI WriterHub" className="brand-logo" src="/logo-brand.png" />
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activePage;

            return (
              <button
                className={`nav-item ${isActive ? "active" : ""}`}
                key={item.key}
                onClick={() => openPage(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                type="button"
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          className={`sidebar-settings ${activePage === "settings" ? "active" : ""}`}
          onClick={() => openPage("settings")}
          title={sidebarCollapsed ? "设置" : undefined}
          type="button"
        >
          <Settings size={20} />
          <span>设置</span>
        </button>

        <button
          className="sidebar-collapse"
          onClick={() => setSidebarCollapsed((current) => !current)}
          type="button"
          aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <div className="file-selector-anchor" onClick={(event) => event.stopPropagation()}>
              <button
                className={`icon-button${fileSelectorDisabled ? " disabled" : ""}`}
                onClick={handleOpenFileSelector}
                type="button"
                aria-label="选择文件"
                title={fileSelectorTitle}
                disabled={fileSelectorDisabled}
              >
                <Menu size={20} />
              </button>
              {showFileSelector && (
                <div className="file-selector-panel">
                  <div className="file-selector-header">
                    <h2>选择文件</h2>
                    <button className="icon-button" onClick={() => setShowFileSelector(false)} type="button">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="file-selector-list">
                    {fileListLoading && <div className="file-selector-empty">加载中...</div>}
                    {!fileListLoading && fileList.length === 0 && <div className="file-selector-empty">暂无文档</div>}
                    {!fileListLoading && fileList.map((doc) => (
                      <button
                        className="file-selector-item"
                        key={doc.id}
                        onClick={() => handleSelectFile(doc)}
                        type="button"
                      >
                        <span className="file-selector-icon">
                          <FileText size={16} />
                        </span>
                        <div className="file-selector-info">
                          <span className="file-selector-name">{doc.title || "无标题文档"}</span>
                          <span className="file-selector-meta">{doc.rag_status === "indexed" ? "已解析" : doc.rag_status === "outdated" ? "待更新" : "待解析"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="file-selector-footer">
                    <button className="file-selector-create" onClick={() => void handleCreateDocumentFromSelector()} type="button">
                      <Plus size={16} />
                      新建文档
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="doc-title">
              <strong className={activePage === "editor" && !editorTitle ? "title-untitled" : ""}>{currentPageTitle}</strong>
              {showSaveState && <span className={`saved-state ${saveState.status}`}>{saveState.label}</span>}
            </div>
          </div>

          <div className="search-box">
            <Search size={18} />
            <span>搜索文档 / 内容 / 功能</span>
            <kbd>⌘ K</kbd>
          </div>

          <div className="topbar-actions">
            <div className={`health-pill ${modelStatusClass}`} title={healthState === "online" ? "后端在线" : "后端未连接"}>
              <span className="health-dot" />
              {modelStatusText}
            </div>
          </div>
        </header>

        {pageContent}

        {activePage === "editor" && (
          <footer className="statusbar">
            <span>字数 24,515</span>
            <span>字符 312</span>
            <span>预计阅读 1 分钟</span>
            <span>Markdown</span>
            <span className="status-dot" />
          </footer>
        )}
      </main>
    </div>
  );
}
