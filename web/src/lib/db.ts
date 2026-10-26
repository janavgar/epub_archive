import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

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

export interface ManualBookInput {
  id: string;
  title: string;
  author: string;
  language?: string;
  year?: string;
  original_title?: string;
  original_author?: string;
  publisher?: string;
  description?: string;
  summary?: string;
  categories?: string[];
  keywords?: string[];
  content_sample?: string;
  chapter_title?: string;
}

export function saveManualBook(input: ManualBookInput): BookDetail {
  const db = getDb();
  const now = new Date().toISOString();

  if (!input.id || !input.id.trim()) {
    throw new Error("El identificador o ruta del libro es obligatorio.");
  }
  if (!input.title || !input.title.trim()) {
    throw new Error("El título del libro es obligatorio.");
  }
  if (!input.author || !input.author.trim()) {
    throw new Error("El autor del libro es obligatorio.");
  }

  const bookId = input.id.trim();
  const title = input.title.trim();
  const author = input.author.trim();

  let sha256 = "";
  const existing = db.prepare("SELECT sha256, chunk_count, chapter_count FROM books WHERE id = ?").get(bookId) as any;
  if (existing?.sha256) {
    sha256 = existing.sha256;
  } else {
    try {
      if (fs.existsSync(bookId)) {
        const fileBuf = fs.readFileSync(bookId);
        sha256 = crypto.createHash("sha256").update(fileBuf).digest("hex");
      }
    } catch {}
    if (!sha256) {
      sha256 = crypto.createHash("sha256").update(bookId).digest("hex");
    }
  }

  const categories = input.categories || [];
  const keywords = input.keywords || [];
  const categoriesJson = JSON.stringify(categories);
  const keywordsJson = JSON.stringify(keywords);
  const language = (input.language || "es").trim();
  const year = (input.year || "").trim();
  const originalTitle = (input.original_title || title).trim();
  const originalAuthor = (input.original_author || author).trim();
  const publisher = (input.publisher || "").trim();
  const description = (input.description || "").trim();
  const summary = (input.summary || "").trim();

  let chunkCount = existing?.chunk_count || 0;
  let chapterCount = existing?.chapter_count || 0;

  if (input.content_sample && input.content_sample.trim()) {
    const content = input.content_sample.trim();
    const chunkId = crypto.createHash("sha256").update(`${bookId}\0manual_chunk\0${content}`).digest("hex");
    chunkCount = 1;
    chapterCount = 1;

    db.prepare("DELETE FROM chunks WHERE book_id = ?").run(bookId);
    db.prepare(`
      INSERT INTO chunks (id, book_id, chapter, content, vector_id, chunk_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      chunkId,
      bookId,
      input.chapter_title?.trim() || "Contenido Manual",
      content,
      chunkId,
      0
    );
  } else {
    const existingChunks = (db.prepare("SELECT COUNT(*) as c FROM chunks WHERE book_id = ?").get(bookId) as any)?.c || 0;
    if (existingChunks > 0) {
      chunkCount = existingChunks;
      chapterCount = 1;
    }
  }

  db.prepare(`
    INSERT INTO books (
      id, sha256, title, author, language, year,
      original_title, original_author, publisher, description,
      categories_json, summary, keywords_json, status, error,
      processed_at, chunk_count, chapter_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'done', NULL, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sha256 = excluded.sha256,
      title = excluded.title,
      author = excluded.author,
      language = excluded.language,
      year = excluded.year,
      original_title = excluded.original_title,
      original_author = excluded.original_author,
      publisher = excluded.publisher,
      description = excluded.description,
      categories_json = excluded.categories_json,
      summary = excluded.summary,
      keywords_json = excluded.keywords_json,
      status = 'done',
      error = NULL,
      processed_at = excluded.processed_at,
      chunk_count = excluded.chunk_count,
      chapter_count = excluded.chapter_count
  `).run(
    bookId,
    sha256,
    title,
    author,
    language,
    year,
    originalTitle,
    originalAuthor,
    publisher,
    description,
    categoriesJson,
    summary,
    keywordsJson,
    now,
    chunkCount,
    chapterCount
  );

  const updated = getBookById(bookId);
  if (!updated) {
    throw new Error("No se pudo recuperar el libro actualizado tras guardar.");
  }
  return updated;
}

export function deleteBook(id: string): boolean {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM books WHERE id = ?").get(id);
  if (!existing) return false;
  db.prepare("DELETE FROM chunks WHERE book_id = ?").run(id);
  db.prepare("DELETE FROM books WHERE id = ?").run(id);
  return true;
}

