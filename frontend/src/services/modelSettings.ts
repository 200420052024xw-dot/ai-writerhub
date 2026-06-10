export type ModelProviderId = "openai" | "deepseek" | "qwen" | "zhipu" | "volcengine" | "moonshot" | "xiaomi" | "minimax" | "custom";

export type ModelProviderPreset = {
  id: ModelProviderId;
  name: string;
  baseUrl: string;
  defaultModel: string;
  visionModel: string;
  note: string;
};

export type ModelSettings = {
  providerId: ModelProviderId;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  visionModel: string;
  useSystemModel: boolean;
};

export const MODEL_PROVIDER_PRESETS: ModelProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.5",
    visionModel: "gpt-5.5",
    note: "OpenAI 官方接口",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    visionModel: "deepseek-chat",
    note: "DeepSeek 官方接口",
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    visionModel: "qwen-vl-max",
    note: "阿里云官方接口",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-5.1",
    visionModel: "glm-5v-flash",
    note: "智谱官方接口",
  },
  {
    id: "volcengine",
    name: "火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-2-0-pro-260215",
    visionModel: "doubao-seed-2-0-pro-260215",
    note: "火山方舟官方接口",
  },
  {
    id: "xiaomi",
    name: "Xiaomi MiMo",
    baseUrl: "https://api.xiaomimimo.com/v1",
    defaultModel: "mimo-v2.5-pro",
    visionModel: "mimo-v2.5-pro",
    note: "Xiaomi MiMo 官方接口",
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimaxi.com/v1",
    defaultModel: "MiniMax-M2.7",
    visionModel: "MiniMax-M2.7",
    note: "MiniMax 官方接口",
  },
  {
    id: "custom",
    name: "自定义",
    baseUrl: "",
    defaultModel: "",
    visionModel: "",
    note: "手动填写 Base URL 和模型名称",
  },
];

const STORAGE_KEY = "modelSettings";

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  providerId: "deepseek",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  defaultModel: "deepseek-chat",
  visionModel: "deepseek-chat",
  useSystemModel: false,
};

export function loadModelSettings(): ModelSettings {
  const raw = userStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_MODEL_SETTINGS;

  try {
    return { ...DEFAULT_MODEL_SETTINGS, ...JSON.parse(raw) } as ModelSettings;
  } catch {
    return DEFAULT_MODEL_SETTINGS;
  }
}

export function saveModelSettings(settings: ModelSettings) {
  userStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("writerhub:model-settings-saved"));
}
import { userStorage } from "./userStorage";
