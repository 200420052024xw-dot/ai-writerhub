import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Check,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileSpreadsheet,
  FileText,
  History,
  Send,
  SlidersHorizontal,
} from "lucide-react";

type DocumentRow = {
  name: string;
  meta: string;
  status: "已解析" | "待更新";
  icon: LucideIcon;
  color: string;
};

const docs: DocumentRow[] = [
  { name: "项目需求说明.pdf", meta: "2.4 MB · 12 页", status: "已解析", icon: FileArchive, color: "#e11d48" },
  { name: "课程报告.docx", meta: "1.1 MB · 28 页", status: "已解析", icon: FileText, color: "#2563eb" },
  { name: "会议纪要.md", meta: "320 KB · 8 页", status: "待更新", icon: FileText, color: "#94a3b8" },
  { name: "用户调研.xlsx", meta: "860 KB · 5 页", status: "已解析", icon: FileSpreadsheet, color: "#16a34a" },
  { name: "产品路线图.pdf", meta: "1.6 MB · 9 页", status: "已解析", icon: FileArchive, color: "#e11d48" },
];

const historyChats = [
  { title: "各文档核心功能共同点与差异", time: "2 分钟前" },
  { title: "用户调研中提到的主要痛点", time: "昨天 14:30" },
  { title: "产品路线图的关键里程碑", time: "昨天 10:15" },
];

const searchResults = [
  { name: "项目需求说明.pdf", score: 0.92, color: "#e11d48" },
  { name: "课程报告.docx", score: 0.85, color: "#2563eb" },
  { name: "用户调研.xlsx", score: 0.72, color: "#16a34a" },
  { name: "产品路线图.pdf", score: 0.43, color: "#e11d48" },
  { name: "会议纪要.md", score: 0.28, color: "#94a3b8" },
];

export function DocumentsPage() {
  const [showDocLibrary, setShowDocLibrary] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(
    new Set([0, 1, 3])
  );

  const toggleDoc = (index: number) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith(".pdf")) return { icon: FileArchive, color: "#e11d48" };
    if (name.endsWith(".docx") || name.endsWith(".doc")) return { icon: FileText, color: "#2563eb" };
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) return { icon: FileSpreadsheet, color: "#16a34a" };
    return { icon: FileText, color: "#64748b" };
  };

  return (
    <section className="page documents-page">
      <div className="documents-layout">
        <article className="panel qa-panel">
          <div className="qa-controls">
            <div className="qa-controls-left">
              <div className="doc-select-wrapper">
                <button
                  className="doc-select-btn"
                  onClick={() => setShowDocLibrary(!showDocLibrary)}
                  type="button"
                >
                  <SlidersHorizontal size={15} />
                  选择文档
                  <span className="doc-count">{selectedDocs.size}/{docs.length}</span>
                </button>
                {showDocLibrary && (
                  <div className="doc-dropdown">
                    <div className="doc-dropdown-header">
                      <span>解析后的文档才会参与问答，待更新文档需重新解析</span>
                    </div>
                    <div className="doc-dropdown-list">
                      {docs.map((doc, index) => {
                        const Icon = doc.icon;
                        const isOutdated = doc.status === "待更新";
                        const isSelected = selectedDocs.has(index);
                        return (
                          <label
                            className={`doc-dropdown-item${isOutdated ? " outdated" : ""}${isSelected ? " selected" : ""}`}
                            key={doc.name}
                            onClick={(e) => { e.stopPropagation(); if (!isOutdated) toggleDoc(index); }}
                          >
                            <span className="doc-icon" style={{ background: `${doc.color}14`, color: doc.color }}>
                              <Icon size={16} />
                            </span>
                            <div className="doc-info">
                              <span className="doc-name">{doc.name}</span>
                              <span className="doc-meta">{doc.meta}</span>
                            </div>
                            {isOutdated ? (
                              <span className="status-outdated">
                                <Clock3 size={12} />
                                待更新
                              </span>
                            ) : (
                              <span className="status-parsed">
                                <Check size={12} />
                                已解析
                              </span>
                            )}
                            <span className={`custom-checkbox${isSelected ? " checked" : ""}`}>
                              {isSelected && <Check size={12} />}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="doc-dropdown-footer">
                      已选择 {selectedDocs.size} / {docs.length} 个文档
                    </div>
                  </div>
                )}
              </div>
              <label className="only-selected-label">
                <input type="checkbox" />
                仅当前选中文档
              </label>
            </div>
            <button className="save-chat-top-btn" type="button">
              <Bookmark size={14} />
              保存对话
            </button>
          </div>

          <div className="chat-area">
            <div className="chat-message user">
              <span className="chat-avatar">Q</span>
              <div className="chat-bubble">请总结各文档中关于核心功能的共同点，并指出差异。</div>
            </div>
            <div className="chat-message ai">
              <span className="chat-avatar">AI</span>
              <div className="chat-bubble">
                <p>基于所选文档，关于"核心功能"的共同点与差异如下：</p>
                <p><strong>1. 共同点</strong></p>
                <ul>
                  <li>
                    均强调智能编辑能力，包括文本生成、改写、润色等
                    <span className="citation">来源：项目需求说明.pdf 第 3 页</span>
                  </li>
                  <li>
                    支持多格式内容处理与导出
                    <span className="citation">来源：课程报告.docx 第 5 页</span>
                  </li>
                </ul>
                <p><strong>2. 差异</strong></p>
                <ul>
                  <li>项目需求说明更侧重版本管理与权限控制。</li>
                  <li>用户调研更关注操作便捷性与模板丰富度。</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="ask-box">
            <input type="text" placeholder="输入你的问题，基于已解析文档进行问答..." />
            <button type="button">
              <Send size={16} />
              发送
            </button>
          </div>
        </article>

        <aside className="side-panel panel">
          <div className="side-section">
            <div className="panel-title">
              <History size={18} />
              <h2>历史对话</h2>
            </div>
            <div className="history-list">
              {historyChats.map((chat) => (
                <div className="history-item" key={chat.title}>
                  <span className="history-title">{chat.title}</span>
                  <span className="history-time">{chat.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="side-divider" />

          <div className="side-section">
            <div className="panel-title">
              <CheckCircle2 size={18} />
              <h2>检索结果 Top 5</h2>
            </div>
            <div className="search-result-list">
              {searchResults.map((result) => {
                const { icon: FileIcon, color } = getFileIcon(result.name);
                return (
                  <div className="search-result" key={result.name}>
                    <div className="search-result-left">
                      <span className="search-file-icon" style={{ background: `${color}14`, color }}>
                        <FileIcon size={14} />
                      </span>
                      <span className="search-file-name">{result.name}</span>
                    </div>
                    <span className="search-score">相关度 {result.score.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
