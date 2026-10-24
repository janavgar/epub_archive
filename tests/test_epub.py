from epub_archive.epub import _extract_year, extract_xhtml


def test_xhtml_clean_removes_noise_and_preserves_paragraphs():
    html = b"""
    <html>
        <head><title>Test Book</title><style>.body { color: red; }</style></head>
        <body>
            <header><nav><a href="#ch1">Menu</a></nav></header>
            <h1>Capitulo Primero</h1>
            <p>Este es el primer parrafo con <b>texto en negrita</b>.</p>
            <script>console.log("bad");</script>
            <p>Segundo parrafo con informacion relevante.</p>
            <footer>Pie de pagina irrelevante</footer>
        </body>
    </html>
    """
    title, text = extract_xhtml(html)
    assert title == "Capitulo Primero"
    assert "primer parrafo" in text
    assert "texto en negrita" in text
    assert "Segundo parrafo" in text
    assert "console.log" not in text
    assert "Pie de pagina irrelevante" not in text
    assert "Menu" not in text


def test_extract_year_handles_various_formats():
    assert _extract_year("2021-05-12") == "2021"
    assert _extract_year("1984") == "1984"
    assert _extract_year("Publicado en 1995 por Editorial") == "1995"
    assert _extract_year("circa 1850") == "1850"
    assert _extract_year("") == ""
    assert _extract_year("fecha desconocida") == ""
