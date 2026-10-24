from epub_archive.chunking import chunk_chapters
from epub_archive.epub import Chapter, extract_xhtml


def test_chunking_keeps_short_paragraphs_together_and_respects_maximum():
    chunks = chunk_chapters(
        [
            Chapter(
                "Capítulo 1",
                "Primer párrafo.\n\nSegundo párrafo.\n\n" + "Largo. " * 80,
            )
        ],
        target_chars=40,
        max_chars=60,
    )

    assert chunks
    assert all(len(chunk.text) <= 60 for chunk in chunks)
    assert chunks[0].text == "Primer párrafo.\n\nSegundo párrafo."


def test_html_extraction_removes_non_content_elements():
    title, text = extract_xhtml(
        b"<html><body><h1>Capitulo</h1><p>Texto util.</p>"
        b"<script>ruido()</script><style>.x{}</style></body></html>"
    )

    assert title == "Capitulo"
    assert "Texto util." in text
    assert "ruido" not in text
    assert ".x" not in text
