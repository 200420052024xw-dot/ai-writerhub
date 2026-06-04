import { useState } from "react";
import { CheckCircle2, ChevronDown, Database, Eye, EyeOff, KeyRound, PlugZap, Save, ServerCog } from "lucide-react";
import { testFormatModel } from "../services/api";
import { loadRagSettings, saveRagSettings, type RagSettings } from "../services/ragSettings";
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
  const [showKey, setShowKey] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [ragSaved, setRagSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<"idle" | "ok" | "failed">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [ragTesting, setRagTesting] = useState(false);
  const [ragTestState, setRagTestState] = useState<"idle" | "ok" | "failed">("idle");
  const [ragTestMessage, setRagTestMessage] = useState("");
  const [aiOpen, setAiOpen] = useState(true);
  const [ragOpen, setRagOpen] = useState(true);

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
    </section>
  );
}
