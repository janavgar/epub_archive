from __future__ import annotations

import re
from dataclasses import dataclass

from epub_archive.epub import Chapter


@dataclass(frozen=True)
class TextChunk:
    chapter: str
    index: int
    text: str

    @property
    def char_count(self) -> int:
        return len(self.text)


def _split_long_block(text: str, max_chars: int) -> list[str]:
    # Split sentences cleanly on punctuation followed by whitespace
    sentences = re.split(r"(?<=[.!?])\s+", text)
    pieces: list[str] = []
    current = ""

    for sentence in sentences:
        while len(sentence) > max_chars:
            if current:
                pieces.append(current)
                current = ""
            pieces.append(sentence[:max_chars])
            sentence = sentence[max_chars:]

        candidate = f"{current} {sentence}".strip() if current else sentence
        if current and len(candidate) > max_chars:
            pieces.append(current)
            current = sentence
        else:
            current = candidate

    if current:
        pieces.append(current)
    return pieces


def chunk_chapters(
    chapters: list[Chapter],
    target_chars: int = 1800,
    max_chars: int = 2400,
    overlap_chars: int = 0,
) -> list[TextChunk]:
    if target_chars < 1 or max_chars < target_chars:
        raise ValueError("Los límites de chunk deben cumplir 1 <= objetivo <= máximo.")
    if overlap_chars < 0 or overlap_chars >= target_chars:
        raise ValueError("El solapamiento (overlap) debe ser >= 0 y menor que target_chars.")

    chunks: list[TextChunk] = []

    for chapter in chapters:
        # Separate text into paragraph blocks
        blocks = [b.strip() for b in chapter.text.split("\n\n") if b.strip()]
        if not blocks:
            blocks = [b.strip() for b in chapter.text.splitlines() if b.strip()]

        current = ""
        chapter_chunks: list[str] = []

        for block in blocks:
            pieces = (
                _split_long_block(block, max_chars)
                if len(block) > max_chars
                else [block]
            )
            for piece in pieces:
                candidate = f"{current}\n\n{piece}".strip() if current else piece
                if current and len(candidate) > target_chars:
                    chapter_chunks.append(current)
                    if overlap_chars > 0 and len(current) > overlap_chars:
                        # Extract overlap window from the end of current chunk
                        tail = current[-overlap_chars:].strip()
                        # Align to nearest sentence or word boundary
                        boundary = tail.find(". ")
                        if boundary != -1 and boundary + 2 < len(tail):
                            tail = tail[boundary + 2:].strip()
                        current = f"{tail}\n\n{piece}".strip()
                    else:
                        current = piece
                else:
                    current = candidate

        if current:
            chapter_chunks.append(current)

        for text in chapter_chunks:
            chunks.append(TextChunk(chapter.title, len(chunks), text))

    return chunks

