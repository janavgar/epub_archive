from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import chromadb

logger = logging.getLogger(__name__)


class Storage:
    def __init__(self, data_dir: Path) -> None:
        data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = data_dir / "archive.sqlite3"
        self.db = sqlite3.connect(self.db_path)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self._init_schema()

        client = chromadb.PersistentClient(path=str(data_dir / "chroma"))
        self.collection = client.get_or_create_collection(
            name="epub_chunks", metadata={"hnsw:space": "cosine"}
        )

    def _init_schema(self) -> None:
        self.db.executescript(
            """
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
            CREATE INDEX IF NOT EXISTS books_status ON books(status);
            CREATE INDEX IF NOT EXISTS books_cluster ON books(cluster_id);
            CREATE INDEX IF NOT EXISTS books_is_read ON books(is_read);
            """
        )
        self.db.commit()

        # Migrate existing tables if columns are missing
        cursor = self.db.execute("PRAGMA table_info(books)")
        existing_cols = {row["name"] for row in cursor.fetchall()}
        columns_to_add = [
            ("year", "TEXT NOT NULL DEFAULT ''"),
            ("original_title", "TEXT NOT NULL DEFAULT ''"),
            ("original_author", "TEXT NOT NULL DEFAULT ''"),
            ("publisher", "TEXT NOT NULL DEFAULT ''"),
            ("description", "TEXT NOT NULL DEFAULT ''"),
            ("chunk_count", "INTEGER NOT NULL DEFAULT 0"),
            ("chapter_count", "INTEGER NOT NULL DEFAULT 0"),
            ("cluster_id", "INTEGER DEFAULT -1"),
            ("cluster_label", "TEXT DEFAULT ''"),
            ("is_read", "INTEGER NOT NULL DEFAULT 0"),
            ("read_at", "TEXT DEFAULT NULL"),
        ]
        for col_name, col_type in columns_to_add:
            if col_name not in existing_cols:
                self.db.execute(f"ALTER TABLE books ADD COLUMN {col_name} {col_type}")
        self.db.commit()

    def is_unchanged(self, book_id: str, digest: str) -> bool:
        row = self.db.execute(
            "SELECT sha256, status FROM books WHERE id = ?", (book_id,)
        ).fetchone()
        return bool(row and row["sha256"] == digest and row["status"] == "done")

    def save_failure(
        self, book_id: str, digest: str, title: str, author: str, error: str
    ) -> None:
        self.db.execute(
            """
            INSERT INTO books (id, sha256, title, author, language, status, error)
            VALUES (?, ?, ?, ?, '', 'error', ?)
            ON CONFLICT(id) DO UPDATE SET
                sha256=excluded.sha256, title=excluded.title, author=excluded.author,
                status='error', error=excluded.error
            """,
            (book_id, digest, title, author, error),
        )
        self.db.commit()

    def save_book(
        self,
        book_id: str,
        digest: str,
        classification: dict[str, Any],
        language: str,
        chunks: list[dict[str, Any]],
        embeddings: list[list[float]],
        year: str = "",
        publisher: str = "",
        description: str = "",
        chapter_count: int = 0,
    ) -> None:
        if len(chunks) != len(embeddings):
            raise ValueError("El número de fragmentos y embeddings no coincide.")

        vector_ids = [str(chunk["id"]) for chunk in chunks]
        if chunks:
            self.collection.upsert(
                ids=vector_ids,
                embeddings=embeddings,
                documents=[str(chunk["content"]) for chunk in chunks],
                metadatas=[
                    {
                        "book_id": book_id,
                        "title": classification["title"],
                        "author": classification["author"],
                        "chapter": str(chunk.get("chapter", "")),
                        "year": str(year),
                    }
                    for chunk in chunks
                ],
            )

        self.db.execute("BEGIN")
        try:
            self.db.execute(
                """
                INSERT INTO books (
                    id, sha256, title, author, language, year,
                    original_title, original_author, publisher, description,
                    categories_json, summary, keywords_json, status, error,
                    processed_at, chunk_count, chapter_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'done', NULL, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    sha256=excluded.sha256, title=excluded.title,
                    author=excluded.author, language=excluded.language,
                    year=excluded.year, original_title=excluded.original_title,
                    original_author=excluded.original_author,
                    publisher=excluded.publisher, description=excluded.description,
                    categories_json=excluded.categories_json,
                    summary=excluded.summary, keywords_json=excluded.keywords_json,
                    status='done', error=NULL, processed_at=excluded.processed_at,
                    chunk_count=excluded.chunk_count, chapter_count=excluded.chapter_count
                """,
                (
                    book_id,
                    digest,
                    classification["title"],
                    classification["author"],
                    language,
                    year,
                    classification.get("original_title", classification["title"]),
                    classification.get("original_author", classification["author"]),
                    publisher,
                    description,
                    json.dumps(classification["categories"], ensure_ascii=False),
                    classification["summary"],
                    json.dumps(classification["keywords"], ensure_ascii=False),
                    datetime.now(timezone.utc).isoformat(),
                    len(chunks),
                    chapter_count,
                ),
            )
            self.db.execute("DELETE FROM chunks WHERE book_id = ?", (book_id,))
            self.db.executemany(
                """
                INSERT INTO chunks (id, book_id, chapter, content, vector_id, chunk_index)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        str(chunk["id"]),
                        book_id,
                        str(chunk.get("chapter", "")),
                        str(chunk["content"]),
                        str(chunk["id"]),
                        int(chunk.get("index", idx)),
                    )
                    for idx, chunk in enumerate(chunks)
                ],
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        # Remove stale vectors for this book from Chroma
        stale = self.collection.get(where={"book_id": book_id}, include=[])
        stale_ids = [item_id for item_id in stale["ids"] if item_id not in vector_ids]
        if stale_ids:
            self.collection.delete(ids=stale_ids)

    def save_manual_book(
        self,
        book_id: str,
        title: str,
        author: str,
        categories: list[str] | None = None,
        summary: str = "",
        keywords: list[str] | None = None,
        year: str = "",
        language: str = "es",
        publisher: str = "",
        description: str = "",
        original_title: str = "",
        original_author: str = "",
        content_sample: str = "",
        chapter_title: str = "Contenido Manual",
        ai: Any | None = None,
    ) -> dict[str, Any]:
        """Introduce o corrige manualmente un libro en el archivo, marcándolo como 'done' y limpiando cualquier error previo."""
        categories = categories or []
        keywords = keywords or []
        orig_title = original_title.strip() if original_title else title.strip()
        orig_author = original_author.strip() if original_author else author.strip()

        # Calcular o reutilizar sha256
        p = Path(book_id)
        digest = ""
        if p.is_file():
            hasher = hashlib.sha256()
            with p.open("rb") as f:
                for block in iter(lambda: f.read(1024 * 1024), b""):
                    hasher.update(block)
            digest = hasher.hexdigest()
        else:
            row = self.db.execute("SELECT sha256 FROM books WHERE id = ?", (book_id,)).fetchone()
            if row and row["sha256"]:
                digest = row["sha256"]
            else:
                digest = hashlib.sha256(book_id.encode("utf-8")).hexdigest()

        # Opcional: fragmento de texto manual
        chunks: list[dict[str, Any]] = []
        embeddings: list[list[float]] = []

        if content_sample and content_sample.strip():
            chunk_content = content_sample.strip()
            chunk_id = hashlib.sha256(f"{book_id}\0manual_chunk\0{chunk_content}".encode("utf-8")).hexdigest()
            chunks.append({
                "id": chunk_id,
                "chapter": chapter_title.strip() if chapter_title else "Contenido Manual",
                "content": chunk_content,
                "index": 0,
            })
            if ai is not None:
                try:
                    embeddings = ai.embed([chunk_content])
                except Exception as exc:
                    logger.warning("No se pudieron generar embeddings vectoriales para el fragmento manual: %s", exc)
                    embeddings = []

        vector_ids = [str(c["id"]) for c in chunks]
        if chunks and len(chunks) == len(embeddings):
            self.collection.upsert(
                ids=vector_ids,
                embeddings=embeddings,
                documents=[str(chunk["content"]) for chunk in chunks],
                metadatas=[
                    {
                        "book_id": book_id,
                        "title": title.strip(),
                        "author": author.strip(),
                        "chapter": str(chunk.get("chapter", "")),
                        "year": str(year).strip(),
                    }
                    for chunk in chunks
                ],
            )

        now = datetime.now(timezone.utc).isoformat()

        # Si no se pasó nuevo contenido, conservar conteo de fragmentos previos si existían
        if not chunks:
            existing_chunks = self.db.execute("SELECT COUNT(*) FROM chunks WHERE book_id = ?", (book_id,)).fetchone()[0]
            chunk_count = existing_chunks
            chapter_count = 1 if existing_chunks > 0 else 0
        else:
            chunk_count = len(chunks)
            chapter_count = 1

        self.db.execute("BEGIN")
        try:
            self.db.execute(
                """
                INSERT INTO books (
                    id, sha256, title, author, language, year,
                    original_title, original_author, publisher, description,
                    categories_json, summary, keywords_json, status, error,
                    processed_at, chunk_count, chapter_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'done', NULL, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    sha256=excluded.sha256, title=excluded.title,
                    author=excluded.author, language=excluded.language,
                    year=excluded.year, original_title=excluded.original_title,
                    original_author=excluded.original_author,
                    publisher=excluded.publisher, description=excluded.description,
                    categories_json=excluded.categories_json,
                    summary=excluded.summary, keywords_json=excluded.keywords_json,
                    status='done', error=NULL, processed_at=excluded.processed_at,
                    chunk_count=excluded.chunk_count, chapter_count=excluded.chapter_count
                """,
                (
                    book_id,
                    digest,
                    title.strip(),
                    author.strip(),
                    language.strip() or "es",
                    str(year).strip(),
                    orig_title,
                    orig_author,
                    publisher.strip(),
                    description.strip(),
                    json.dumps(categories, ensure_ascii=False),
                    summary.strip(),
                    json.dumps(keywords, ensure_ascii=False),
                    now,
                    chunk_count,
                    chapter_count,
                ),
            )
            if chunks:
                self.db.execute("DELETE FROM chunks WHERE book_id = ?", (book_id,))
                self.db.executemany(
                    """
                    INSERT INTO chunks (id, book_id, chapter, content, vector_id, chunk_index)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            str(c["id"]),
                            book_id,
                            str(c.get("chapter", "")),
                            str(c["content"]),
                            str(c["id"]),
                            c.get("index", 0),
                        )
                        for c in chunks
                    ],
                )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        row = self.db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
        return {
            **dict(row),
            "categories": json.loads(row["categories_json"]),
            "keywords": json.loads(row["keywords_json"]),
        }

    def delete_book(self, book_id: str) -> bool:
        """Elimina un libro de SQLite, sus fragmentos asociados y sus vectores en ChromaDB."""
        row = self.db.execute("SELECT id FROM books WHERE id = ?", (book_id,)).fetchone()
        if not row:
            return False
        self.db.execute("DELETE FROM chunks WHERE book_id = ?", (book_id,))
        self.db.execute("DELETE FROM books WHERE id = ?", (book_id,))
        self.db.commit()
        try:
            self.collection.delete(where={"book_id": book_id})
        except Exception:
            pass
        return True

    def search(
        self,
        embedding: list[float],
        limit: int,
        author: str | None = None,
    ) -> list[dict[str, Any]]:
        where_filter = None
        if author:
            where_filter = {"author": author}

        result = self.collection.query(
            query_embeddings=[embedding],
            n_results=limit,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )
        matches = []
        ids = result.get("ids", [[]])[0]
        for index, vector_id in enumerate(ids):
            matches.append(
                {
                    "id": vector_id,
                    "content": result["documents"][0][index],
                    "metadata": result["metadatas"][0][index],
                    "distance": result["distances"][0][index],
                }
            )
        return matches

    def list_books(
        self,
        limit: int,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        query = (
            "SELECT id, title, author, year, original_title, original_author, "
            "categories_json, summary, keywords_json, status, error, processed_at, "
            "chunk_count, chapter_count, cluster_id, cluster_label "
            "FROM books "
        )
        params: list[Any] = []
        if status:
            query += "WHERE status = ? "
            params.append(status)
        query += "ORDER BY title COLLATE NOCASE LIMIT ?"
        params.append(limit)

        rows = self.db.execute(query, params).fetchall()
        return [
            {
                **dict(row),
                "categories": json.loads(row["categories_json"]),
                "keywords": json.loads(row["keywords_json"]),
            }
            for row in rows
        ]

    def get_book_embeddings(self, book_id: str) -> list[list[float]]:
        """Retrieves all vector embeddings stored in ChromaDB for a given book."""
        data = self.collection.get(where={"book_id": book_id}, include=["embeddings"])
        embeddings = data.get("embeddings")
        if embeddings is None or len(embeddings) == 0:
            return []
        return [list(vec) for vec in embeddings]

    def update_book_cluster(self, book_id: str, cluster_id: int, cluster_label: str) -> None:
        self.db.execute(
            "UPDATE books SET cluster_id = ?, cluster_label = ? WHERE id = ?",
            (cluster_id, cluster_label, book_id),
        )
        self.db.commit()

    def get_stats(self) -> dict[str, Any]:
        """Calculates global analytics and summary metrics across the archive."""
        total_books = self.db.execute("SELECT COUNT(*) FROM books").fetchone()[0]
        done_books = self.db.execute("SELECT COUNT(*) FROM books WHERE status = 'done'").fetchone()[0]
        error_books = self.db.execute("SELECT COUNT(*) FROM books WHERE status = 'error'").fetchone()[0]
        total_chunks = self.db.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]

        rows = self.db.execute("SELECT categories_json FROM books WHERE status = 'done'").fetchall()
        category_counts: Counter[str] = Counter()
        for row in rows:
            cats = json.loads(row["categories_json"])
            for c in cats:
                category_counts[c] += 1

        clusters = self.db.execute(
            "SELECT cluster_id, cluster_label, COUNT(*) as count FROM books WHERE cluster_id >= 0 GROUP BY cluster_id"
        ).fetchall()

        return {
            "total_books": total_books,
            "processed_books": done_books,
            "failed_books": error_books,
            "total_chunks": total_chunks,
            "categories": dict(category_counts.most_common(15)),
            "clusters": [dict(c) for c in clusters],
        }

    def close(self) -> None:
        self.db.close()

