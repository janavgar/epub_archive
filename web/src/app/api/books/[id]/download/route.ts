import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBookById } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const book = getBookById(decodedId);
    const filePath = book?.id || decodedId;

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Archivo no encontrado en el sistema: ${filePath}` },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
