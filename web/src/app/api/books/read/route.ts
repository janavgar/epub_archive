import { NextRequest, NextResponse } from "next/server";
import { setBookReadStatus } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, is_read } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Se requiere el ID del libro" },
        { status: 400 }
      );
    }

    const updatedBook = setBookReadStatus(
      id,
      typeof is_read === "boolean" ? is_read : undefined
    );

    if (!updatedBook) {
      return NextResponse.json(
        { error: "Libro no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      book: updatedBook,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
