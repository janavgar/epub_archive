import fs from "node:fs";
import path from "node:path";

export interface ProviderPreset {
  id: string;
  name: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  local: boolean;
  description: string;
  placeholderChatModel: string;
  placeholderEmbeddingModel: string;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  lm_studio: {
    id: "lm_studio",
    name: "LM Studio",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresApiKey: false,
    local: true,
    description: "Servidor local LM Studio (puerto 1234)",
    placeholderChatModel: "Ej: qwen2.5-7b-instruct",
    placeholderEmbeddingModel: "Ej: text-embedding-nomic-embed-text-v1.5",
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    defaultBaseUrl: "http://localhost:11434/v1",
    requiresApiKey: false,
    local: true,
    description: "Servidor local Ollama (puerto 11434)",
    placeholderChatModel: "Ej: llama3.2, qwen2.5, mistral",
    placeholderEmbeddingModel: "Ej: nomic-embed-text, mxbai-embed-large",
  },
  llamacpp: {
    id: "llamacpp",
    name: "llama.cpp",
    defaultBaseUrl: "http://localhost:8080/v1",
    requiresApiKey: false,
    local: true,
    description: "Servidor local llama-server / llama.cpp (puerto 8080)",
    placeholderChatModel: "Modelo cargado en llama-server",
    placeholderEmbeddingModel: "Modelo de embeddings en llama-server",
  },
  vllm: {
    id: "vllm",
    name: "vLLM / LocalAI",
    defaultBaseUrl: "http://localhost:8000/v1",
    requiresApiKey: false,
    local: true,
    description: "Servidor local vLLM o LocalAI (puerto 8000)",
    placeholderChatModel: "Ej: meta-llama/Llama-3.1-8B-Instruct",
    placeholderEmbeddingModel: "Ej: BAAI/bge-m3",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
    local: false,
    description: "API oficial de OpenAI (GPT-4o, text-embedding-3)",
    placeholderChatModel: "Ej: gpt-4o-mini, gpt-4o",
    placeholderEmbeddingModel: "Ej: text-embedding-3-small",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    requiresApiKey: true,
    local: false,
    description: "API de Google Gemini compatible con OpenAI",
    placeholderChatModel: "Ej: gemini-2.5-flash",
    placeholderEmbeddingModel: "Ej: text-embedding-004",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    local: false,
    description: "Pasarela multi-modelo OpenRouter / Groq",
    placeholderChatModel: "Ej: anthropic/claude-3.5-haiku",
    placeholderEmbeddingModel: "Ej: openai/text-embedding-3-small",
  },
  custom: {
    id: "custom",
    name: "Personalizado (OpenAI Compatible)",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresApiKey: false,
    local: false,
    description: "Cualquier endpoint compatible con el estándar OpenAI /v1",
    placeholderChatModel: "ID del modelo de chat",
    placeholderEmbeddingModel: "ID del modelo de embeddings",
  },
};

export interface AIConfig {
  provider: string;
  base_url: string;
  api_key: string;
  chat_model: string;
  embedding_model: string;
  separate_embedding: boolean;
  embedding_provider: string;
  embedding_base_url: string;
  embedding_api_key: string;
  timeout: number;
}

const CONFIG_PATH = path.resolve(process.cwd(), "..", ".epub_archive", "ai_config.json");
const EMBED_KEYWORDS = ["embed", "embedding", "nomic", "bge", "minilm", "e5", "mxbai", "arctic-embed", "jina-embeddings"];

export function normalizeBaseUrl(baseUrl: string, provider: string = "lm_studio"): string {
  let cleaned = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!cleaned) {
    const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.lm_studio;
    cleaned = preset.defaultBaseUrl.replace(/\/+$/, "");
  }

  try {
    const parsed = new URL(cleaned);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.pathname === "" || parsed.pathname === "/") &&
      ["lm_studio", "ollama", "llamacpp", "vllm", "openai"].includes(provider)
    ) {
      cleaned = `${cleaned}/v1`;
    }
  } catch {
    // Keep as-is if invalid URL
  }
  return cleaned;
}

export function inferProviderFromUrl(baseUrl: string): string {
  const lower = (baseUrl || "").toLowerCase();
  if (lower.includes(":1234")) return "lm_studio";
  if (lower.includes(":11434") || lower.includes("ollama")) return "ollama";
  if (lower.includes(":8080")) return "llamacpp";
  if (lower.includes(":8000")) return "vllm";
  if (lower.includes("api.openai.com")) return "openai";
  if (lower.includes("generativelanguage.googleapis.com")) return "gemini";
  if (lower.includes("openrouter.ai")) return "openrouter";
  return "custom";
}

export function loadAIConfig(): AIConfig {
  let fileData: Partial<AIConfig> = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        fileData = parsed;
      }
    }
  } catch (err) {
    console.warn("No se pudo leer ai_config.json:", err);
  }

  const envProvider = (process.env.AI_PROVIDER || "").trim();
  const envBaseUrl = (process.env.AI_BASE_URL || "").trim();
  const envApiKey = (
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
  const envChatModel = (process.env.AI_CHAT_MODEL || "").trim();
  const envEmbModel = (process.env.AI_EMBEDDING_MODEL || "").trim();
  const envEmbProvider = (process.env.AI_EMBEDDING_PROVIDER || "").trim();
  const envEmbBaseUrl = (process.env.AI_EMBEDDING_BASE_URL || "").trim();
  const envEmbApiKey = (process.env.AI_EMBEDDING_API_KEY || "").trim();

  const legacyBaseUrl = (process.env.LM_STUDIO_BASE_URL || process.env.OLLAMA_BASE_URL || "").trim();
  const legacyChatModel = (process.env.LM_STUDIO_CHAT_MODEL || "").trim();
  const legacyEmbModel = (process.env.LM_STUDIO_EMBEDDING_MODEL || "").trim();

  let provider = envProvider || fileData.provider || "";
  let baseUrl = envBaseUrl || fileData.base_url || legacyBaseUrl || "";

  if (!provider) {
    provider = baseUrl ? inferProviderFromUrl(baseUrl) : "lm_studio";
  }
  if (!PROVIDER_PRESETS[provider]) {
    provider = "custom";
  }
  if (!baseUrl) {
    baseUrl = PROVIDER_PRESETS[provider].defaultBaseUrl;
  }
  baseUrl = normalizeBaseUrl(baseUrl, provider);

  const separateEmbedding = Boolean(
    fileData.separate_embedding || envEmbProvider || envEmbBaseUrl
  );

  let embProvider = envEmbProvider || fileData.embedding_provider || provider;
  if (!PROVIDER_PRESETS[embProvider]) {
    embProvider = "custom";
  }
  let embBaseUrl = envEmbBaseUrl || fileData.embedding_base_url || "";
  if (separateEmbedding && !embBaseUrl) {
    embBaseUrl = PROVIDER_PRESETS[embProvider].defaultBaseUrl;
  }
  if (embBaseUrl) {
    embBaseUrl = normalizeBaseUrl(embBaseUrl, embProvider);
  }

  return {
    provider,
    base_url: baseUrl,
    api_key: envApiKey || fileData.api_key || "",
    chat_model: envChatModel || fileData.chat_model || legacyChatModel || "",
    embedding_model: envEmbModel || fileData.embedding_model || legacyEmbModel || "",
    separate_embedding: separateEmbedding,
    embedding_provider: embProvider,
    embedding_base_url: embBaseUrl,
    embedding_api_key: envEmbApiKey || fileData.embedding_api_key || "",
    timeout: Number(fileData.timeout) || 120,
  };
}

export function saveAIConfig(input: Partial<AIConfig>): AIConfig {
  const current = loadAIConfig();
  let provider = (input.provider ?? current.provider).trim();
  if (!PROVIDER_PRESETS[provider]) {
    provider = "custom";
  }

  const rawBaseUrl =
    input.base_url !== undefined
      ? input.base_url.trim()
      : provider !== current.provider
      ? PROVIDER_PRESETS[provider].defaultBaseUrl
      : current.base_url;
  const baseUrl = normalizeBaseUrl(rawBaseUrl, provider);

  const separateEmbedding =
    input.separate_embedding !== undefined
      ? Boolean(input.separate_embedding)
      : current.separate_embedding;

  let embProvider = (
    input.embedding_provider !== undefined
      ? input.embedding_provider
      : current.embedding_provider || provider
  ).trim();
  if (!PROVIDER_PRESETS[embProvider]) {
    embProvider = "custom";
  }

  const rawEmbUrl =
    input.embedding_base_url !== undefined
      ? input.embedding_base_url.trim()
      : embProvider !== current.embedding_provider
      ? PROVIDER_PRESETS[embProvider].defaultBaseUrl
      : current.embedding_base_url || PROVIDER_PRESETS[embProvider].defaultBaseUrl;
  const embBaseUrl = separateEmbedding ? normalizeBaseUrl(rawEmbUrl, embProvider) : "";

  const updated: AIConfig = {
    provider,
    base_url: baseUrl,
    api_key: input.api_key !== undefined ? input.api_key.trim() : current.api_key,
    chat_model: input.chat_model !== undefined ? input.chat_model.trim() : current.chat_model,
    embedding_model:
      input.embedding_model !== undefined ? input.embedding_model.trim() : current.embedding_model,
    separate_embedding: separateEmbedding,
    embedding_provider: embProvider,
    embedding_base_url: embBaseUrl,
    embedding_api_key:
      input.embedding_api_key !== undefined
        ? input.embedding_api_key.trim()
        : current.embedding_api_key,
    timeout: Number(input.timeout) || current.timeout || 120,
  };

  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  return updated;
}

export function buildCliAIArgs(cfg?: AIConfig): string[] {
  const config = cfg || loadAIConfig();
  const args: string[] = [
    "--provider",
    config.provider,
    "--base-url",
    config.base_url,
  ];
  if (config.api_key) {
    args.push("--api-key", config.api_key);
  }
  if (config.chat_model) {
    args.push("--chat-model", config.chat_model);
  }
  if (config.embedding_model) {
    args.push("--embedding-model", config.embedding_model);
  }
  if (config.separate_embedding && config.embedding_base_url) {
    args.push("--embedding-provider", config.embedding_provider);
    args.push("--embedding-base-url", config.embedding_base_url);
    if (config.embedding_api_key) {
      args.push("--embedding-api-key", config.embedding_api_key);
    }
  }
  return args;
}

function getCandidateUrls(baseUrl: string): string[] {
  const candidates = [baseUrl];
  try {
    if (fs.existsSync("/.dockerenv")) {
      if (baseUrl.includes("localhost")) {
        candidates.push(baseUrl.replace("localhost", "host.docker.internal"));
      } else if (baseUrl.includes("127.0.0.1")) {
        candidates.push(baseUrl.replace("127.0.0.1", "host.docker.internal"));
      }
    }
  } catch {}
  return candidates;
}

export async function probeEndpointModels(options: {
  baseUrl: string;
  provider: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<{
  online: boolean;
  models: string[];
  chatModels: string[];
  embeddingModels: string[];
  recommendedChatModel: string | null;
  recommendedEmbeddingModel: string | null;
  error?: string;
}> {
  const normalizedUrl = normalizeBaseUrl(options.baseUrl, options.provider);
  const headers: Record<string, string> = {};
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  const candidateUrls = getCandidateUrls(normalizedUrl);
  let lastError = "";

  for (const candidateBase of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 4500);

      let response = await fetch(`${candidateBase}/models`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let models: string[] = [];

      if (
        response.status === 404 &&
        (options.provider === "ollama" || candidateBase.includes(":11434"))
      ) {
        const rootUrl = candidateBase.replace(/\/v1$/, "");
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), options.timeoutMs || 4500);
        response = await fetch(`${rootUrl}/api/tags`, {
          headers,
          signal: controller2.signal,
        });
        clearTimeout(timeout2);

        if (response.ok) {
          const tagsData = await response.json();
          const list = Array.isArray(tagsData?.models) ? tagsData.models : [];
          models = list
            .map((m: any) => m?.name || m?.model)
            .filter((id: any): id is string => Boolean(id));
        }
      } else if (response.ok) {
        const data = await response.json();
        const rawList = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.models)
          ? data.models
          : [];
        models = rawList
          .map((m: any) => m?.id || m?.name || m?.model)
          .filter((id: any): id is string => Boolean(id));
      } else {
        lastError = `El servidor devolvió HTTP ${response.status}`;
        continue;
      }

      const chatModels = models.filter(
        (m: string) => !EMBED_KEYWORDS.some((k) => m.toLowerCase().includes(k))
      );
      const embeddingModels = models.filter((m: string) =>
        EMBED_KEYWORDS.some((k) => m.toLowerCase().includes(k))
      );

      return {
        online: true,
        models,
        chatModels,
        embeddingModels,
        recommendedChatModel: chatModels[0] || models[0] || null,
        recommendedEmbeddingModel: embeddingModels[0] || models[models.length - 1] || null,
      };
    } catch (err: any) {
      const presetName = PROVIDER_PRESETS[options.provider]?.name || options.provider;
      lastError =
        err?.name === "AbortError"
          ? `Tiempo de espera agotado al conectar con ${presetName}`
          : `No se pudo conectar con ${presetName} en ${normalizedUrl}`;
    }
  }

  return {
    online: false,
    models: [],
    chatModels: [],
    embeddingModels: [],
    recommendedChatModel: null,
    recommendedEmbeddingModel: null,
    error: lastError || "Servidor desconectado",
  };
}

