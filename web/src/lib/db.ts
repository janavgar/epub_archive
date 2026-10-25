import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Resolve database path relative to the workspace root
const DB_PATH = path.resolve(process.cwd(), "..", ".epub_archive", "archive.sqlite3");

let dbInstance: DatabaseSync | null = null;

export function ensureSchema(db: DatabaseSync): void {
  try {
    const cols = (db.prepare("PRAGMA table_info(books)").all() as any[]).map((r) => r.name);
    if (!cols.includes("is_read")) {
      db.exec("ALTER TABLE books ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0");
    }
    if (!cols.includes("read_at")) {
      db.exec("ALTER TABLE books ADD COLUMN read_at TEXT DEFAULT NULL");
    }
    db.exec("CREATE INDEX IF NOT EXISTS books_is_read ON books(is_read)");
    db.exec("CREATE INDEX IF NOT EXISTS books_status ON books(status)");
  } catch (e) {
    console.error("Error migrating sqlite schema:", e);
  }
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    if (!fs.existsSync(DB_PATH)) {
      // Ensure parent directory exists
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    dbInstance = new DatabaseSync(DB_PATH);
    ensureSchema(dbInstance);
  }
  return dbInstance;
}

export interface BookRow {
  id: string;
  sha256: string;
  title: string;
  author: string;
  language: string;
  year: string;
  original_title: string;
  original_author: string;
  publisher: string;
  description: string;
  categories_json: string;
  summary: string;
  keywords_json: string;
  status: string;
  error: string | null;
  processed_at: string;
  chunk_count: number;
  chapter_count: number;
  cluster_id: number;
  cluster_label: string;
  is_read: number;
  read_at: string | null;
}

export interface BookDetail extends Omit<BookRow, "categories_json" | "keywords_json" | "is_read"> {
  categories: string[];
  keywords: string[];
  metadata_corrected: boolean;
  is_read: boolean;
  read_at: string | null;
}

export function parseBookRow(row: any): BookDetail {
  let categories: string[] = [];
  let keywords: string[] = [];
  try {
    categories = JSON.parse(row.categories_json || "[]");
  } catch {}
  try {
    keywords = JSON.parse(row.keywords_json || "[]");
  } catch {}

  const origTitle = row.original_title || row.title;
  const origAuthor = row.original_author || row.author;
  const metadata_corrected =
    (row.title && origTitle && row.title.toLowerCase() !== origTitle.toLowerCase()) ||
    (row.author && origAuthor && row.author.toLowerCase() !== origAuthor.toLowerCase());

  return {
    ...row,
    categories,
    keywords,
    is_read: Boolean(row.is_read),
    read_at: row.read_at || null,
    metadata_corrected: Boolean(metadata_corrected),
  };
}

export function getArchiveStats() {
  const db = getDb();

  const totalBooks = (db.prepare("SELECT COUNT(*) as c FROM books").get() as any)?.c || 0;
  const doneBooks = (db.prepare("SELECT COUNT(*) as c FROM books WHERE status = 'done'").get() as any)?.c || 0;
  const errorBooks = (db.prepare("SELECT COUNT(*) as c FROM books WHERE status = 'error'").get() as any)?.c || 0;
  const readBooks = (db.prepare("SELECT COUNT(*) as c FROM books WHERE is_read = 1").get() as any)?.c || 0;
  const totalChunks = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c || 0;

  const rows = db.prepare("SELECT categories_json FROM books WHERE status = 'done'").all() as any[];
  const categoryCounts: Record<string, number> = {};
  for (const r of rows) {
    try {
      const cats = JSON.parse(r.categories_json);
      for (const c of cats) {
        categoryCounts[c] = (categoryCounts[c] || 0) + 1;
      }
    } catch {}
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const clusterRows = db
    .prepare("SELECT cluster_id, cluster_label, COUNT(*) as count FROM books WHERE cluster_id >= 0 GROUP BY cluster_id ORDER BY count DESC")
    .all() as any[];

  const recentBooks = db
    .prepare("SELECT * FROM books WHERE status = 'done' ORDER BY processed_at DESC LIMIT 6")
    .all()
    .map(parseBookRow);

  return {
    totalBooks,
    doneBooks,
    errorBooks,
    readBooks,
    totalChunks,
    topCategories,
    clusters: clusterRows,
    recentBooks,
  };
}

export function getBooks(options: {
  search?: string;
  category?: string;
  status?: string;
  isRead?: boolean;
  clusterId?: number;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  let query = "SELECT * FROM books WHERE 1=1 ";
  const params: any[] = [];

  if (options.status) {
    query += "AND status = ? ";
    params.push(options.status);
  }

  if (options.isRead !== undefined) {
    query += "AND is_read = ? ";
    params.push(options.isRead ? 1 : 0);
  }

  if (options.clusterId !== undefined && options.clusterId !== null) {
    query += "AND cluster_id = ? ";
    params.push(options.clusterId);
  }

  if (options.category) {
    query += "AND categories_json LIKE ? ";
    params.push(`%"${options.category}"%`);
  }

  if (options.search) {
    query += "AND (title LIKE ? OR author LIKE ? OR summary LIKE ? OR keywords_json LIKE ?) ";
    const term = `%${options.search}%`;
    params.push(term, term, term, term);
  }

  // Count total matching
  const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as c");
  const totalCount = (db.prepare(countQuery).get(...params) as any)?.c || 0;

  query += "ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params).map(parseBookRow);

  return {
    books: rows,
    total: totalCount,
    limit,
    offset,
  };
}

export function getBookById(id: string) {
  const db = getDb();
  const bookRow = db.prepare("SELECT * FROM books WHERE id = ?").get(id);
  if (!bookRow) return null;

  const book = parseBookRow(bookRow);

  const chunks = db
    .prepare("SELECT id, chapter, content, chunk_index FROM chunks WHERE book_id = ? ORDER BY chunk_index ASC LIMIT 25")
    .all(id) as any[];

  return {
    ...book,
    sample_chunks: chunks,
  };
}

export function setBookReadStatus(id: string, isRead?: boolean) {
  const db = getDb();
  const current = db.prepare("SELECT is_read FROM books WHERE id = ?").get(id) as any;
  if (!current) return null;

  let newStatus: number;
  let readAt: string | null = null;

  if (isRead !== undefined) {
    newStatus = isRead ? 1 : 0;
    readAt = isRead ? new Date().toISOString() : null;
  } else {
    newStatus = current.is_read === 1 ? 0 : 1;
    readAt = newStatus === 1 ? new Date().toISOString() : null;
  }

  db.prepare("UPDATE books SET is_read = ?, read_at = ? WHERE id = ?").run(newStatus, readAt, id);
  return getBookById(id);
}

export function getErrorBooks() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM books WHERE status = 'error' ORDER BY title COLLATE NOCASE")
    .all()
    .map(parseBookRow);
  return rows;
}
