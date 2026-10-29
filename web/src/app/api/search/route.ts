import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { getDb, parseBookRow, BookDetail } from "@/lib/db";
import { buildCliAIArgs } from "@/lib/aiConfig";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = searchParams.get("limit") || "6";
    const author = searchParams.get("author");

    if (!query || !query.trim()) {
      return NextResponse.json({ error: "La consulta de búsqueda no puede estar vacía" }, { status: 400 });
    }

    const projectRoot = path.resolve(process.cwd(), "..");
    const aiArgs = buildCliAIArgs();
    const args = ["run", "epub-archive", ...aiArgs, "search", query, "--limit", limit];
    if (author && author.trim()) {
      args.push("--author", author.trim());
    }

    const output = await new Promise<string>((resolve, reject) => {
      const proc = spawn("uv", args, {
        cwd: projectRoot,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `El comando de búsqueda falló con código ${code}`));
        }
      });
    });

    const db = getDb();

    // Parse the textual search output into structured items with book details
    const matches: Array<{
      index: number;
      title: string;
      author: string;
      year: string;
      chapter: string;
      distance: number;
      similarity: number;
      content: string;
      bookId: string | null;
      book: BookDetail | null;
    }> = [];

    const rawParts = output.split(/\[\d+\] /);
    rawParts.shift(); // Discard preamble logs before [1]
    const blocks = rawParts.filter((b) => b.trim());

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      const lines = block.split("\n");
      const header = lines[0];

      const distMatch = header.match(/\(distancia:\s*([0-9.]+)\)/);
      const distance = distMatch ? parseFloat(distMatch[1]) : 0;
      const similarity = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));

      let title = "Desconocido";
      let authorName = "Desconocido";
      let year = "";
      let chapter = "Capítulo";
      let bookId: string | null = null;

      const dashIdx = header.indexOf(" — ");
      if (dashIdx !== -1) {
        title = header.substring(0, dashIdx).trim();
        const rest = header.substring(dashIdx + 3);
        const pipeIdx = rest.indexOf(" | ");
        if (pipeIdx !== -1) {
          const authorPart = rest.substring(0, pipeIdx).trim();
          const yearMatch = authorPart.match(/\((\d{4})\)/);
          if (yearMatch) {
            year = yearMatch[1];
            authorName = authorPart.replace(/\(\d{4}\)/, "").trim();
          } else {
            authorName = authorPart;
          }
          chapter = rest.substring(pipeIdx + 3).replace(/\(distancia:[^)]+\)/, "").trim();
        }
      }

      for (const line of lines) {
        if (line.startsWith("BookID: ")) {
          bookId = line.substring(8).trim();
          break;
        }
      }

      const sepIdx = block.indexOf("------------------------------------------------------------");
      let content = "";
      if (sepIdx !== -1) {
        content = block.substring(sepIdx + 60).trim();
      } else {
        content = lines.slice(1).join("\n").trim();
      }

      // Query complete book entity from SQLite
      let bookRow: any = null;
      if (bookId) {
        bookRow = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId);
      }
      if (!bookRow && title && title !== "Desconocido") {
        bookRow = db.prepare("SELECT * FROM books WHERE title = ? COLLATE NOCASE LIMIT 1").get(title);
        if (!bookRow) {
          bookRow = db.prepare("SELECT * FROM books WHERE title LIKE ? COLLATE NOCASE LIMIT 1").get(`%${title}%`);
        }
      }

      const book = bookRow ? parseBookRow(bookRow) : null;

      matches.push({
        index: i + 1,
        title: book?.title || title,
        author: book?.author || authorName,
        year: book?.year || year,
        chapter,
        distance,
        similarity,
        content,
        bookId: book?.id || bookId,
        book,
      });
    }

    return NextResponse.json({ query, count: matches.length, results: matches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
