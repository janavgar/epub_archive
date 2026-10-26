import { NextRequest, NextResponse } from "next/server";
import { getBookById, deleteBook } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const book = getBookById(decodedId);

    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    return NextResponse.json(book);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);

    // Parse deleteFile option from query param or JSON body
    let deleteFile = false;
    const { searchParams } = new URL(request.url);
    if (searchParams.get("deleteFile") === "true") {
      deleteFile = true;
    } else {
      try {
        const body = await request.json();
        if (body && (body.deleteFile === true || body.delete_file === true)) {
          deleteFile = true;
        }
      } catch {
        // Body might be empty, that's fine
      }
    }

    const result = deleteBook(decodedId, deleteFile);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Libro no encontrado para eliminar" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id: decodedId,
      fileDeleted: result.fileDeleted,
      filePath: result.filePath,
      message: result.fileDeleted
        ? "Libro eliminado de la base de datos y archivo físico eliminado del disco."
        : "Libro eliminado de la base de datos (archivo físico conservado en disco).",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

