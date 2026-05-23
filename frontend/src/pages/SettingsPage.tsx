import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Save, ServerCog } from "lucide-react";
import {
  loadModelSettings,
  MODEL_PROVIDER_PRESETS,
  saveModelSettings,
  type ModelProviderId,
  type ModelSettings,
} from "../services/modelSettings";

export function SettingsPage() {
  const [settings, setSettings] = useState<ModelSettings>(() => loadModelSettings());
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const activePreset = useMemo(
    () => MODEL_PROVIDER_PRESETS.find((preset) => preset.id === settings.providerId) ?? MODEL_PROVIDER_PRESETS[0],
    [settings.providerId],
  );

  const selectProvider = (providerId: ModelProviderId) => {
    const preset = MODEL_PROVIDER_PRESETS.find((item) => item.id === providerId);
    if (!preset) return;

    setSettings((current) => ({
      ...current,
      providerId,
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
    }));
  };

  const updateField = (field: keyof ModelSettings, value: string) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
      providerId: field === "baseUrl" || field === "defaultModel" ? "custom" : current.providerId,
    }));
  };

  const save = () => {
    saveModelSettings(settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section className="page settings-page">
      <div className="settings-layout">
        <article className="panel settings-main">
          <div className="settings-heading">
            <div>
              <span>AI 模型配置</span>
              <h2>配置默认模型、API Key 和接口地址</h2>
            </div>
            {saved && (
              <div className="save-state">
                <CheckCircle2 size={18} />
                已保存
              </div>
            )}
          </div>

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
              <span>
                <KeyRound size={17} />
                API Key
              </span>
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
              <span>
                <ServerCog size={17} />
                Base URL
              </span>
              <input
                onChange={(event) => updateField("baseUrl", event.target.value)}
                placeholder="https://api.example.com/v1"
                value={settings.baseUrl}
              />
            </label>

            <label>
              <span>默认模型</span>
              <input
                onChange={(event) => updateField("defaultModel", event.target.value)}
                placeholder="例如 deepseek-chat / qwen-plus / glm-4-plus"
                value={settings.defaultModel}
              />
            </label>
          </div>

          <div className="settings-actions">
            <button className="primary-action" onClick={save} type="button">
              <Save size={18} />
              保存配置
            </button>
            <span>当前选择：{activePreset.name}</span>
          </div>
        </article>

        <aside className="panel settings-side">
          <h2>配置说明</h2>
          <p>API Key 当前只保存在浏览器本地存储中，用于前端配置预留；后续接真实 AI 时，建议由 FastAPI 后端统一读取、加密保存或通过环境变量管理。</p>
          <div className="settings-note">
            <strong>建议</strong>
            <p>生产环境不要让前端直接调用模型厂商接口，避免 API Key 暴露。前端只提交任务，后端负责调用模型。</p>
          </div>
          <div className="settings-note">
            <strong>兼容接口</strong>
            <p>预设厂商按 OpenAI-compatible Chat Completions 形态规划，后续 AI 服务层可复用同一套 Base URL、API Key、Model 配置。</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
