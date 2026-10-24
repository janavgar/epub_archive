import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const inputDir = body.input_dir || "";
  const force = Boolean(body.force);
  const maxBooks = body.max_books ? parseInt(body.max_books, 10) : null;
  const categories = body.categories ? String(body.categories).trim() : null;
  const overlap = body.overlap ? parseInt(body.overlap, 10) : 150;
  const skipEmbeddings = Boolean(body.skip_embeddings);

  const DEFAULT_LIBROS_DIR = "/Users/josea./Libros";

  // Resolve directory path with /Users/josea./Libros as primary default
  let resolvedDir = (inputDir || "").trim();
  if (!resolvedDir || resolvedDir === "." || resolvedDir === "./") {
    resolvedDir = DEFAULT_LIBROS_DIR;
  } else if (resolvedDir.startsWith("~")) {
    resolvedDir = path.join(process.env.HOME || "/Users/josea.", resolvedDir.slice(1));
  } else if (!path.isAbsolute(resolvedDir)) {
    const homeCandidate = path.join(process.env.HOME || "/Users/josea.", resolvedDir);
    if (fs.existsSync(homeCandidate)) {
      resolvedDir = homeCandidate;
    } else if (resolvedDir.toLowerCase().includes("libro") && fs.existsSync(DEFAULT_LIBROS_DIR)) {
      resolvedDir = DEFAULT_LIBROS_DIR;
    } else {
      resolvedDir = path.resolve(process.cwd(), "..", resolvedDir);
    }
  }

  if (!fs.existsSync(resolvedDir)) {
    if (fs.existsSync(DEFAULT_LIBROS_DIR)) {
      resolvedDir = DEFAULT_LIBROS_DIR;
    } else {
      return new Response(JSON.stringify({ error: `La carpeta no existe: ${resolvedDir}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const projectRoot = path.resolve(process.cwd(), "..");
  const args = ["run", "epub-archive", "process", resolvedDir];

  if (force) args.push("--force");
  if (maxBooks && maxBooks > 0) args.push("--max-books", String(maxBooks));
  if (categories) args.push("--categories", categories);
  if (overlap && overlap !== 150) args.push("--overlap", String(overlap));
  if (skipEmbeddings) args.push("--skip-embeddings");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "start", command: `epub-archive process ${resolvedDir}` })}\n\n`)
      );

      const proc = spawn("uv", args, {
        cwd: projectRoot,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      proc.stdout.on("data", (data) => {
        const text = data.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse progress format: [1/80] (1.2% | ETA: 4m 30s) Procesando: book.epub
          const match = line.match(/\[(\d+)\/(\d+)\]\s*\(([\d.]+)%\s*\|\s*ETA:\s*([^)]+)\)\s*Procesando:\s*(.*)/);
          if (match) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  current: parseInt(match[1], 10),
                  total: parseInt(match[2], 10),
                  percent: parseFloat(match[3]),
                  eta: match[4].trim(),
                  book: match[5].trim(),
                  raw: line,
                })}\n\n`
              )
            );
          } else {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "log", line })}\n\n`)
            );
          }
        }
      });

      proc.stderr.on("data", (data) => {
        const text = data.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "log", line, isStderr: true })}\n\n`)
            );
          }
        }
      });

      proc.on("close", (code) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "finish",
              code,
              success: code === 0,
            })}\n\n`
          )
        );
        controller.close();
      });

      proc.on("error", (err) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              message: err.message,
            })}\n\n`
          )
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
