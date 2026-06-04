export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
};

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error("Health check failed");
  }

  return response.json();
}

export type MarkdownDetectResponse = {
  is_markdown: boolean;
  features: string[];
  score: number;
};

export async function detectMarkdown(content: string): Promise<MarkdownDetectResponse> {
  const response = await fetch(`${API_BASE_URL}/api/markdown/detect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error("Markdown detection failed");
  }

  return response.json();
}

export type TranslationDirection = "zh-en" | "en-zh";
export type TranslationDisplayMode = "split" | "paragraph" | "sentence";
export type TranslationStyle = "default" | "academic" | "business" | "natural";

export type GlossaryEntry = {
  source: string;
  target: string;
};

export type TranslationOptions = {
  style: TranslationStyle;
  unified_terms: boolean;
  preserve_names: boolean;
  custom_requirements: string;
};

export type AIModelConfig = {
  api_key: string;
  base_url: string;
  model: string;
};

export type TranslationPair = {
  source: string;
  target: string;
  paragraph_id?: string | null;
  sentence_index?: number | null;
};

export type TranslationSourceParagraph = {
  id: string;
  type: "title" | "heading" | "paragraph" | "list" | "table";
  level: number;
  content: string;
};

export type TranslationChunk = {
  index: number;
  source: string;
  target: string;
  paragraph_pairs: TranslationPair[];
  sentence_pairs: TranslationPair[];
};

export type TranslationResponse = {
  source_text: string;
  target_text: string;
  direction: TranslationDirection;
  display_mode: TranslationDisplayMode;
  context_summary: string;
  used_context_summary: boolean;
  chunk_count: number;
  chunks: TranslationChunk[];
  paragraph_pairs: TranslationPair[];
  sentence_pairs: TranslationPair[];
  applied_options: TranslationOptions;
};

export type DocumentTranslationState = {
  document_id: string;
  source_text: string;
  target_text: string;
  direction: TranslationDirection;
  display_mode: TranslationDisplayMode;
  context_summary: string;
  used_context_summary: boolean;
  chunks: TranslationChunk[];
  paragraph_pairs: TranslationPair[];
  sentence_pairs: TranslationPair[];
  options: TranslationOptions;
  updated_at: string | null;
};

export async function translateText(payload: {
  source_text: string;
  source_paragraphs: TranslationSourceParagraph[];
  direction: TranslationDirection;
  display_mode: TranslationDisplayMode;
  options: TranslationOptions;
  glossary?: GlossaryEntry[];
  ai_config: AIModelConfig;
}): Promise<TranslationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Translation failed");
  }

  return response.json();
}

export type TranslationStreamEvent =
  | { type: "start"; total_chunks: number; used_context: boolean }
  | { type: "context_summary"; summary: string }
  | { type: "chunk"; index: number; source: string; target: string; paragraph_pairs?: TranslationPair[]; sentence_pairs?: TranslationPair[] }
  | { type: "complete"; target_text: string; context_summary: string; chunks: TranslationChunk[]; paragraph_pairs?: TranslationPair[]; sentence_pairs?: TranslationPair[] }
  | { type: "error"; message: string };

export async function translateTextStream(
  payload: {
    source_text: string;
    source_paragraphs: TranslationSourceParagraph[];
    direction: TranslationDirection;
    display_mode: TranslationDisplayMode;
    options: TranslationOptions;
    glossary?: GlossaryEntry[];
    ai_config: AIModelConfig;
  },
  onEvent: (event: TranslationStreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/translate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error("Translation stream failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data) as TranslationStreamEvent;
        onEvent(parsed);
      } catch {
        // ignore malformed events
      }
    }
  }
}

export type ExtractTermsResponse = {
  terms: GlossaryEntry[];
};

export async function extractTerms(payload: {
  source_text: string;
  direction: TranslationDirection;
  ai_config: AIModelConfig;
}): Promise<ExtractTermsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/translate/extract-terms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Term extraction failed");
  }

  return response.json();
}

export async function getDocumentTranslationState(documentId: string): Promise<DocumentTranslationState | null> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/translation-state`);
  if (!response.ok) {
    throw new Error(await response.text() || "Translation state load failed");
  }
  return response.json();
}

export async function saveDocumentTranslationState(
  documentId: string,
  payload: Omit<DocumentTranslationState, "document_id" | "updated_at">,
): Promise<DocumentTranslationState> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/translation-state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text() || "Translation state save failed");
  }
  return response.json();
}

export type FormatConfig = {
  font: string;
  fontSize: string;
  lineHeight: string;
  indent: string;
  align: string;
  paperSize: string;
  headingStyle: string;
  margin: string;
  header: string;
  footer: string;
  extraRequirements: string;
};

export type FormatDocumentBlock = {
  type: "heading1" | "heading2" | "paragraph" | "bullet";
  text: string;
};

export async function parseFormatPrompt(payload: {
  api_key: string;
  base_url: string;
  model: string;
  prompt: string;
  current_config: FormatConfig;
}): Promise<{ config: FormatConfig }> {
  const response = await fetch(`${API_BASE_URL}/api/format/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Format parse failed");
  }

  return response.json();
}

export async function exportFormatDocx(payload: {
  title: string;
  blocks: FormatDocumentBlock[];
  config: FormatConfig;
}): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/format/export/docx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Word export failed");
  }

  return response.blob();
}

export async function organizeFormat(payload: {
  text: string;
  config: FormatConfig;
  api_key: string;
  base_url: string;
  model: string;
}): Promise<{ blocks: FormatDocumentBlock[] }> {
  const response = await fetch(`${API_BASE_URL}/api/format/organize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Format organize failed");
  }

  return response.json();
}

export async function testFormatModel(payload: {
  api_key: string;
  base_url: string;
  model: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/format/test-model`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Model connection test failed";
    try {
      const data = await response.json();
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
    } catch {
      message = await response.text();
    }
    throw new Error(message || "Model connection test failed");
  }
}

export type StoredDocumentSummary = {
  id: string;
  title: string;
  content_hash: string;
  rag_status: "not_indexed" | "indexed" | "outdated" | "indexing" | "failed";
  last_saved_at: string;
  last_indexed_at: string | null;
};

export type StoredDocumentParagraph = {
  id: string;
  document_id?: string | null;
  paragraph_index: number;
  type: "title" | "heading" | "paragraph" | "list" | "table";
  level: number;
  content: string;
  content_hash: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StoredDocumentParagraphInput = {
  id?: string | null;
  type: StoredDocumentParagraph["type"];
  level: number;
  content: string;
};

export type StoredDocumentDetail = StoredDocumentSummary & {
  content: string;
  paragraphs: StoredDocumentParagraph[];
  glossary: GlossaryEntry[];
};

export async function listStoredDocuments(): Promise<{ documents: StoredDocumentSummary[] }> {
  const response = await fetch(`${API_BASE_URL}/api/documents`);
  if (!response.ok) {
    throw new Error("Document list failed");
  }
  return response.json();
}

export async function getStoredDocument(documentId: string): Promise<StoredDocumentDetail> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`);
  if (!response.ok) {
    throw new Error("Document detail failed");
  }
  return response.json();
}

export async function createStoredDocument(payload: {
  title: string;
  content?: string;
  glossary?: GlossaryEntry[];
}): Promise<StoredDocumentDetail> {
  const response = await fetch(`${API_BASE_URL}/api/documents/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text() || "Document create failed");
  }
  return response.json();
}

export async function saveStoredDocument(
  documentId: string,
  payload: {
    title?: string;
    content?: string;
    glossary?: GlossaryEntry[];
  },
): Promise<StoredDocumentDetail> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text() || "Document save failed");
  }
  return response.json();
}

export async function saveStoredDocumentParagraphs(
  documentId: string,
  paragraphs: StoredDocumentParagraphInput[],
): Promise<StoredDocumentDetail> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/paragraphs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paragraphs }),
  });
  if (!response.ok) {
    throw new Error(await response.text() || "Document paragraphs save failed");
  }
  return response.json();
}

export async function indexStoredDocument(documentId: string): Promise<StoredDocumentDetail> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/index`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Document index failed");
  }
  return response.json();
}

export type RagRuntimeConfig = {
  embedding_source: "local" | "api";
  local_model_path: string;
  api_key: string;
  base_url: string;
  model: string;
  recall_strategy: "vector" | "hybrid";
  enable_rerank: boolean;
  rerank_model_path: string;
};

export type RagSearchResult = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  paragraph_id?: string | null;
  paragraph_index?: number | null;
  chunk_index: number;
  content: string;
  score: number;
  source: string;
};

export type RagStreamEvent =
  | { type: "retrieval"; results: RagSearchResult[] }
  | { type: "chunk"; content: string }
  | { type: "complete" };

export type ChatMessageRecord = {
  role: string;
  content: string;
};

export type KnowledgeConversation = {
  id: string;
  title: string;
  document_ids: string[];
  messages: ChatMessageRecord[];
  search_results: RagSearchResult[];
  turn_search_results: RagSearchResult[][];
  created_at: string;
  updated_at: string;
};

export async function listKnowledgeConversations(): Promise<{ conversations: KnowledgeConversation[] }> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge/conversations`);
  if (!response.ok) throw new Error("Knowledge conversation list failed");
  return response.json();
}

export async function createKnowledgeConversation(payload: {
  title: string;
  document_ids: string[];
  messages: ChatMessageRecord[];
  search_results: RagSearchResult[];
  turn_search_results?: RagSearchResult[][];
}): Promise<KnowledgeConversation> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text() || "Knowledge conversation create failed");
  return response.json();
}

export async function updateKnowledgeConversationContent(
  conversationId: string,
  payload: {
    title?: string;
    document_ids: string[];
    messages: ChatMessageRecord[];
    search_results: RagSearchResult[];
    turn_search_results?: RagSearchResult[][];
  },
): Promise<KnowledgeConversation> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge/conversations/${conversationId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text() || "Knowledge conversation update failed");
  return response.json();
}

export async function renameKnowledgeConversation(conversationId: string, title: string): Promise<KnowledgeConversation> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error(await response.text() || "Knowledge conversation rename failed");
  return response.json();
}

export async function deleteKnowledgeConversation(conversationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/knowledge/conversations/${conversationId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await response.text() || "Knowledge conversation delete failed");
}

export async function getDocumentAssistantHistory(documentId: string): Promise<{ messages: ChatMessageRecord[] }> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/assistant-history`);
  if (!response.ok) throw new Error(await response.text() || "Assistant history load failed");
  return response.json();
}

export async function saveDocumentAssistantHistory(documentId: string, messages: ChatMessageRecord[]): Promise<{ messages: ChatMessageRecord[] }> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/assistant-history`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) throw new Error(await response.text() || "Assistant history save failed");
  return response.json();
}

export async function indexStoredDocumentWithRag(documentId: string, ragConfig: RagRuntimeConfig): Promise<StoredDocumentDetail> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rag_config: ragConfig }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function queryRagStream(
  payload: {
    question: string;
    document_ids: string[];
    rag_config: RagRuntimeConfig;
    chat_config: AIModelConfig;
  },
  onEvent: (event: RagStreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/rag/query/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok || !response.body) {
    throw new Error(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      onEvent(JSON.parse(data) as RagStreamEvent);
    }
  }
}

export async function deleteStoredDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Document delete failed");
  }
}

export async function uploadStoredDocument(payload: {
  file: File;
  api_key: string;
  base_url: string;
  model: string;
}): Promise<StoredDocumentDetail> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("api_key", payload.api_key);
  formData.append("base_url", payload.base_url);
  formData.append("model", payload.model);

  const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Document upload failed");
  }
  return response.json();
}
