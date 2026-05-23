import { FileDown, Printer, RotateCcw, Sparkles } from "lucide-react";

const formatCards = [
  ["字体", "宋体（SimSun）"],
  ["字号", "小四（12pt）"],
  ["行距", "1.5 倍行距"],
  ["段落缩进", "首行缩进 2 字符"],
  ["对齐方式", "两端对齐"],
  ["标题样式", "黑体，三号，加粗"],
  ["页边距", "上 2.54cm 下 2.54cm"],
  ["页眉", "左：产品需求文档"],
  ["页脚", "第 {page} 页 / 共 {total} 页"],
];

export function FormatPage() {
  return (
    <section className="page format-page">
      <div className="format-layout">
        <article className="panel format-config">
          <h2>一句话整理格式 + 导出</h2>
          <label className="instruction-box">
            <span>用一句话描述你想要的格式效果</span>
            <textarea defaultValue="正文宋体小四，1.5 倍行距，首行缩进两字符，标题黑体三号，加页眉页脚" />
          </label>
          <div className="button-row">
            <button className="primary-action" type="button">
              <Sparkles size={18} />
              智能解析
            </button>
            <button className="primary-action" type="button">应用格式</button>
            <button type="button">
              <RotateCcw size={18} />
              重置
            </button>
          </div>
          <h3>解析出的格式配置</h3>
          <div className="format-card-grid">
            {formatCards.map(([title, value]) => (
              <div className="format-card" key={title}>
                <span>{title}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="range-box">
            <label>
              <input defaultChecked name="range" type="radio" />
              全文档
            </label>
            <label>
              <input name="range" type="radio" />
              选择范围
            </label>
          </div>
        </article>

        <article className="panel paper-preview">
          <div className="paper-toolbar">
            <button type="button">‹</button>
            <strong>1 / 24</strong>
            <button type="button">›</button>
            <span>100%</span>
          </div>
          <div className="paper">
            <header>
              <span>产品需求文档</span>
              <span>文枢 AI WriterHub</span>
            </header>
            <h1>文枢 AI WriterHub 产品需求文档</h1>
            <h2>1. 项目背景</h2>
            <p>文枢 AI WriterHub 是一款面向开发者与内容创作者的智能文档编辑器，集成 AI 能力，提升写作、编辑与协作效率。</p>
            <h2>2. 核心功能</h2>
            <ul>
              <li>AI 智能写作辅助与改写</li>
              <li>多语言翻译与润色</li>
              <li>导出为多种格式</li>
            </ul>
            <footer>第 1 页 / 共 24 页</footer>
          </div>
        </article>

        <aside className="side-panel panel">
          <div className="panel-title">
            <FileDown size={20} />
            <h2>导出与操作</h2>
          </div>
          <button className="export-docx" type="button">导出 Word</button>
          <button className="export-pdf" type="button">导出 PDF</button>
          <button className="assist-action" type="button">
            <Printer size={16} />
            打印预览
          </button>
          <div className="history-list">
            <strong>格式变更记录</strong>
            <p>10:24 智能解析格式</p>
            <p>10:24 应用格式</p>
            <p>10:20 重置格式</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
