import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, FileQuestion, FileText, Home, Languages, Menu, Search, Settings } from "lucide-react";
import { EditorPage } from "../pages/EditorPage";
import { TranslatePage } from "../pages/TranslatePage";
import { FormatPage } from "../pages/FormatPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { HomePage } from "../pages/HomePage";
import { SettingsPage } from "../pages/SettingsPage";
import { loadModelSettings } from "../services/modelSettings";
import type { StoredDocumentDetail } from "../services/api";
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

export function AppShell({ healthState }: AppShellProps) {
  const [activePage, setActivePage] = useState<NavigationKey>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modelSettings, setModelSettings] = useState(() => loadModelSettings());
  const [editorTitle, setEditorTitle] = useState("");
  const [saveState, setSaveState] = useState<{ label: string; status: "idle" | "saving" | "saved" | "failed" }>({
    label: "已保存 10:24",
    status: "saved",
  });
  const [currentDocument, setCurrentDocument] = useState<StoredDocumentDetail | null>(() => {
    const raw = window.localStorage.getItem("writerhub.currentDocument");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredDocumentDetail;
    } catch {
      return null;
    }
  });

  const modelConfigured = Boolean(
    modelSettings.apiKey.trim() && modelSettings.baseUrl.trim() && modelSettings.defaultModel.trim(),
  );

  const modelStatusClass = modelConfigured ? "online" : "offline";
  const modelStatusText = modelConfigured ? modelSettings.defaultModel : "暂未配置模型";
  const currentPageTitle = activePage === "editor" ? editorTitle || "无标题文档" : pageTitles[activePage];

  const pageContent = useMemo(() => {
    const openDocument = (document: StoredDocumentDetail, page: NavigationKey = "editor") => {
      setCurrentDocument(document);
      setEditorTitle(document.title.trim());
      window.localStorage.setItem("writerhub.currentDocument", JSON.stringify(document));
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
          documentContent={currentDocument?.content}
          documentId={currentDocument?.id}
          documentTitle={currentDocument?.title}
          onTitleChange={setEditorTitle}
          onSaveStateChange={setSaveState}
          onDocumentSaved={(document) => {
            setCurrentDocument((current) => {
              if (!current || current.id !== document.id) return current;
              const next = {
                ...current,
                title: document.title,
                content: document.content,
                last_saved_at: document.last_saved_at,
              };
              window.localStorage.setItem("writerhub.currentDocument", JSON.stringify(next));
              return next;
            });
          }}
        />
      );
    }
    if (activePage === "translate") return <TranslatePage sourceDocument={currentDocument} />;
    if (activePage === "format") return <FormatPage sourceDocument={currentDocument} />;
    if (activePage === "documents") return <DocumentsPage />;
    if (activePage === "settings") return <SettingsPage />;

    return (
      <section className="empty-workspace">
        <h2>{pageTitles[activePage]}</h2>
        <p>该页面将在后续阶段完善。</p>
      </section>
    );
  }, [activePage, currentDocument]);

  useEffect(() => {
    const refreshModelSettings = () => setModelSettings(loadModelSettings());
    window.addEventListener("storage", refreshModelSettings);
    window.addEventListener("writerhub:model-settings-saved", refreshModelSettings);
    return () => {
      window.removeEventListener("storage", refreshModelSettings);
      window.removeEventListener("writerhub:model-settings-saved", refreshModelSettings);
    };
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
            <button
              className="icon-button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              type="button"
              aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              <Menu size={20} />
            </button>
            <div className="doc-title">
              <strong className={activePage === "editor" && !editorTitle ? "title-untitled" : ""}>{currentPageTitle}</strong>
              {activePage !== "home" && <span className={`saved-state ${saveState.status}`}>{saveState.label}</span>}
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
