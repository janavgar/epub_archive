import { NextRequest, NextResponse } from "next/server";
import {
  AIConfig,
  PROVIDER_PRESETS,
  loadAIConfig,
  normalizeBaseUrl,
  probeEndpointModels,
  saveAIConfig,
} from "@/lib/aiConfig";

async function buildStatusResponse(config: AIConfig) {
  const preset = PROVIDER_PRESETS[config.provider] || PROVIDER_PRESETS.custom;
  const chatProbe = await probeEndpointModels({
    baseUrl: config.base_url,
    provider: config.provider,
    apiKey: config.api_key,
  });

  let embeddingProbe = chatProbe;
  if (config.separate_embedding && config.embedding_base_url) {
    embeddingProbe = await probeEndpointModels({
      baseUrl: config.embedding_base_url,
      provider: config.embedding_provider,
      apiKey: config.embedding_api_key || config.api_key,
    });
  }

  const activeChatModel =
    config.chat_model || chatProbe.recommendedChatModel || null;
  const activeEmbeddingModel =
    config.embedding_model ||
    embeddingProbe.recommendedEmbeddingModel ||
    null;

  return {
    online: chatProbe.online,
    embeddingOnline: embeddingProbe.online,
    provider: config.provider,
    providerName: preset.name,
    baseUrl: config.base_url,
    error: chatProbe.error || null,
    embeddingError: embeddingProbe.error || null,
    models: chatProbe.models,
    chatModels: chatProbe.chatModels,
    embeddingModels: config.separate_embedding
      ? embeddingProbe.models
      : chatProbe.embeddingModels.length > 0
      ? chatProbe.embeddingModels
      : chatProbe.models,
    recommendedChatModel: activeChatModel,
    recommendedEmbeddingModel: activeEmbeddingModel,
    autoDetectedChatModel: chatProbe.recommendedChatModel,
    autoDetectedEmbeddingModel: embeddingProbe.recommendedEmbeddingModel,
    config,
    presets: Object.values(PROVIDER_PRESETS),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isProbe = searchParams.get("probe") === "1";

    if (isProbe) {
      const provider = searchParams.get("provider") || "lm_studio";
      const rawUrl =
        searchParams.get("baseUrl") ||
        PROVIDER_PRESETS[provider]?.defaultBaseUrl ||
        "http://localhost:1234/v1";
      const apiKey = searchParams.get("apiKey") || "";
      const baseUrl = normalizeBaseUrl(rawUrl, provider);

      const probe = await probeEndpointModels({
        baseUrl,
        provider,
        apiKey,
      });

      return NextResponse.json({
        ...probe,
        provider,
        providerName: PROVIDER_PRESETS[provider]?.name || provider,
        baseUrl,
      });
    }

    const config = loadAIConfig();
    const status = await buildStatusResponse(config);
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      {
        online: false,
        error: error.message || "Error al consultar estado del proveedor de IA",
        models: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.reset) {
      const resetCfg = saveAIConfig({
        provider: "lm_studio",
        base_url: PROVIDER_PRESETS.lm_studio.defaultBaseUrl,
        api_key: "",
        chat_model: "",
        embedding_model: "",
        separate_embedding: false,
        embedding_provider: "lm_studio",
        embedding_base_url: "",
        embedding_api_key: "",
      });
      const status = await buildStatusResponse(resetCfg);
      return NextResponse.json({ success: true, ...status });
    }

    const saved = saveAIConfig({
      provider: body.provider,
      base_url: body.base_url,
      api_key: body.api_key,
      chat_model: body.chat_model,
      embedding_model: body.embedding_model,
      separate_embedding: body.separate_embedding,
      embedding_provider: body.embedding_provider,
      embedding_base_url: body.embedding_base_url,
      embedding_api_key: body.embedding_api_key,
      timeout: body.timeout,
    });

    const status = await buildStatusResponse(saved);
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error al guardar la configuración de IA" },
      { status: 400 }
    );
  }
}
