import { NextRequest, NextResponse } from "next/server";
import { processManager } from "@/lib/processManager";

export async function GET() {
  return NextResponse.json({
    status: processManager.getStatus(),
    logs: processManager.getLogs(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const inputDir = body.input_dir || "";
    const force = Boolean(body.force);
    const maxBooks = body.max_books ? parseInt(body.max_books, 10) : null;
    const categories = body.categories ? String(body.categories).trim() : null;
    const overlap = body.overlap ? parseInt(body.overlap, 10) : 150;
    const skipEmbeddings = Boolean(body.skip_embeddings);

    processManager.startProcess({
      inputDir,
      force,
      maxBooks,
      categories,
      overlap,
      skipEmbeddings,
    });

    return NextResponse.json({
      success: true,
      status: processManager.getStatus(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error al iniciar el proceso" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const result = processManager.stopProcess();
  return NextResponse.json(result);
}
