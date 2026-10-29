import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

// Resolve database path relative to the workspace root
const DB_PATH = path.resolve(process.cwd(), "..", ".epub_archive", "archive.sqlite3");

let dbInstance: DatabaseSync | null = null;

export function ensureSchema(db: DatabaseSync): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        sha256 TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        language TEXT NOT NULL,
        year TEXT NOT NULL DEFAULT '',
        original_title TEXT NOT NULL DEFAULT '',
        original_author TEXT NOT NULL DEFAULT '',
        publisher TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        categories_json TEXT NOT NULL DEFAULT '[]',
        summary TEXT NOT NULL DEFAULT '',
        keywords_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL,
        error TEXT,
        processed_at TEXT,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        chapter_count INTEGER NOT NULL DEFAULT 0,
        cluster_id INTEGER DEFAULT -1,
        cluster_label TEXT DEFAULT '',
        is_read INTEGER NOT NULL DEFAULT 0,
        read_at TEXT DEFAULT NULL
      );
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        chapter TEXT NOT NULL,
        content TEXT NOT NULL,
        vector_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS chunks_book_id ON chunks(book_id);
      CREATE INDEX IF NOT EXISTS books_cluster ON books(cluster_id);
    `);
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
  const duplicateGroups =
    (db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT sha256 FROM books WHERE sha256 != '' GROUP BY sha256 HAVING COUNT(*) > 1
        UNION
        SELECT LOWER(TRIM(title)) || '___' || LOWER(TRIM(author))
        FROM books
        WHERE title != '' AND title != '...'
        GROUP BY LOWER(TRIM(title)), LOWER(TRIM(author))
        HAVING COUNT(*) > 1
      )
    `).get() as any)?.c || 0;

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
    duplicateGroups,
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

export interface DeleteBookResult {
  success: boolean;
  fileDeleted: boolean;
  filePath: string;
  error?: string;
  book?: BookDetail;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function deleteBook(id: string, deleteFile: boolean = false): DeleteBookResult {
  const db = getDb();
  const bookRow = db.prepare("SELECT * FROM books WHERE id = ?").get(id);
  if (!bookRow) {
    return {
      success: false,
      fileDeleted: false,
      filePath: id,
      error: "Libro no encontrado en la base de datos.",
    };
  }

  const book = parseBookRow(bookRow);
  const filePath = book.id;

  // 1. Delete associated chunks from SQLite
  db.prepare("DELETE FROM chunks WHERE book_id = ?").run(id);

  // 2. Delete book record from SQLite
  db.prepare("DELETE FROM books WHERE id = ?").run(id);

  // 3. If requested, delete physical file from storage/disk
  let fileDeleted = false;
  if (deleteFile) {
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
          fileDeleted = true;
        }
      }
    } catch (err: any) {
      console.error(`Error al eliminar archivo físico ${filePath}:`, err);
    }
  }

  // 4. Asynchronously invoke python CLI to clean up vector embeddings from ChromaDB
  try {
    const projectRoot = path.resolve(process.cwd(), "..");
    const proc = spawn("uv", ["run", "epub-archive", "delete", id], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
  } catch (err) {
    // Non-blocking background vector cleanup
  }

  return {
    success: true,
    fileDeleted,
    filePath,
    book,
  };
}

export interface DuplicateBookItem extends BookDetail {
  file_exists: boolean;
  file_size_bytes?: number;
  file_size_formatted?: string;
  filename: string;
}

export interface DuplicateGroup {
  key: string;
  type: "sha256" | "title_author";
  title: string;
  author: string;
  count: number;
  books: DuplicateBookItem[];
}

export function getDuplicateGroups(options?: {
  type?: "all" | "sha256" | "title_author";
  search?: string;
}) {
  const db = getDb();
  const filterType = options?.type || "all";
  const search = options?.search ? options.search.trim().toLowerCase() : "";

  const groups: DuplicateGroup[] = [];
  const processedShaPairs = new Set<string>();

  // 1. Exact SHA-256 duplicates
  if (filterType === "all" || filterType === "sha256") {
    const shaRows = db.prepare(`
      SELECT sha256, COUNT(*) as c
      FROM books
      WHERE sha256 != ''
      GROUP BY sha256
      HAVING c > 1
      ORDER BY c DESC
    `).all() as any[];

    for (const r of shaRows) {
      const booksRows = db.prepare(`
        SELECT * FROM books WHERE sha256 = ? ORDER BY title COLLATE NOCASE
      `).all(r.sha256) as any[];

      if (booksRows.length > 1) {
        const first = booksRows[0];
        const title = first.title || "Sin título";
        const author = first.author || "Desconocido";

        if (search && !title.toLowerCase().includes(search) && !author.toLowerCase().includes(search)) {
          continue;
        }

        const items: DuplicateBookItem[] = booksRows.map((b) => {
          let exists = false;
          let size: number | undefined;
          let sizeFmt: string | undefined;
          try {
            if (fs.existsSync(b.id)) {
              exists = true;
              const s = fs.statSync(b.id);
              size = s.size;
              sizeFmt = formatBytes(s.size);
            }
          } catch {}

          return {
            ...parseBookRow(b),
            file_exists: exists,
            file_size_bytes: size,
            file_size_formatted: sizeFmt,
            filename: path.basename(b.id),
          };
        });

        processedShaPairs.add(`${title.trim().toLowerCase()}___${author.trim().toLowerCase()}`);

        groups.push({
          key: r.sha256,
          type: "sha256",
          title,
          author,
          count: items.length,
          books: items,
        });
      }
    }
  }

  // 2. Title & Author matching duplicates (normalized)
  if (filterType === "all" || filterType === "title_author") {
    const titleAuthorRows = db.prepare(`
      SELECT LOWER(TRIM(title)) as norm_title, LOWER(TRIM(author)) as norm_author, COUNT(*) as c
      FROM books
      WHERE title != '' AND title != '...'
      GROUP BY LOWER(TRIM(title)), LOWER(TRIM(author))
      HAVING c > 1
      ORDER BY c DESC
    `).all() as any[];

    for (const r of titleAuthorRows) {
      const pairKey = `${r.norm_title}___${r.norm_author}`;
      if (filterType === "all" && processedShaPairs.has(pairKey)) {
        continue;
      }

      if (search && !r.norm_title.includes(search) && !r.norm_author.includes(search)) {
        continue;
      }

      const booksRows = db.prepare(`
        SELECT * FROM books
        WHERE LOWER(TRIM(title)) = ? AND LOWER(TRIM(author)) = ?
        ORDER BY id
      `).all(r.norm_title, r.norm_author) as any[];

      if (booksRows.length > 1) {
        const first = booksRows[0];
        const title = first.title || "Sin título";
        const author = first.author || "Desconocido";

        const items: DuplicateBookItem[] = booksRows.map((b) => {
          let exists = false;
          let size: number | undefined;
          let sizeFmt: string | undefined;
          try {
            if (fs.existsSync(b.id)) {
              exists = true;
              const s = fs.statSync(b.id);
              size = s.size;
              sizeFmt = formatBytes(s.size);
            }
          } catch {}

          return {
            ...parseBookRow(b),
            file_exists: exists,
            file_size_bytes: size,
            file_size_formatted: sizeFmt,
            filename: path.basename(b.id),
          };
        });

        groups.push({
          key: pairKey,
          type: "title_author",
          title,
          author,
          count: items.length,
          books: items,
        });
      }
    }
  }

  const totalDuplicateBooks = groups.reduce((acc, g) => acc + g.books.length, 0);
  const sha256Groups = groups.filter((g) => g.type === "sha256").length;
  const titleAuthorGroups = groups.filter((g) => g.type === "title_author").length;

  return {
    summary: {
      totalGroups: groups.length,
      totalDuplicateBooks,
      sha256Groups,
      titleAuthorGroups,
    },
    groups,
  };
}

export function getBookDuplicates(bookId: string): { count: number; duplicates: DuplicateBookItem[] } {
  const db = getDb();
  const current = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId) as any;
  if (!current) {
    return { count: 0, duplicates: [] };
  }

  const normTitle = (current.title || "").trim().toLowerCase();
  const normAuthor = (current.author || "").trim().toLowerCase();
  const sha256 = current.sha256 || "";

  let rows: any[] = [];
  if (sha256 && normTitle) {
    rows = db.prepare(`
      SELECT * FROM books
      WHERE id != ? AND (sha256 = ? OR (LOWER(TRIM(title)) = ? AND LOWER(TRIM(author)) = ?))
      ORDER BY title COLLATE NOCASE
    `).all(bookId, sha256, normTitle, normAuthor) as any[];
  } else if (sha256) {
    rows = db.prepare(`
      SELECT * FROM books WHERE id != ? AND sha256 = ?
    `).all(bookId, sha256) as any[];
  } else if (normTitle) {
    rows = db.prepare(`
      SELECT * FROM books
      WHERE id != ? AND LOWER(TRIM(title)) = ? AND LOWER(TRIM(author)) = ?
    `).all(bookId, normTitle, normAuthor) as any[];
  }

  const duplicates: DuplicateBookItem[] = rows.map((b) => {
    let exists = false;
    let size: number | undefined;
    let sizeFmt: string | undefined;
    try {
      if (fs.existsSync(b.id)) {
        exists = true;
        const s = fs.statSync(b.id);
        size = s.size;
        sizeFmt = formatBytes(s.size);
      }
    } catch {}

    return {
      ...parseBookRow(b),
      file_exists: exists,
      file_size_bytes: size,
      file_size_formatted: sizeFmt,
      filename: path.basename(b.id),
    };
  });

  return {
    count: duplicates.length,
    duplicates,
  };
}

