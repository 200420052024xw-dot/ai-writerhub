import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Search,
  ServerCog,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  adminListUsers,
  adminUpdateUserRole,
  adminUpdateUserMember,
  adminDeleteUser,
  adminGetSystemSettings,
  adminUpdateSystemSettings,
  adminTestSystemModel,
  testRagEmbedding,
  type AdminUserItem,
} from "../services/api";
import {
  MODEL_PROVIDER_PRESETS,
  VISION_MODEL_PROVIDER_PRESETS,
  type ModelProviderId,
} from "../services/modelSettings";

type TabKey = "users" | "system";

export function AdminPage() {
  const [tab, setTab] = useState<TabKey>("users");

  return (
    <section className="page admin-page">
      <div className="rag-mode-row admin-tab-switcher">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")} type="button">
          <Users size={16} />
          用户管理
        </button>
        <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")} type="button">
          <ServerCog size={16} />
          系统模型配置
        </button>
      </div>
      {tab === "users" ? <UserManagement /> : <SystemModelSettings />}
    </section>
  );
}

// ── 用户管理 ──

function UserManagement() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminUserItem | null>(null);
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminListUsers();
      setUsers(data.users);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(); }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 2000);
  };

  const handleToggleRole = async (user: AdminUserItem) => {
    setActionLoading(user.id + "-role");
    try {
      await adminUpdateUserRole(user.id, user.role === "admin" ? "user" : "admin");
      showMessage("已更新角色");
      await loadUsers();
    } catch { showMessage("操作失败"); } finally { setActionLoading(null); }
  };

  const handleToggleMember = async (user: AdminUserItem) => {
    setActionLoading(user.id + "-member");
    try {
      await adminUpdateUserMember(user.id, !user.is_member);
      showMessage(user.is_member ? "已取消会员" : "已开通会员");
      await loadUsers();
    } catch { showMessage("操作失败"); } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await adminDeleteUser(confirmDelete.id);
      setConfirmDelete(null);
      showMessage("已删除用户");
      await loadUsers();
    } catch { showMessage("删除失败"); }
  };

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.nickname.toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const formatTime = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={16} />
          <input placeholder="搜索用户名、昵称、邮箱" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="admin-toolbar-right">
          <span className="admin-count">共 {filtered.length} 位用户</span>
          <button className="admin-refresh-btn" onClick={() => void loadUsers()} type="button">刷新</button>
        </div>
      </div>

      {loading ? (
        <div className="admin-empty"><Loader2 size={24} className="spin" /><span>加载中...</span></div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty"><Users size={32} /><span>暂无用户</span></div>
      ) : (
        <div className="admin-user-list">
          {filtered.map((user) => (
            <div className="admin-user-row" key={user.id}>
              <div className="admin-user-row-left">
                <div className="admin-user-avatar">{user.nickname.charAt(0).toUpperCase()}</div>
                <div className="admin-user-detail">
                  <div className="admin-user-name-line">
                    <span className="admin-user-username">{user.username}</span>
                    <span className={`admin-role-tag ${user.role}`}>{user.role === "admin" ? "管理员" : "用户"}</span>
                    {user.is_member && <span className="admin-member-tag">会员</span>}
                  </div>
                  <div className="admin-user-sub">
                    {user.nickname}{user.email ? ` · ${user.email}` : ""} · {formatTime(user.created_at)}
                  </div>
                </div>
              </div>
              <div className="admin-user-row-right">
                <button
                  className={`admin-btn ${user.is_member ? "admin-btn-member-on" : "admin-btn-member-off"}`}
                  disabled={actionLoading === user.id + "-member"}
                  onClick={() => void handleToggleMember(user)}
                  type="button"
                >
                  <Shield size={13} />
                  {user.is_member ? "取消会员" : "开通会员"}
                </button>
                <button
                  className={`admin-btn ${user.role === "admin" ? "admin-btn-role-on" : "admin-btn-role-off"}`}
                  disabled={actionLoading === user.id + "-role"}
                  onClick={() => void handleToggleRole(user)}
                  type="button"
                >
                  {user.role === "admin" ? "取消管理员" : "设为管理员"}
                </button>
                <button className="admin-btn admin-btn-del" onClick={() => setConfirmDelete(user)} type="button">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {message && <div className="admin-toast">{message}</div>}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>删除用户</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)} type="button"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>确定要删除用户 <strong>{confirmDelete.username}</strong> 吗？该用户的所有文档和数据将被永久删除，此操作不可撤销。</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)} type="button">取消</button>
              <button className="btn-danger" onClick={() => void handleDelete()} type="button">永久删除</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── 系统模型配置 ──

function SystemModelSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);

  const [chatProvider, setChatProvider] = useState<ModelProviderId>("deepseek");
  const [chatSaved, setChatSaved] = useState(false);
  const [chatTesting, setChatTesting] = useState(false);
  const [chatTestState, setChatTestState] = useState<"idle" | "ok" | "failed">("idle");
  const [chatTestMessage, setChatTestMessage] = useState("");
  const [visionProvider, setVisionProvider] = useState<ModelProviderId>("qwen");
  const [visionSaved, setVisionSaved] = useState(false);
  const [visionTesting, setVisionTesting] = useState(false);
  const [visionTestState, setVisionTestState] = useState<"idle" | "ok" | "failed">("idle");
  const [visionTestMessage, setVisionTestMessage] = useState("");
  const [ragSaved, setRagSaved] = useState(false);
  const [ragTesting, setRagTesting] = useState(false);
  const [ragTestState, setRagTestState] = useState<"idle" | "ok" | "failed">("idle");
  const [ragTestMessage, setRagTestMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await adminGetSystemSettings();
        setSettings(data.settings);
        const baseUrl = data.settings.system_model_base_url || "";
        const matched = MODEL_PROVIDER_PRESETS.find((p) => p.baseUrl === baseUrl);
        setChatProvider(matched ? matched.id : "custom");
        const visionBaseUrl = data.settings.system_model_vision_base_url || "";
        const visionMatched = VISION_MODEL_PROVIDER_PRESETS.find((p) => p.baseUrl === visionBaseUrl);
        setVisionProvider(visionMatched ? visionMatched.id : "custom");
      } catch { setSettings({}); } finally { setLoading(false); }
    };
    void load();
  }, []);

  const get = (key: string) => settings[key] ?? "";
  const set = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const selectProvider = (id: ModelProviderId) => {
    const preset = MODEL_PROVIDER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setChatProvider(id);
    set("system_model_base_url", preset.baseUrl);
    set("system_model_name", preset.defaultModel);
    set("system_model_provider", id);
  };

  const selectVisionProvider = (id: ModelProviderId) => {
    const preset = VISION_MODEL_PROVIDER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setVisionProvider(id);
    set("system_model_vision_provider", id);
    set("system_model_vision_base_url", preset.baseUrl);
    set("system_model_vision_model", preset.visionModel);
  };

  const handleSaveChat = async () => {
    try {
      const useMain = (get("system_model_vision_use_main_config") || "1") !== "0";
      const nextSettings: Record<string, string> = {
        system_model_provider: get("system_model_provider"),
        system_model_base_url: get("system_model_base_url"),
        system_model_name: get("system_model_name"),
        ...(useMain
          ? {
              system_model_vision_use_main_config: "1",
              system_model_vision_model: get("system_model_vision_model"),
            }
          : {}),
      };
      const apiKey = get("system_model_api_key").trim();
      if (apiKey) nextSettings.system_model_api_key = apiKey;
      await adminUpdateSystemSettings(nextSettings);
      setChatSaved(true);
      window.setTimeout(() => setChatSaved(false), 1800);
    } catch { /* ignore */ }
  };

  const handleSaveVision = async () => {
    try {
      const nextSettings: Record<string, string> = {
        system_model_vision_provider: get("system_model_vision_provider"),
        system_model_vision_use_main_config: get("system_model_vision_use_main_config") || "0",
        system_model_vision_base_url: get("system_model_vision_base_url"),
        system_model_vision_model: get("system_model_vision_model"),
      };
      const apiKey = get("system_model_vision_api_key").trim();
      if (apiKey) nextSettings.system_model_vision_api_key = apiKey;
      await adminUpdateSystemSettings(nextSettings);
      setVisionSaved(true);
      window.setTimeout(() => setVisionSaved(false), 1800);
    } catch { /* ignore */ }
  };

  const handleTestVision = async () => {
    const apiKey = get("system_model_api_key");
    const useMain = (get("system_model_vision_use_main_config") || "1") !== "0";
    const visionApiKey = useMain ? apiKey : get("system_model_vision_api_key");
    const baseUrl = useMain ? get("system_model_base_url") : get("system_model_vision_base_url");
    const model = get("system_model_vision_model") || get("system_model_name");
    if (!visionApiKey.trim() || !baseUrl.trim() || !model.trim()) {
      setVisionTestState("failed"); setVisionTestMessage("请填写 API Key、Base URL 和视觉模型名称"); return;
    }
    setVisionTesting(true); setVisionTestState("idle"); setVisionTestMessage("");
    try {
      await adminTestSystemModel({ api_key: visionApiKey, base_url: baseUrl, model });
      setVisionTestState("ok"); setVisionTestMessage("连接正常");
    } catch (e) {
      setVisionTestState("failed"); setVisionTestMessage(e instanceof Error ? e.message : "连接失败");
    } finally { setVisionTesting(false); }
  };

  const handleTestChat = async () => {
    const apiKey = get("system_model_api_key"), baseUrl = get("system_model_base_url"), model = get("system_model_name");
    if (!apiKey.trim() || !baseUrl.trim() || !model.trim()) {
      setChatTestState("failed"); setChatTestMessage("请填写 API Key、Base URL 和模型名称"); return;
    }
    setChatTesting(true); setChatTestState("idle"); setChatTestMessage("");
    try {
      await adminTestSystemModel({ api_key: apiKey, base_url: baseUrl, model });
      setChatTestState("ok"); setChatTestMessage("连接正常");
    } catch (e) {
      setChatTestState("failed"); setChatTestMessage(e instanceof Error ? e.message : "连接失败");
    } finally { setChatTesting(false); }
  };

  const handleSaveRag = async () => {
    try {
      const nextSettings: Record<string, string> = {
        system_rag_embedding_source: "api",
        system_rag_base_url: get("system_rag_base_url"),
        system_rag_model: get("system_rag_model"),
        system_rag_enable_rerank: get("system_rag_rerank_model_path").trim() ? "1" : "0",
        system_rag_rerank_model_path: get("system_rag_rerank_model_path"),
      };
      const apiKey = get("system_rag_api_key").trim();
      if (apiKey) nextSettings.system_rag_api_key = apiKey;
      await adminUpdateSystemSettings(nextSettings);
      setRagSaved(true);
      window.setTimeout(() => setRagSaved(false), 1800);
    } catch { /* ignore */ }
  };

  const handleTestRag = async () => {
    const apiKey = get("system_rag_api_key"), baseUrl = get("system_rag_base_url"), model = get("system_rag_model");
    if (!apiKey.trim() || !baseUrl.trim() || !model.trim()) {
      setRagTestState("failed"); setRagTestMessage("请填写 API Key、Base URL 和模型名称"); return;
    }
    setRagTesting(true); setRagTestState("idle"); setRagTestMessage("");
    try {
      await testRagEmbedding({
        embedding_source: "api",
        local_model_path: "",
        api_key: apiKey,
        base_url: baseUrl,
        model,
        recall_strategy: "vector",
        enable_rerank: false,
        rerank_model_path: "",
      });
      setRagTestState("ok"); setRagTestMessage("连接正常");
    } catch (e) {
      setRagTestState("failed"); setRagTestMessage(e instanceof Error ? e.message : "连接失败");
    } finally { setRagTesting(false); }
  };

  if (loading) {
    return <div className="admin-empty"><Loader2 size={24} className="spin" /><span>加载中...</span></div>;
  }

  const visionUseMainConfig = (get("system_model_vision_use_main_config") || "1") !== "0";

  return (
    <div className="admin-model-scroll">
      {/* 聊天模型 */}
      <section className="admin-model-section">
        <div className="admin-model-section-head">
          <span>聊天模型</span>
          <h2>默认聊天模型、API Key 和接口地址</h2>
        </div>

        <div className="provider-grid">
          {MODEL_PROVIDER_PRESETS.map((preset) => (
            <button
              className={`provider-card ${chatProvider === preset.id ? "active" : ""}`}
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
              <input autoComplete="off" onChange={(e) => set("system_model_api_key", e.target.value)} placeholder="留空则不修改已保存 Key" type={showKey ? "text" : "password"} value={get("system_model_api_key")} />
              <button onClick={() => setShowKey((v) => !v)} type="button" aria-label="切换密钥显示">{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </label>
          <label>
            <span><ServerCog size={17} />Base URL</span>
            <input onChange={(e) => set("system_model_base_url", e.target.value)} value={get("system_model_base_url")} />
          </label>
          <label>
            <span>默认模型</span>
            <input onChange={(e) => set("system_model_name", e.target.value)} value={get("system_model_name")} />
          </label>
        </div>

        <div className="settings-actions">
          {chatSaved && <div className="save-state"><CheckCircle2 size={18} />已保存</div>}
          <button className={`settings-test-action ${chatTestState}`} disabled={chatTesting} onClick={() => void handleTestChat()} type="button">
            <PlugZap size={18} />
            {chatTesting ? "测试中..." : chatTestState === "ok" ? "连接正常" : chatTestState === "failed" ? "连接失败" : "测试连通性"}
          </button>
          <button className="settings-save-action" onClick={() => void handleSaveChat()} type="button">
            <Save size={18} />保存聊天模型设置
          </button>
        </div>
        {chatTestMessage && <div className={`settings-test-message ${chatTestState}`}>{chatTestMessage}</div>}

        <div className="settings-subsection">
          <div className="settings-subsection-head">
            <div>
              <span>视觉模型</span>
              <h3>用于文档解析和图片内容识别</h3>
            </div>
            <button
              className={`settings-chip-toggle ${visionUseMainConfig ? "active" : ""}`}
              onClick={() => set("system_model_vision_use_main_config", visionUseMainConfig ? "0" : "1")}
              type="button"
            >
              共用上方大模型 Key/地址
            </button>
          </div>

          {!visionUseMainConfig && (
            <div className="provider-grid compact">
              {VISION_MODEL_PROVIDER_PRESETS.map((preset) => (
                <button
                  className={`provider-card ${visionProvider === preset.id ? "active" : ""}`}
                  key={preset.id}
                  onClick={() => selectVisionProvider(preset.id)}
                  type="button"
                >
                  <strong>{preset.name}</strong>
                  <span>{preset.note}</span>
                </button>
              ))}
            </div>
          )}

          <div className="settings-form">
            {!visionUseMainConfig && (
              <>
                <label>
                  <span><KeyRound size={17} />视觉 API Key</span>
                  <div className="secret-input">
                    <input autoComplete="off" onChange={(e) => set("system_model_vision_api_key", e.target.value)} placeholder="留空则不修改已保存 Key" type={showKey ? "text" : "password"} value={get("system_model_vision_api_key")} />
                    <button onClick={() => setShowKey((v) => !v)} type="button" aria-label="切换视觉密钥显示">{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                </label>
                <label>
                  <span><ServerCog size={17} />视觉 Base URL</span>
                  <input
                    onChange={(e) => {
                      setVisionProvider("custom");
                      set("system_model_vision_base_url", e.target.value);
                    }}
                    value={get("system_model_vision_base_url")}
                  />
                </label>
              </>
            )}
            <label>
              <span>视觉模型名称</span>
              <input onChange={(e) => set("system_model_vision_model", e.target.value)} placeholder="只填写视觉模型名称" value={get("system_model_vision_model")} />
            </label>
          </div>

          {!visionUseMainConfig && (
            <>
              <div className="settings-actions">
                {visionSaved && <div className="save-state"><CheckCircle2 size={18} />已保存</div>}
                <button className={`settings-test-action ${visionTestState}`} disabled={visionTesting} onClick={() => void handleTestVision()} type="button">
                  <PlugZap size={18} />
                  {visionTesting ? "测试中..." : visionTestState === "ok" ? "连接正常" : visionTestState === "failed" ? "连接失败" : "测试视觉模型"}
                </button>
                <button className="settings-save-action" onClick={() => void handleSaveVision()} type="button">
                  <Save size={18} />保存视觉模型设置
                </button>
              </div>
              {visionTestMessage && <div className={`settings-test-message ${visionTestState}`}>{visionTestMessage}</div>}
            </>
          )}
        </div>
      </section>

      {/* 向量模型 */}
      <section className="admin-model-section">
        <div className="admin-model-section-head">
          <span>向量模型</span>
          <h2>Embedding API 配置</h2>
        </div>

        <div className="settings-form">
          <label>
            <span><KeyRound size={17} />Embedding API Key</span>
            <input autoComplete="off" onChange={(e) => set("system_rag_api_key", e.target.value)} placeholder="留空则不修改已保存 Key" type="password" value={get("system_rag_api_key")} />
          </label>
          <label>
            <span><ServerCog size={17} />Embedding Base URL</span>
            <input onChange={(e) => set("system_rag_base_url", e.target.value)} placeholder="https://api.example.com/v1" value={get("system_rag_base_url")} />
          </label>
          <label>
            <span>Embedding 模型名</span>
            <input onChange={(e) => set("system_rag_model", e.target.value)} placeholder="text-embedding-..." value={get("system_rag_model")} />
          </label>
          <label>
            <span>Reranker 模型名（可选）</span>
            <input onChange={(e) => set("system_rag_rerank_model_path", e.target.value)} placeholder="Qwen/Qwen3-Reranker-8B" value={get("system_rag_rerank_model_path")} />
          </label>
        </div>

        <div className="settings-actions">
          {ragSaved && <div className="save-state"><CheckCircle2 size={18} />已保存</div>}
          <button className={`settings-test-action ${ragTestState}`} disabled={ragTesting} onClick={() => void handleTestRag()} type="button">
            <PlugZap size={18} />
            {ragTesting ? "测试中..." : ragTestState === "ok" ? "连接正常" : ragTestState === "failed" ? "连接失败" : "测试连通性"}
          </button>
          <button className="settings-save-action" onClick={() => void handleSaveRag()} type="button">
            <Save size={18} />保存向量模型设置
          </button>
        </div>
        {ragTestMessage && <div className={`settings-test-message ${ragTestState}`}>{ragTestMessage}</div>}
      </section>
    </div>
  );
}
