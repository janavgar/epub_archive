import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { getBookById } from "@/lib/db";

const execFileAsync = promisify(execFile);

export async function POST(
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
        { error: `El archivo no existe en la ruta local: ${filePath}` },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reveal = body?.reveal === true;

    if (reveal) {
      await execFileAsync("open", ["-R", filePath]);
      return NextResponse.json({
        success: true,
        action: "reveal",
        message: "Mostrado en Finder",
      });
    } else {
      await execFileAsync("open", [filePath]);
      return NextResponse.json({
        success: true,
        action: "open",
        message: "Abierto con la aplicación predeterminada",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
