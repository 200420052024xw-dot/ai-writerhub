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
};

export type TranslationChunk = {
  index: number;
  source: string;
  target: string;
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

export async function translateText(payload: {
  source_text: string;
  direction: TranslationDirection;
  display_mode: TranslationDisplayMode;
  options: TranslationOptions;
  glossary?: GlossaryEntry[];
  ai_config?: AIModelConfig;
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
  | { type: "chunk"; index: number; source: string; target: string }
  | { type: "complete"; target_text: string; context_summary: string; chunks: TranslationChunk[] }
  | { type: "error"; message: string };

export async function translateTextStream(
  payload: {
    source_text: string;
    direction: TranslationDirection;
    display_mode: TranslationDisplayMode;
    options: TranslationOptions;
    glossary?: GlossaryEntry[];
    ai_config?: AIModelConfig;
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
  ai_config?: AIModelConfig;
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
    throw new Error("Model connection test failed");
  }
}

export type StoredDocumentSummary = {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  uploaded_at: string;
  updated_at: string;
  parse_method: "vision" | "manual";
};

export type StoredDocumentDetail = StoredDocumentSummary & {
  content: string;
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
}): Promise<StoredDocumentDetail> {
  const response = await fetch(`${API_BASE_URL}/api/documents/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Document create failed");
  }
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
