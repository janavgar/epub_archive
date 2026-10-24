import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.LM_STUDIO_BASE_URL || "http://localhost:1234/v1";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${baseUrl}/models`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({
        online: false,
        error: `Servidor devolvió código HTTP ${response.status}`,
        models: [],
      });
    }

    const data = await response.json();
    const models = Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];

    const chatModels = models.filter(
      (m: string) => !m.toLowerCase().includes("embed") && !m.toLowerCase().includes("nomic")
    );
    const embeddingModels = models.filter((m: string) =>
      ["embed", "nomic", "bge", "minilm", "e5"].some((k) => m.toLowerCase().includes(k))
    );

    return NextResponse.json({
      online: true,
      baseUrl,
      models,
      recommendedChatModel: chatModels[0] || models[0] || null,
      recommendedEmbeddingModel: embeddingModels[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({
      online: false,
      baseUrl,
      error: error.name === "AbortError" ? "Tiempo de espera agotado al conectar con LM Studio" : "LM Studio no está activo en el puerto 1234",
      models: [],
    });
  }
}
