from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path
from typing import Any

from epub_archive.ai import LocalAIClient
from epub_archive.chunking import TextChunk, chunk_chapters
from epub_archive.epub import EpubContent, read_epub
from epub_archive.storage import Storage

logger = logging.getLogger(__name__)


def _digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def _build_classification_sample(content: EpubContent, max_chars: int = 14000) -> str:
    """Builds a representative sample using TOC, metadata synopsis, initial chapters, and conclusion."""
    sections: list[str] = []

    # 1. Table of Contents (TOC)
    if content.toc:
        toc_snippet = "\n".join(f"- {title}" for title in content.toc[:35])
        sections.append(f"### ÍNDICE DE CONTENIDOS (TOC):\n{toc_snippet}")

    # 2. Metadata description/synopsis if present
    if content.description:
        sections.append(f"### SINOPSIS ORIGINAL DEL EPUB:\n{content.description[:1000]}")

    # 3. Key narrative chapters: first 3 chapters + last chapter (conclusion)
    chapters = content.chapters
    key_chapters = list(chapters[:3])
    if len(chapters) > 3:
        key_chapters.append(chapters[-1])

    # De-duplicate while preserving order
    unique_chapters = []
    seen = set()
    for ch in key_chapters:
        key = (ch.title, ch.text[:80])
        if key not in seen:
            seen.add(key)
            unique_chapters.append(ch)

    # Budget remaining characters across selected chapters
    current_len = sum(len(s) for s in sections)
    remaining = max(1000, max_chars - current_len)

    for idx, ch in enumerate(unique_chapters):
        heading = f"### SECCIÓN: {ch.title[:150]}\n"
        slots_left = len(unique_chapters) - idx
        char_budget = max(400, (remaining - len(heading)) // slots_left)
        body = ch.text[:char_budget].strip()
        part = f"{heading}{body}"
        sections.append(part)
        remaining -= len(part)

    return "\n\n".join(sections)[:max_chars]


def _chunk_records(book_id: str, chunks: list[TextChunk]) -> list[dict[str, Any]]:
    records = []
    for chunk in chunks:
        identity = hashlib.sha256(
            f"{book_id}\0{chunk.index}\0{chunk.chapter}\0{chunk.text}".encode("utf-8")
        ).hexdigest()
        records.append(
            {
                "id": identity,
                "chapter": chunk.chapter,
                "content": chunk.text,
                "index": chunk.index,
            }
        )
    return records


def process_directory(
    input_dir: Path,
    storage: Storage,
    ai: LocalAIClient,
    force: bool = False,
    max_books: int | None = None,
    candidate_categories: list[str] | None = None,
    overlap_chars: int = 150,
    skip_embeddings: bool = False,
) -> tuple[int, int, int]:
    """Processes an entire directory of EPUBs through the 4-stage pipeline."""
    if not input_dir.is_dir():
        raise ValueError(f"La ruta de entrada no es una carpeta: {input_dir}")

    paths = sorted(
        (
            path
            for path in input_dir.rglob("*")
            if path.is_file() and path.suffix.lower() == ".epub"
        ),
        key=lambda path: str(path).casefold(),
    )
    if max_books is not None:
        paths = paths[:max_books]

    total_count = len(paths)
    if total_count == 0:
        logger.warning("No se encontraron archivos .epub en %s", input_dir)
        return 0, 0, 0

    processed = skipped = failed = 0
    start_time = time.time()

    for idx, path in enumerate(paths, start=1):
        book_id = str(path.resolve())
        digest = ""
        title = path.stem
        author = "Desconocido"

        # Format progress and ETA
        elapsed = time.time() - start_time
        pct = (idx / total_count) * 100
        eta_sec = (elapsed / idx) * (total_count - idx) if idx > 1 else 0
        eta_str = f"{int(eta_sec // 60)}m {int(eta_sec % 60)}s" if eta_sec > 0 else "calculando..."

        print(
            f"[{idx}/{total_count}] ({pct:.1f}% | ETA: {eta_str}) Procesando: {path.name}",
            flush=True,
        )

        try:
            digest = _digest(path)
            if not force and storage.is_unchanged(book_id, digest):
                logger.info("Sin cambios, omitido: %s", path.name)
                skipped += 1
                continue

            # Stage 1: Extraction & Cleaning
            content = read_epub(path)
            title, author = content.title, content.author

            # Stage 2: Intelligence Layer (Metadata Validation & Summary of Summaries)
            sample = _build_classification_sample(content)
            classification = ai.classify(
                title=content.title,
                author=content.author,
                sample=sample,
                candidate_categories=candidate_categories,
                year=content.year,
            )

            if classification.get("title_corrected") or classification.get("author_corrected"):
                logger.info(
                    "Metadatos corregidos por IA para '%s': Título: '%s' -> '%s' | Autor: '%s' -> '%s'",
                    path.name,
                    content.title,
                    classification["title"],
                    content.author,
                    classification["author"],
                )

            # Stage 3: Semantic Chunking & Vectorization
            chunks = chunk_chapters(content.chapters, overlap_chars=overlap_chars)
            if not chunks:
                raise ValueError("No se pudieron crear fragmentos de texto válidos.")

            records = _chunk_records(book_id, chunks)

            embeddings: list[list[float]] = []
            if not skip_embeddings:
                texts = [r["content"] for r in records]
                embeddings = ai.embed(texts)

            # Stage 4: Storage
            storage.save_book(
                book_id=book_id,
                digest=digest,
                classification=classification,
                language=content.language,
                chunks=records,
                embeddings=embeddings,
                year=content.year,
                publisher=content.publisher,
                description=content.description,
                chapter_count=len(content.chapters),
            )

            cats_display = ", ".join(classification["categories"])
            logger.info("Completado '%s' -> Categorías: [%s] (%d fragmentos)", classification["title"], cats_display, len(records))
            processed += 1

        except Exception as exc:
            failed += 1
            logger.exception("Error al procesar libro %s: %s", path, exc)
            storage.save_failure(book_id, digest, title, author, str(exc))

    total_elapsed = time.time() - start_time
    logger.info(
        "Finalizado lote de %d libros en %.1fs: %d procesados, %d omitidos, %d fallidos.",
        total_count, total_elapsed, processed, skipped, failed
    )
    return processed, skipped, failed


def search(
    query: str,
    storage: Storage,
    ai: LocalAIClient,
    limit: int = 5,
    author: str | None = None,
) -> list[dict[str, Any]]:
    """Performs semantic similarity search over stored EPUB chunks."""
    if not query.strip():
        raise ValueError("La consulta de búsqueda no puede estar vacía.")
    if limit < 1 or limit > 100:
        raise ValueError("--limit debe estar entre 1 y 100.")

    embedding = ai.embed([query])[0]
    return storage.search(embedding=embedding, limit=limit, author=author)

