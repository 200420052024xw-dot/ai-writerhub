const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

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

export type TranslationOptions = {
  academic_style: boolean;
  business_style: boolean;
  natural_tone: boolean;
  unified_terms: boolean;
  preserve_names: boolean;
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
