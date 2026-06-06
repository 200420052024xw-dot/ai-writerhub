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
export type TranslationGranularity = "paragraph" | "sentence";
export type TranslationJobStatus = "queued" | "running" | "completed" | "failed" | "interrupted";
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

export type TranslationVersion = {
  document_id: string;
  direction: TranslationDirection;
  granularity: TranslationGranularity;
  source_text: string;
  source_hash: string;
  current_source_hash: string;
  is_stale: boolean;
  target_text: string;
  context_summary: string;
  used_context_summary: boolean;
  chunks: TranslationChunk[];
  paragraph_pairs: TranslationPair[];
  sentence_pairs: TranslationPair[];
  options: TranslationOptions;
  updated_at: string;
};

export type TranslationJob = {
  id: string;
  document_id: string;
  direction: TranslationDirection;
  granularity: TranslationGranularity;
  status: TranslationJobStatus;
  total_chunks: number;
  completed_chunks: number;
  error: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type TranslationWorkspace = {
  versions: TranslationVersion[];
  jobs: TranslationJob[];
};

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

export async function getTranslationWorkspace(documentId: string): Promise<TranslationWorkspace> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/translation-workspace`);
  if (!response.ok) throw new Error(await response.text() || "Translation workspace load failed");
  return response.json();
}

export async function getActiveTranslationJobs(): Promise<TranslationJob[]> {
  const response = await fetch(`${API_BASE_URL}/api/translation-jobs`);
  if (!response.ok) throw new Error(await response.text() || "Translation jobs load failed");
  return response.json();
}

export async function createTranslationJob(
  documentId: string,
  payload: {
    direction: TranslationDirection;
    granularity: TranslationGranularity;
    options: TranslationOptions;
    glossary?: GlossaryEntry[];
    ai_config: AIModelConfig;
  },
): Promise<TranslationJob> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/translation-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text() || "Translation job creation failed");
  return response.json();
}

export async function getTranslationPreview(
  documentId: string,
  granularity: TranslationGranularity,
): Promise<{ granularity: TranslationGranularity; pairs: TranslationPair[] }> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/translation-preview/${granularity}`);
  if (!response.ok) throw new Error(await response.text() || "Translation preview load failed");
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

export type FormatDocumentParagraph = {
  paragraph_id: string;
  type: "title" | "heading" | "paragraph" | "list" | "table";
  level: number;
  content: string;
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
  paragraphs: FormatDocumentParagraph[];
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
  paragraphs: FormatDocumentParagraph[];
  config: FormatConfig;
  api_key: string;
  base_url: string;
  model: string;
}): Promise<{ paragraphs: FormatDocumentParagraph[] }> {
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
  language: "zh" | "en";
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
  language?: "zh" | "en";
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
    language?: "zh" | "en";
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

export type TrashedDocument = StoredDocumentSummary & { deleted_at: string | null };

export async function listTrashedDocuments(): Promise<{ documents: TrashedDocument[] }> {
  const response = await fetch(`${API_BASE_URL}/api/documents/trash`);
  if (!response.ok) throw new Error("Failed to list trash");
  return response.json();
}

export async function restoreDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/restore`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Restore failed");
}

export async function permanentDeleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/permanent`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Permanent delete failed");
}

export async function purgeTrash(): Promise<{ purged: number }> {
  const response = await fetch(`${API_BASE_URL}/api/documents/trash/purge`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Purge failed");
  return response.json();
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
