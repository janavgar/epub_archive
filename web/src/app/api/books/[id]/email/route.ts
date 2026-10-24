import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { getBookById } from "@/lib/db";

const execFileAsync = promisify(execFile);

function buildEml(book: any, filePath: string) {
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";

  const title = book?.title || fileName.replace(/\.epub$/i, "");
  const author = book?.author || "Desconocido";
  const yearText = book?.year ? `\r\n• Año: ${book.year}` : "";
  const catsText = book?.categories?.length ? `\r\n• Categorías: ${book.categories.join(", ")}` : "";
  const summaryText = book?.summary ? `\r\n\r\nResumen:\r\n${book.summary}` : "";

  const bodyText = [
    `Hola,`,
    ``,
    `Te comparto el libro "${title}" de ${author}.`,
    ``,
    `Ficha de la obra:`,
    `• Título: ${title}`,
    `• Autor: ${author}${yearText}${catsText}`,
    summaryText,
    ``,
    `Adjunto a este correo encontrarás el archivo EPUB completo listo para leer.`,
    ``,
    `---`,
    `Enviado desde EPUB Archive AI Pipeline`,
  ].join("\r\n");

  const subject = `Libro EPUB: ${title} — ${author}`;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return [
    `From: `,
    `To: `,
    `Subject: ${encodedSubject}`,
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    bodyText,
    ``,
    `--${boundary}`,
    `Content-Type: application/epub+zip; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Data,
    ``,
    `--${boundary}--`,
    ``,
  ].join("\r\n");
}

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
        { error: `El archivo del libro no existe en disco: ${filePath}` },
        { status: 404 }
      );
    }

    const fileName = path.basename(filePath);
    const emlContent = buildEml(book, filePath);

    const tmpDir = os.tmpdir();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const emlPath = path.join(tmpDir, `draft_${safeName}.eml`);

    fs.writeFileSync(emlPath, emlContent, "utf8");

    // Open .eml draft in macOS default email client (Apple Mail, Outlook, etc.)
    await execFileAsync("open", [emlPath]);

    return NextResponse.json({
      success: true,
      message: "Borrador de correo abierto con el archivo EPUB adjunto",
      fileName,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
        { error: `El archivo del libro no existe en disco: ${filePath}` },
        { status: 404 }
      );
    }

    const fileName = path.basename(filePath);
    const emlContent = buildEml(book, filePath);
    const emlName = `${path.parse(fileName).name}.eml`;

    return new NextResponse(emlContent, {
      status: 200,
      headers: {
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(emlName)}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
