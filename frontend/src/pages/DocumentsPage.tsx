import type { LucideIcon } from "lucide-react";
import { CheckCircle2, FileArchive, FileSpreadsheet, FileText, Send, Upload } from "lucide-react";

type DocumentRow = {
  name: string;
  meta: string;
  status: string;
  icon: LucideIcon;
};

const docs: DocumentRow[] = [
  { name: "项目需求说明.pdf", meta: "2.4 MB · 12 页", status: "已解析", icon: FileArchive },
  { name: "课程报告.docx", meta: "1.1 MB · 28 页", status: "已解析", icon: FileText },
  { name: "会议纪要.md", meta: "320 KB · 8 页", status: "建立索引中 63%", icon: FileText },
  { name: "用户调研.xlsx", meta: "860 KB · 5 页", status: "可检索", icon: FileSpreadsheet },
  { name: "产品路线图.pdf", meta: "1.6 MB · 9 页", status: "可检索", icon: FileArchive },
];

export function DocumentsPage() {
  return (
    <section className="page documents-page">
      <div className="documents-layout">
        <aside className="panel doc-library">
          <h2>文档库</h2>
          <button className="upload-box" type="button">
            <Upload size={20} />
            上传文档
            <span>支持 PDF、Word、Markdown、Excel 等</span>
          </button>
          <div className="doc-list">
            {docs.map((doc, index) => {
              const Icon = doc.icon;

              return (
              <div className="doc-row" key={doc.name}>
                <Icon size={24} />
                <div>
                  <strong>{doc.name}</strong>
                  <span>{doc.meta}</span>
                </div>
                <em>{doc.status}</em>
                <input defaultChecked={index < 3} type="checkbox" />
              </div>
              );
            })}
          </div>
          <footer>已选择 3 / 5 个文档</footer>
        </aside>

        <article className="panel qa-panel">
          <div className="qa-controls">
            <button type="button">全部文档</button>
            <label>
              <input type="checkbox" />
              仅当前选中文档
            </label>
            <button type="button">按相关度排序</button>
          </div>
          <div className="chat-message user">请总结各文档中关于核心功能的共同点，并指出差异。</div>
          <div className="chat-message ai">
            <strong>基于所选文档，关于“核心功能”的共同点与差异如下：</strong>
            <h3>1. 共同点</h3>
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
            <h3>2. 差异</h3>
            <ul>
              <li>项目需求说明更侧重版本管理与权限控制。</li>
              <li>用户调研更关注操作便捷性与模板丰富度。</li>
            </ul>
          </div>
          <div className="ask-box">
            <span>继续提问（Shift + Enter 换行，Enter 发送）</span>
            <Send size={18} />
          </div>
        </article>

        <aside className="side-panel panel">
          <div className="panel-title">
            <CheckCircle2 size={20} />
            <h2>检索结果 Top 5</h2>
          </div>
          {docs.slice(0, 5).map((doc, index) => (
            <div className="search-result" key={doc.name}>
              <strong>{doc.name}</strong>
              <span>相关度 {(0.92 - index * 0.13).toFixed(2)}</span>
            </div>
          ))}
          <div className="snippet-list">
            <strong>引用片段</strong>
            <p>核心功能包括：智能编辑、内容生成与改写、多格式导出、版本管理与协同编辑...</p>
            <p>平台应具备文本润色、结构优化、学术引文推荐等智能编辑能力...</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
