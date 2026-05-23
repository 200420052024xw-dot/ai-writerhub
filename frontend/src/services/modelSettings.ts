export type ModelProviderId = "openai" | "deepseek" | "qwen" | "zhipu" | "volcengine" | "moonshot" | "custom";

export type ModelProviderPreset = {
  id: ModelProviderId;
  name: string;
  baseUrl: string;
  defaultModel: string;
  note: string;
};

export type ModelSettings = {
  providerId: ModelProviderId;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
};

export const MODEL_PROVIDER_PRESETS: ModelProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    note: "OpenAI 官方接口",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    note: "DeepSeek OpenAI-compatible 接口",
  },
  {
    id: "qwen",
    name: "通义千问 DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    note: "阿里云 DashScope 兼容 OpenAI 模式",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    note: "智谱开放平台 OpenAI-compatible 接口",
  },
  {
    id: "volcengine",
    name: "火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6",
    note: "火山方舟 OpenAI-compatible 接口",
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    note: "Moonshot OpenAI-compatible 接口",
  },
  {
    id: "custom",
    name: "自定义",
    baseUrl: "",
    defaultModel: "",
    note: "手动填写 Base URL 和模型名称",
  },
];

const STORAGE_KEY = "writerhub.modelSettings";

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  providerId: "deepseek",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  defaultModel: "deepseek-chat",
};

export function loadModelSettings(): ModelSettings {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_MODEL_SETTINGS;

  try {
    return { ...DEFAULT_MODEL_SETTINGS, ...JSON.parse(raw) } as ModelSettings;
  } catch {
    return DEFAULT_MODEL_SETTINGS;
  }
}

export function saveModelSettings(settings: ModelSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
