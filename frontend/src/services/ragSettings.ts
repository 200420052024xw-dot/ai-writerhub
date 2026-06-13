export type EmbeddingSource = "local" | "api";
export type RecallStrategy = "vector" | "hybrid";
export type RagProviderId = "siliconflow" | "volcengine" | "custom";

export type RagProviderPreset = {
  id: RagProviderId;
  name: string;
  baseUrl: string;
  defaultModel: string;
  note: string;
};

export type RagSettings = {
  embeddingSource: EmbeddingSource;
  providerId: RagProviderId;
  localModelPath: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  recallStrategy: RecallStrategy;
  enableRerank: boolean;
  rerankModelPath: string;
};

export const RAG_PROVIDER_PRESETS: RagProviderPreset[] = [
  {
    id: "siliconflow",
    name: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1/embeddings",
    defaultModel: "Qwen/Qwen3-VL-Embedding-8B",
    note: "SiliconFlow 官方接口",
  },
  {
    id: "volcengine",
    name: "火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-embedding-vision-251215",
    note: "火山方舟官方接口",
  },
  {
    id: "custom",
    name: "自定义",
    baseUrl: "",
    defaultModel: "",
    note: "手动填写 Base URL 和模型名称",
  },
];

const STORAGE_KEY = "ragSettings";

export const DEFAULT_RAG_SETTINGS: RagSettings = {
  embeddingSource: "local",
  providerId: "siliconflow",
  localModelPath: "F:\\hf_cache\\model",
  apiKey: "",
  baseUrl: "https://api.siliconflow.cn/v1/embeddings",
  model: "Qwen/Qwen3-VL-Embedding-8B",
  recallStrategy: "vector",
  enableRerank: false,
  rerankModelPath: "Qwen/Qwen3-Reranker-8B",
};

export function loadRagSettings(): RagSettings {
  const raw = userStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_RAG_SETTINGS;
  try {
    const settings = { ...DEFAULT_RAG_SETTINGS, ...JSON.parse(raw) } as RagSettings;
    if (settings.providerId === "siliconflow" && settings.model === "Qwen/Qwen3-Embedding-8B") {
      settings.model = "Qwen/Qwen3-VL-Embedding-8B";
    }
    if (settings.providerId === "siliconflow" && settings.baseUrl === "https://api.siliconflow.cn/v1") {
      settings.baseUrl = "https://api.siliconflow.cn/v1/embeddings";
    }
    return settings;
  } catch {
    return DEFAULT_RAG_SETTINGS;
  }
}

export function saveRagSettings(settings: RagSettings) {
  userStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function toRagRuntimeConfig(settings: RagSettings, useSystemModel = false) {
  return {
    embedding_source: settings.embeddingSource,
    local_model_path: settings.localModelPath,
    api_key: settings.apiKey,
    base_url: settings.baseUrl,
    model: settings.model,
    use_system_model: useSystemModel,
    recall_strategy: settings.recallStrategy,
    enable_rerank: settings.enableRerank,
    rerank_model_path: settings.rerankModelPath,
  };
}
import { userStorage } from "./userStorage";

