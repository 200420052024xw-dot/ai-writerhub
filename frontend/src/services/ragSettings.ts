export type EmbeddingSource = "local" | "api";
export type RecallStrategy = "vector" | "hybrid";

export type RagSettings = {
  embeddingSource: EmbeddingSource;
  localModelPath: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  recallStrategy: RecallStrategy;
  enableRerank: boolean;
  rerankModelPath: string;
};

const STORAGE_KEY = "ragSettings";

export const DEFAULT_RAG_SETTINGS: RagSettings = {
  embeddingSource: "local",
  localModelPath: "F:\\hf_cache\\model",
  apiKey: "",
  baseUrl: "",
  model: "",
  recallStrategy: "vector",
  enableRerank: false,
  rerankModelPath: "F:\\hf_cache\\models--Qwen--Qwen3-Reranker-0.6B\\snapshots\\e61197ed45024b0ed8a2d74b80b4d909f1255473",
};

export function loadRagSettings(): RagSettings {
  const raw = userStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_RAG_SETTINGS;
  try {
    return { ...DEFAULT_RAG_SETTINGS, ...JSON.parse(raw) } as RagSettings;
  } catch {
    return DEFAULT_RAG_SETTINGS;
  }
}

export function saveRagSettings(settings: RagSettings) {
  userStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function toRagRuntimeConfig(settings: RagSettings) {
  return {
    embedding_source: settings.embeddingSource,
    local_model_path: DEFAULT_RAG_SETTINGS.localModelPath,
    api_key: settings.apiKey,
    base_url: settings.baseUrl,
    model: settings.model,
    recall_strategy: settings.recallStrategy,
    enable_rerank: settings.enableRerank,
    rerank_model_path: settings.rerankModelPath,
  };
}
import { userStorage } from "./userStorage";
