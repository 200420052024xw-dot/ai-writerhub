import { useMemo, useState } from "react";
import { Bell, ChevronDown, ClipboardList, Download, FileQuestion, FileText, HelpCircle, History, Languages, Menu, Search, Settings, Upload } from "lucide-react";
import { EditorPage } from "../pages/EditorPage";
import { TranslatePage } from "../pages/TranslatePage";
import { FormatPage } from "../pages/FormatPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { SettingsPage } from "../pages/SettingsPage";
import type { HealthState, NavigationKey } from "../types";

type AppShellProps = {
  healthState: HealthState;
};

const navItems = [
  { key: "editor", label: "编辑器", icon: FileText },
  { key: "translate", label: "翻译", icon: Languages },
  { key: "format", label: "格式整理", icon: ClipboardList },
  { key: "documents", label: "文档问答", icon: FileQuestion },
  { key: "export", label: "导出中心", icon: Upload },
  { key: "settings", label: "设置", icon: Settings },
] satisfies Array<{ key: NavigationKey; label: string; icon: typeof FileText }>;

const pageTitles: Record<NavigationKey, string> = {
  editor: "产品需求文档 PRD 示例",
  translate: "产品需求文档 PRD 示例",
  format: "产品需求文档 PRD 示例",
  documents: "多文档 AI 问答",
  export: "导出中心",
  settings: "模型与系统设置",
};

export function AppShell({ healthState }: AppShellProps) {
  const [activePage, setActivePage] = useState<NavigationKey>("editor");

  const pageContent = useMemo(() => {
    if (activePage === "editor") return <EditorPage />;
    if (activePage === "translate") return <TranslatePage />;
    if (activePage === "format") return <FormatPage />;
    if (activePage === "documents") return <DocumentsPage />;
    if (activePage === "settings") return <SettingsPage />;

    return (
      <section className="empty-workspace">
        <h2>{pageTitles[activePage]}</h2>
        <p>该页面将在后续阶段完善。</p>
      </section>
    );
  }, [activePage]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo-symbol" aria-hidden="true" />
          <span>文枢</span>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activePage;

            return (
              <button
                className={`nav-item ${isActive ? "active" : ""}`}
                key={item.key}
                onClick={() => setActivePage(item.key)}
                type="button"
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button className="sidebar-collapse" type="button" aria-label="收起侧边栏">
          <ChevronDown size={18} />
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button" type="button" aria-label="菜单">
              <Menu size={20} />
            </button>
            <div className="doc-title">
              <strong>{pageTitles[activePage]}</strong>
              <span className="saved-state">已保存 10:24</span>
            </div>
          </div>

          <div className="search-box">
            <Search size={18} />
            <span>搜索文档 / 内容 / 功能</span>
            <kbd>⌘ K</kbd>
          </div>

          <div className="topbar-actions">
            <div className={`health-pill ${healthState}`}>
              <span className="health-dot" />
              {healthState === "checking" && "检查中"}
              {healthState === "online" && "FastAPI 在线"}
              {healthState === "offline" && "FastAPI 离线"}
            </div>
            <button className="icon-button" type="button" aria-label="历史">
              <History size={20} />
            </button>
            <button className="icon-button" type="button" aria-label="帮助">
              <HelpCircle size={20} />
            </button>
            <button className="icon-button notification-button" type="button" aria-label="通知">
              <Bell size={20} />
            </button>
            <button className="user-button" type="button">
              <span>张小明</span>
              <ChevronDown size={16} />
            </button>
            <button className="export-button" type="button">
              <Download size={18} />
              导出
            </button>
          </div>
        </header>

        {pageContent}

        <footer className="statusbar">
          <span>字数 24,515</span>
          <span>字符 312</span>
          <span>预计阅读 1 分钟</span>
          <span>Markdown</span>
          <span className="status-dot" />
        </footer>
      </main>
    </div>
  );
}
