import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Database, Eye, EyeOff, KeyRound, PlugZap, RotateCcw, Save, ServerCog, Trash2, X } from "lucide-react";
import { listTrashedDocuments, restoreDocument, permanentDeleteDocument, type TrashedDocument, testFormatModel } from "../services/api";
import { loadRagSettings, saveRagSettings, type RagSettings } from "../services/ragSettings";
import { loadKnowledgeSaveSettings, saveKnowledgeSaveSettings, type KnowledgeSaveSettings } from "../services/knowledgeSaveSettings";
import {
  loadModelSettings,
  MODEL_PROVIDER_PRESETS,
  saveModelSettings,
  type ModelProviderId,
  type ModelSettings,
} from "../services/modelSettings";

export function SettingsPage() {
  const [settings, setSettings] = useState<ModelSettings>(() => loadModelSettings());
  const [ragSettings, setRagSettings] = useState<RagSettings>(() => loadRagSettings());
  const [kbSaveSettings, setKbSaveSettings] = useState<KnowledgeSaveSettings>(() => loadKnowledgeSaveSettings());
  const [showKey, setShowKey] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [ragSaved, setRagSaved] = useState(false);
  const [kbSaveOpen, setKbSaveOpen] = useState(false);
  const [kbSaveSaved, setKbSaveSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<"idle" | "ok" | "failed">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [ragTesting, setRagTesting] = useState(false);
  const [ragTestState, setRagTestState] = useState<"idle" | "ok" | "failed">("idle");
  const [ragTestMessage, setRagTestMessage] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [ragOpen, setRagOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashDocs, setTrashDocs] = useState<TrashedDocument[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashMessage, setTrashMessage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selectProvider = (providerId: ModelProviderId) => {
    const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === providerId);
    if (!preset) return;
    setSettings((current) => ({ ...current, providerId, baseUrl: preset.baseUrl, defaultModel: preset.defaultModel }));
  };

  const updateField = (field: keyof ModelSettings, value: string) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
      providerId: field === "baseUrl" || field === "defaultModel" ? "custom" : current.providerId,
    }));
  };

  const updateRagField = <K extends keyof RagSettings>(field: K, value: RagSettings[K]) => {
    setRagSettings((current) => ({ ...current, [field]: value }));
  };

  const updateKbSaveField = <K extends keyof KnowledgeSaveSettings>(field: K, value: KnowledgeSaveSettings[K]) => {
    setKbSaveSettings((current) => ({ ...current, [field]: value }));
  };

  const saveKbSave = () => {
    saveKnowledgeSaveSettings(kbSaveSettings);
    setKbSaveSaved(true);
    window.setTimeout(() => setKbSaveSaved(false), 1800);
  };

  const saveAi = () => {
    saveModelSettings(settings);
    setAiSaved(true);
    window.setTimeout(() => setAiSaved(false), 1800);
  };

  const saveRag = () => {
    saveRagSettings(ragSettings);
    setRagSaved(true);
    window.setTimeout(() => setRagSaved(false), 1800);
  };

  const testConnection = async () => {
    if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.defaultModel.trim()) {
      setTestState("failed");
      setTestMessage("请填写 API Key、Base URL 和模型名称");
      return;
    }
    setTesting(true);
    setTestState("idle");
    setTestMessage("");
    try {
      await testFormatModel({ api_key: settings.apiKey, base_url: settings.baseUrl, model: settings.defaultModel });
      setTestState("ok");
      setTestMessage("连接正常");
    } catch (error) {
      setTestState("failed");
      setTestMessage(error instanceof Error ? error.message : "连接失败");
    } finally {
      setTesting(false);
    }
  };

  const testRagConnection = async () => {
    if (!ragSettings.apiKey.trim() || !ragSettings.baseUrl.trim() || !ragSettings.model.trim()) {
      setRagTestState("failed");
      setRagTestMessage("请填写 API Key、Base URL 和模型名称");
      return;
    }
    setRagTesting(true);
    setRagTestState("idle");
    setRagTestMessage("");
    try {
      await testFormatModel({ api_key: ragSettings.apiKey, base_url: ragSettings.baseUrl, model: ragSettings.model });
      setRagTestState("ok");
      setRagTestMessage("连接正常");
    } catch (error) {
      setRagTestState("failed");
      setRagTestMessage(error instanceof Error ? error.message : "连接失败");
    } finally {
      setRagTesting(false);
    }
  };

  const loadTrash = async () => {
    setTrashLoading(true);
    try {
      const result = await listTrashedDocuments();
      setTrashDocs(result.documents);
    } catch {
      setTrashDocs([]);
    } finally {
      setTrashLoading(false);
    }
  };

  useEffect(() => {
    if (trashOpen) void loadTrash();
  }, [trashOpen]);

  const handleRestore = async (documentId: string) => {
    try {
      await restoreDocument(documentId);
      setTrashMessage("已恢复");
      window.setTimeout(() => setTrashMessage(""), 2000);
      await loadTrash();
    } catch {
      setTrashMessage("恢复失败");
    }
  };

  const handlePermanentDelete = async (documentId: string) => {
    try {
      await permanentDeleteDocument(documentId);
      setConfirmDeleteId(null);
      setTrashMessage("已永久删除");
      window.setTimeout(() => setTrashMessage(""), 2000);
      await loadTrash();
    } catch {
      setTrashMessage("删除失败");
    }
  };

  const formatTrashTime = (value: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const daysRemaining = (deletedAt: string | null) => {
    if (!deletedAt) return 0;
    const deleted = new Date(deletedAt).getTime();
    const elapsed = Date.now() - deleted;
    const remaining = 15 - Math.floor(elapsed / 86400000);
    return Math.max(0, remaining);
  };

  return (
    <section className="page settings-page">
      <div className="settings-layout">
        <article className="panel settings-main">
          <section className={`settings-collapse ${aiOpen ? "open" : ""}`}>
            <button className="settings-collapse-head" onClick={() => setAiOpen((open) => !open)} type="button">
              <div>
                <span>大模型设置</span>
                <h2>默认聊天模型、API Key 和接口地址</h2>
              </div>
              <ChevronDown size={18} />
            </button>

            {aiOpen && (
              <>
                <div className="provider-grid">
                  {MODEL_PROVIDER_PRESETS.map((preset) => (
                    <button
                      className={`provider-card ${settings.providerId === preset.id ? "active" : ""}`}
                      key={preset.id}
                      onClick={() => selectProvider(preset.id)}
                      type="button"
                    >
                      <strong>{preset.name}</strong>
                      <span>{preset.note}</span>
                    </button>
                  ))}
                </div>

                <div className="settings-form">
                  <label>
                    <span><KeyRound size={17} />API Key</span>
                    <div className="secret-input">
                      <input
                        autoComplete="off"
                        onChange={(event) => updateField("apiKey", event.target.value)}
                        placeholder="sk-..."
                        type={showKey ? "text" : "password"}
                        value={settings.apiKey}
                      />
                      <button onClick={() => setShowKey((value) => !value)} type="button" aria-label="切换密钥显示">
                        {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                  <label>
                    <span><ServerCog size={17} />Base URL</span>
                    <input onChange={(event) => updateField("baseUrl", event.target.value)} value={settings.baseUrl} />
                  </label>
                  <label>
                    <span>默认模型</span>
                    <input onChange={(event) => updateField("defaultModel", event.target.value)} value={settings.defaultModel} />
                  </label>
                </div>

                <div className="settings-actions">
                  {aiSaved && <div className="save-state"><CheckCircle2 size={18} />已保存</div>}
                  <button className={`settings-test-action ${testState}`} disabled={testing} onClick={() => void testConnection()} type="button">
                    <PlugZap size={18} />
                    {testing ? "测试中..." : testState === "ok" ? "连接正常" : testState === "failed" ? "连接失败" : "测试连通性"}
                  </button>
                  <button className="settings-save-action" onClick={saveAi} type="button">
                    <Save size={18} />
                    保存大模型设置
                  </button>
                </div>
                {testMessage && <div className={`settings-test-message ${testState}`}>{testMessage}</div>}
              </>
            )}
          </section>

          <section className={`settings-collapse rag-settings-section ${ragOpen ? "open" : ""}`}>
            <button className="settings-collapse-head" onClick={() => setRagOpen((open) => !open)} type="button">
              <div>
                <span>RAG 设置</span>
                <h2>向量化、召回策略和重排</h2>
              </div>
              <ChevronDown size={18} />
            </button>

            {ragOpen && (
              <>
                <div className="rag-mode-row">
                  <button className={ragSettings.embeddingSource === "local" ? "active" : ""} onClick={() => updateRagField("embeddingSource", "local")} type="button">
                    <Database size={16} />
                    默认模型
                  </button>
                  <button className={ragSettings.embeddingSource === "api" ? "active" : ""} onClick={() => updateRagField("embeddingSource", "api")} type="button">
                    <ServerCog size={16} />
                    API 模型
                  </button>
                </div>

                {ragSettings.embeddingSource === "api" && (
                  <div className="settings-form">
                    <label>
                      <span>Embedding API Key</span>
                      <input onChange={(event) => updateRagField("apiKey", event.target.value)} placeholder="sk-..." type="password" value={ragSettings.apiKey} />
                    </label>
                    <label>
                      <span>Embedding Base URL</span>
                      <input onChange={(event) => updateRagField("baseUrl", event.target.value)} placeholder="https://api.example.com/v1" value={ragSettings.baseUrl} />
                    </label>
                    <label>
                      <span>Embedding 模型名</span>
                      <input onChange={(event) => updateRagField("model", event.target.value)} placeholder="text-embedding-..." value={ragSettings.model} />
                    </label>
                  </div>
                )}

                <div className="rag-recall-options">
                  <span>召回策略</span>
                  <div>
                    <button
                      className={ragSettings.recallStrategy === "vector" ? "active" : ""}
                      onClick={() => updateRagField("recallStrategy", "vector")}
                      type="button"
                    >
                      默认召回
                    </button>
                    <button
                      className={ragSettings.recallStrategy === "hybrid" ? "active" : ""}
                      onClick={() => updateRagField("recallStrategy", "hybrid")}
                      type="button"
                    >
                      BM25 + Vector 混合召回
                    </button>
                  </div>
                </div>

                <label className="rag-switch-row">
                  <span>启用重排 Rerank</span>
                  <button
                    className={`switch-control ${ragSettings.enableRerank ? "on" : ""}`}
                    onClick={() => updateRagField("enableRerank", !ragSettings.enableRerank)}
                    type="button"
                    aria-pressed={ragSettings.enableRerank}
                  >
                    <span />
                  </button>
                </label>

                <div className="settings-actions">
                  {ragSaved && <div className="save-state"><CheckCircle2 size={18} />已保存</div>}
                  {ragSettings.embeddingSource === "api" && (
                    <button className={`settings-test-action ${ragTestState}`} disabled={ragTesting} onClick={() => void testRagConnection()} type="button">
                      <PlugZap size={18} />
                      {ragTesting ? "测试中..." : ragTestState === "ok" ? "连接正常" : ragTestState === "failed" ? "连接失败" : "测试连通性"}
                    </button>
                  )}
                  <button className="settings-save-action" onClick={saveRag} type="button">
                    <Save size={18} />
                    保存 RAG 设置
                  </button>
                </div>
                {ragTestMessage && <div className={`settings-test-message ${ragTestState}`}>{ragTestMessage}</div>}
              </>
            )}
          </section>

          <section className={`settings-collapse ${kbSaveOpen ? "open" : ""}`}>
            <button className="settings-collapse-head" onClick={() => setKbSaveOpen((open) => !open)} type="button">
              <div>
                <span>知识库保存</span>
                <h2>对话保存为文档时包含的内容</h2>
              </div>
              <ChevronDown size={18} />
            </button>

            {kbSaveOpen && (
              <>
                <label className="rag-switch-row">
                  <span>包含检索来源</span>
                  <button
                    className={`switch-control ${kbSaveSettings.includeSearchResults ? "on" : ""}`}
                    onClick={() => updateKbSaveField("includeSearchResults", !kbSaveSettings.includeSearchResults)}
                    type="button"
                    aria-pressed={kbSaveSettings.includeSearchResults}
                  >
                    <span />
                  </button>
                </label>

                <label className="rag-switch-row">
                  <span>包含时间戳</span>
                  <button
                    className={`switch-control ${kbSaveSettings.includeTimestamp ? "on" : ""}`}
                    onClick={() => updateKbSaveField("includeTimestamp", !kbSaveSettings.includeTimestamp)}
                    type="button"
                    aria-pressed={kbSaveSettings.includeTimestamp}
                  >
                    <span />
                  </button>
                </label>

                <label className="rag-switch-row">
                  <span>包含来源文档标题</span>
                  <button
                    className={`switch-control ${kbSaveSettings.includeSourceTitle ? "on" : ""}`}
                    onClick={() => updateKbSaveField("includeSourceTitle", !kbSaveSettings.includeSourceTitle)}
                    type="button"
                    aria-pressed={kbSaveSettings.includeSourceTitle}
                  >
                    <span />
                  </button>
                </label>

                <div className="settings-actions">
                  {kbSaveSaved && <div className="save-state"><CheckCircle2 size={18} />已保存</div>}
                  <button className="settings-save-action" onClick={saveKbSave} type="button">
                    <Save size={18} />
                    保存设置
                  </button>
                </div>
              </>
            )}
          </section>

          <section className={`settings-collapse ${trashOpen ? "open" : ""}`}>
            <button className="settings-collapse-head" onClick={() => setTrashOpen((open) => !open)} type="button">
              <div>
                <span>回收站</span>
                <h2>已删除的文档，保留 15 天后自动清除</h2>
              </div>
              <ChevronDown size={18} />
            </button>

            {trashOpen && (
              <>
                {trashLoading ? (
                  <div className="trash-empty">加载中...</div>
                ) : trashDocs.length === 0 ? (
                  <div className="trash-empty">回收站为空</div>
                ) : (
                  <div className="trash-list">
                    {trashDocs.map((doc) => (
                      <div className="trash-item" key={doc.id}>
                        <div className="trash-item-info">
                          <span className="trash-item-title">{doc.title || "无标题文档"}</span>
                          <span className="trash-item-meta">
                            删除于 {formatTrashTime(doc.deleted_at)} · 剩余 {daysRemaining(doc.deleted_at)} 天
                          </span>
                        </div>
                        <div className="trash-item-actions">
                          <button className="trash-restore-btn" onClick={() => void handleRestore(doc.id)} type="button" title="恢复">
                            <RotateCcw size={14} />
                            恢复
                          </button>
                          <button className="trash-delete-btn" onClick={() => setConfirmDeleteId(doc.id)} type="button" title="永久删除">
                            <Trash2 size={14} />
                            永久删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {trashMessage && <div className="trash-message">{trashMessage}</div>}
              </>
            )}
          </section>
        </article>

        <aside className="panel settings-side">
          <section className="settings-collapse open">
            <button className="settings-collapse-head" type="button">
              <div>
                <span>配置说明</span>
                <h2>模型与 RAG 运行说明</h2>
              </div>
            </button>
            <p>大模型设置用于聊天、翻译、格式解析等生成任务；RAG 设置只影响知识库索引与检索。</p>
            <div className="settings-note">
              <strong>默认模型</strong>
              <p>RAG 默认向量模型使用本地缓存，不需要填写路径或 API Key。</p>
            </div>
            <div className="settings-note">
              <strong>API 模型</strong>
              <p>选择 API 模型时，需要填写 Embedding API Key、Base URL 和模型名。</p>
            </div>
          </section>
        </aside>
      </div>

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>永久删除</h3>
              <button className="modal-close" onClick={() => setConfirmDeleteId(null)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>确定要永久删除该文档吗？此操作不可撤销。</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)} type="button">
                取消
              </button>
              <button className="btn-danger" onClick={() => void handlePermanentDelete(confirmDeleteId)} type="button">
                永久删除
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
