from __future__ import annotations

import re
import unicodedata
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import ebooklib
from bs4 import BeautifulSoup
from ebooklib import epub

# Suppress known harmless ebooklib warnings when opening EPUBs
warnings.filterwarnings("ignore", category=UserWarning, module="ebooklib")
warnings.filterwarnings("ignore", category=FutureWarning, module="ebooklib")


@dataclass(frozen=True)
class Chapter:
    title: str
    text: str


@dataclass(frozen=True)
class EpubContent:
    title: str
    author: str
    language: str
    chapters: list[Chapter]
    year: str = ""
    publisher: str = ""
    description: str = ""
    toc: list[str] = field(default_factory=list)


def _get_dc_metadata(book: epub.EpubBook, name: str, default: str = "") -> str:
    try:
        values = book.get_metadata("DC", name)
        if not values:
            return default
        first = values[0][0]
        if isinstance(first, str):
            clean = first.strip()
            return clean or default
        return str(first).strip() or default
    except Exception:
        return default


def _extract_year(date_str: str) -> str:
    if not date_str:
        return ""
    match = re.search(r"\b(1[89]\d{2}|20\d{2})\b", date_str)
    return match.group(1) if match else ""


def _extract_toc_titles(toc_items: list[Any]) -> list[str]:
    titles: list[str] = []
    for item in toc_items:
        if isinstance(item, epub.Link) and item.title:
            titles.append(item.title.strip())
        elif isinstance(item, (list, tuple)) and len(item) == 2:
            section, subitems = item
            if isinstance(section, epub.Section) and section.title:
                titles.append(section.title.strip())
            elif isinstance(section, epub.Link) and section.title:
                titles.append(section.title.strip())
            if isinstance(subitems, list):
                titles.extend(_extract_toc_titles(subitems))
    return [t for t in titles if t]


def extract_xhtml(content: bytes) -> tuple[str, str]:
    soup = BeautifulSoup(content, "html.parser")

    # Remove non-content, interactive, styling, and structural navigation noise
    noise_tags = [
        "script",
        "style",
        "noscript",
        "svg",
        "canvas",
        "header",
        "footer",
        "nav",
        "aside",
        "meta",
        "link",
    ]
    for element in soup(noise_tags):
        element.decompose()

    # Extract heading for title
    heading = soup.find(["h1", "h2", "h3", "h4"])
    title = heading.get_text(" ", strip=True) if heading else ""

    # Replace block level elements with newlines to preserve paragraph boundaries cleanly
    for block in soup.find_all(
        ["p", "div", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "hr", "br"]
    ):
        block.append(" \n\n ")

    raw_text = soup.get_text()

    # Normalize Unicode (NFKC handles ligatures, special spaces, smart chars)
    normalized = unicodedata.normalize("NFKC", raw_text)
    # Remove soft hyphens, zero-width spaces, and control characters (except \n, \t)
    normalized = re.sub(r"[\xad\u200b\u200c\u200d\ufeff]", "", normalized)
    normalized = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", normalized)

    # Clean lines and paragraphs
    paragraphs = []
    for chunk in normalized.split("\n\n"):
        clean_para = re.sub(r"[ \t]+", " ", chunk).strip()
        if clean_para:
            paragraphs.append(clean_para)

    clean_text = "\n\n".join(paragraphs)
    return title, clean_text


def read_epub(path: Path) -> EpubContent:
    book = epub.read_epub(str(path))
    ordered_items = []

    # Read items following spine order
    for item_id, _ in book.spine:
        item = book.get_item_with_id(item_id)
        if item and item.get_type() == ebooklib.ITEM_DOCUMENT:
            ordered_items.append(item)

    if not ordered_items:
        ordered_items = [
            item for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT)
        ]

    chapters: list[Chapter] = []
    for index, item in enumerate(ordered_items, start=1):
        try:
            raw_content = item.get_content()
        except Exception:
            continue
        title, text = extract_xhtml(raw_content)
        # Filter out stub pages or image-only pages (< 40 characters)
        if len(text.strip()) < 40:
            continue

        fallback = Path(item.get_name()).stem.replace("_", " ").strip()
        chapter_title = title or fallback or f"Capítulo {index}"
        chapters.append(Chapter(chapter_title, text))

    if not chapters:
        raise ValueError("El EPUB no contiene texto legible en su orden de lectura.")

    # Extract TOC from metadata/ncx
    toc_titles = _extract_toc_titles(getattr(book, "toc", []))

    # Extract Dublin Core metadata
    raw_date = _get_dc_metadata(book, "date")
    year = _extract_year(raw_date)
    raw_desc = _get_dc_metadata(book, "description")
    _, clean_desc = extract_xhtml(raw_desc.encode("utf-8", "ignore")) if raw_desc else ("", "")

    return EpubContent(
        title=_get_dc_metadata(book, "title", path.stem),
        author=_get_dc_metadata(book, "creator", "Desconocido"),
        language=_get_dc_metadata(book, "language", ""),
        year=year,
        publisher=_get_dc_metadata(book, "publisher", ""),
        description=clean_desc,
        chapters=chapters,
        toc=toc_titles,
    )
