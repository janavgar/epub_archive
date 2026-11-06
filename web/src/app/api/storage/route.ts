import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getDb } from "@/lib/db";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const DATA_DIR = path.join(PROJECT_ROOT, ".epub_archive");
const SQLITE_PATH = path.join(DATA_DIR, "archive.sqlite3");
const CHROMA_DIR = path.join(DATA_DIR, "chroma");
const LIBROS_DIR = "/Users/josea./Libros";
const VIRTUAL_DISK_IMG = "/disk/epub_archive_30gb.img";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileSize(filePath: string): number {
  try {
    if (fs.existsSync(filePath)) {
      return fs.statSync(filePath).size;
    }
  } catch {}
  return 0;
}

function getDirSizeFast(dirPath: string): number {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const out = execSync(`du -sk "${dirPath}" 2>/dev/null | cut -f1`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    const kb = parseInt(out, 10);
    if (!isNaN(kb)) return kb * 1024;
  } catch {}
  return 0;
}

function getFsStats(targetPath: string) {
  try {
    const checkPath = fs.existsSync(targetPath) ? targetPath : PROJECT_ROOT;
    const st = fs.statfsSync(checkPath);
    const totalBytes = st.bsize * st.blocks;
    const availableBytes = st.bsize * st.bavail;
    const freeBytes = st.bsize * st.bfree;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent =
      totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 1000) / 10) : 0;

    return {
      path: checkPath,
      totalBytes,
      totalFormatted: formatBytes(totalBytes),
      usedBytes,
      usedFormatted: formatBytes(usedBytes),
      availableBytes,
      availableFormatted: formatBytes(availableBytes),
      usedPercent,
    };
  } catch {
    return {
      path: targetPath,
      totalBytes: 0,
      totalFormatted: "0 B",
      usedBytes: 0,
      usedFormatted: "0 B",
      availableBytes: 0,
      availableFormatted: "0 B",
      usedPercent: 0,
    };
  }
}

let cachedBooksDirStats: { bytes: number; count: number; timestamp: number } | null = null;

function getBooksCollectionStats() {
  const now = Date.now();
  if (cachedBooksDirStats && now - cachedBooksDirStats.timestamp < 30000) {
    return cachedBooksDirStats;
  }
  try {
    if (fs.existsSync(LIBROS_DIR)) {
      const bytes = getDirSizeFast(LIBROS_DIR);
      const countOut = execSync(`find "${LIBROS_DIR}" -type f -iname "*.epub" 2>/dev/null | wc -l`, {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      const count = parseInt(countOut, 10) || 0;
      cachedBooksDirStats = { bytes, count, timestamp: now };
      return cachedBooksDirStats;
    }
  } catch {}
  return { bytes: 0, count: 0, timestamp: now };
}

function collectStorageMetrics() {
  const db = getDb();

  // 1. Volume stats
  const dataVolume = getFsStats(DATA_DIR);
  const isVirtualDisk = fs.existsSync(VIRTUAL_DISK_IMG);
  const hostDiskPath = fs.existsSync("/disk") ? "/disk" : PROJECT_ROOT;
  const systemDisk = getFsStats(hostDiskPath);
  const libraryDisk = getFsStats(fs.existsSync(LIBROS_DIR) ? LIBROS_DIR : PROJECT_ROOT);

  // 2. Main SQLite database breakdown
  const sqliteBytes =
    getFileSize(SQLITE_PATH) +
    getFileSize(`${SQLITE_PATH}-wal`) +
    getFileSize(`${SQLITE_PATH}-journal`);

  let pageSize = 4096;
  let pageCount = 0;
  let freelistCount = 0;
  let booksCount = 0;
  let chunksCount = 0;

  try {
    pageSize = (db.prepare("PRAGMA page_size").get() as any)?.page_size || 4096;
    pageCount = (db.prepare("PRAGMA page_count").get() as any)?.page_count || 0;
    freelistCount = (db.prepare("PRAGMA freelist_count").get() as any)?.freelist_count || 0;
    booksCount = (db.prepare("SELECT COUNT(*) as c FROM books").get() as any)?.c || 0;
    chunksCount = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c || 0;
  } catch {}

  const sqliteReclaimableBytes = freelistCount * pageSize;

  // 3. ChromaDB breakdown
  const chromaSqlitePath = path.join(CHROMA_DIR, "chroma.sqlite3");
  const chromaSqliteBytes =
    getFileSize(chromaSqlitePath) + getFileSize(`${chromaSqlitePath}-journal`);

  let chromaHnswBytes = 0;
  const hnswSegments: Array<{ name: string; bytes: number; formatted: string }> = [];
  try {
    if (fs.existsSync(CHROMA_DIR)) {
      for (const entry of fs.readdirSync(CHROMA_DIR, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const segDir = path.join(CHROMA_DIR, entry.name);
          for (const sub of fs.readdirSync(segDir, { withFileTypes: true })) {
            if (sub.isFile()) {
              const sz = getFileSize(path.join(segDir, sub.name));
              chromaHnswBytes += sz;
              hnswSegments.push({
                name: sub.name,
                bytes: sz,
                formatted: formatBytes(sz),
              });
            }
          }
        }
      }
    }
  } catch {}

  const chromaTotalBytes = chromaSqliteBytes + chromaHnswBytes;

  // 4. Application code & runtime environment (.venv, web, src)
  const venvBytes = getDirSizeFast(path.join(PROJECT_ROOT, ".venv"));
  const webNextBytes = getDirSizeFast(path.join(PROJECT_ROOT, "web", ".next"));
  const webNodeModulesBytes = getDirSizeFast(path.join(PROJECT_ROOT, "web", "node_modules"));
  const srcBytes =
    getDirSizeFast(path.join(PROJECT_ROOT, "src")) +
    getDirSizeFast(path.join(PROJECT_ROOT, "web", "src"));
  const appTotalBytes = venvBytes + webNextBytes + webNodeModulesBytes + srcBytes;

  // 5. EPUB Books library on disk
  const booksLib = getBooksCollectionStats();

  const totalDatabasesBytes = sqliteBytes + chromaTotalBytes;

  return {
    dataVolume: {
      ...dataVolume,
      isVirtualDisk,
      virtualDiskPath: isVirtualDisk ? VIRTUAL_DISK_IMG : null,
    },
    systemDisk,
    libraryDisk,
    summary: {
      totalDatabasesBytes,
      totalDatabasesFormatted: formatBytes(totalDatabasesBytes),
      totalAppAndDbBytes: totalDatabasesBytes + appTotalBytes,
      totalAppAndDbFormatted: formatBytes(totalDatabasesBytes + appTotalBytes),
    },
    breakdown: {
      sqlite: {
        path: SQLITE_PATH,
        bytes: sqliteBytes,
        formatted: formatBytes(sqliteBytes),
        reclaimableBytes: sqliteReclaimableBytes,
        reclaimableFormatted: formatBytes(sqliteReclaimableBytes),
        pageCount,
        freelistCount,
        booksCount,
        chunksCount,
        percentOfDb:
          totalDatabasesBytes > 0
            ? Math.round((sqliteBytes / totalDatabasesBytes) * 1000) / 10
            : 0,
      },
      chroma: {
        path: CHROMA_DIR,
        totalBytes: chromaTotalBytes,
        totalFormatted: formatBytes(chromaTotalBytes),
        sqliteBytes: chromaSqliteBytes,
        sqliteFormatted: formatBytes(chromaSqliteBytes),
        hnswBytes: chromaHnswBytes,
        hnswFormatted: formatBytes(chromaHnswBytes),
        segments: hnswSegments.sort((a, b) => b.bytes - a.bytes),
        percentOfDb:
          totalDatabasesBytes > 0
            ? Math.round((chromaTotalBytes / totalDatabasesBytes) * 1000) / 10
            : 0,
      },
      appCode: {
        totalBytes: appTotalBytes,
        totalFormatted: formatBytes(appTotalBytes),
        venvBytes,
        venvFormatted: formatBytes(venvBytes),
        nodeModulesBytes: webNodeModulesBytes,
        nodeModulesFormatted: formatBytes(webNodeModulesBytes),
        nextBuildBytes: webNextBytes,
        nextBuildFormatted: formatBytes(webNextBytes),
        sourceBytes: srcBytes,
        sourceFormatted: formatBytes(srcBytes),
      },
      booksCollection: {
        path: LIBROS_DIR,
        bytes: booksLib.bytes,
        formatted: formatBytes(booksLib.bytes),
        fileCount: booksLib.count,
      },
    },
  };
}

export async function GET() {
  try {
    const metrics = collectStorageMetrics();
    return NextResponse.json(metrics);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error al obtener métricas de almacenamiento" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === "expand_disk") {
      const addGb = Math.max(5, Math.min(200, Number(body.addGb) || 20));
      if (!fs.existsSync(VIRTUAL_DISK_IMG)) {
        return NextResponse.json(
          { error: "No se detectó una imagen de disco virtual montada en /disk." },
          { status: 400 }
        );
      }

      const currentStat = fs.statSync(VIRTUAL_DISK_IMG);
      const currentGb = Math.round(currentStat.size / (1024 * 1024 * 1024));
      const newGb = currentGb + addGb;

      execSync(
        `truncate -s ${newGb}G "${VIRTUAL_DISK_IMG}" && ` +
          `LOOP_DEV=$(df --output=source "${DATA_DIR}" | tail -n 1) && ` +
          `losetup -c "$LOOP_DEV" && resize2fs "$LOOP_DEV"`,
        { encoding: "utf-8", timeout: 20000 }
      );

      const metrics = collectStorageMetrics();
      return NextResponse.json({
        success: true,
        message: `Volumen de base de datos ampliado en +${addGb} GB (nuevo tamaño: ${newGb} GB).`,
        ...metrics,
      });
    }

    if (action === "compact") {
      const db = getDb();
      db.exec("PRAGMA temp_store = MEMORY;");
      db.exec("PRAGMA optimize;");

      // Run ChromaDB sparse file compaction via Python Storage helper
      try {
        execSync(
          `uv run python -c "from pathlib import Path; from epub_archive.storage import Storage; s = Storage(Path('${DATA_DIR}')); s.compact_chroma_files(); s.close()"`,
          { cwd: PROJECT_ROOT, timeout: 30000 }
        );
      } catch {}

      const metrics = collectStorageMetrics();
      return NextResponse.json({
        success: true,
        message: "Optimización y compactación de índices completada.",
        ...metrics,
      });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error al ejecutar operación de almacenamiento" },
      { status: 500 }
    );
  }
}

