export type KnowledgeSaveSettings = {
  includeSearchResults: boolean;
  includeTimestamp: boolean;
  includeSourceTitle: boolean;
};

const STORAGE_KEY = "knowledgeSaveSettings";

export const DEFAULT_KNOWLEDGE_SAVE_SETTINGS: KnowledgeSaveSettings = {
  includeSearchResults: true,
  includeTimestamp: true,
  includeSourceTitle: true,
};

export function loadKnowledgeSaveSettings(): KnowledgeSaveSettings {
  const raw = userStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_KNOWLEDGE_SAVE_SETTINGS;
  try {
    return { ...DEFAULT_KNOWLEDGE_SAVE_SETTINGS, ...JSON.parse(raw) } as KnowledgeSaveSettings;
  } catch {
    return DEFAULT_KNOWLEDGE_SAVE_SETTINGS;
  }
}

export function saveKnowledgeSaveSettings(settings: KnowledgeSaveSettings) {
  userStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
import { userStorage } from "./userStorage";
