import { NextRequest, NextResponse } from "next/server";
import { saveManualBook, ManualBookInput } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body: ManualBookInput = await request.json();

    if (!body.id || !body.id.trim()) {
      return NextResponse.json(
        { error: "La ruta o identificador del libro es obligatorio" },
        { status: 400 }
      );
    }
    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: "El título del libro es obligatorio" },
        { status: 400 }
      );
    }
    if (!body.author || !body.author.trim()) {
      return NextResponse.json(
        { error: "El autor del libro es obligatorio" },
        { status: 400 }
      );
    }

    const savedBook = saveManualBook({
      ...body,
      id: body.id.trim(),
      title: body.title.trim(),
      author: body.author.trim(),
    });

    return NextResponse.json({ success: true, book: savedBook });
  } catch (error: any) {
    console.error("Error al guardar libro manualmente:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al guardar libro" },
      { status: 500 }
    );
  }
}
