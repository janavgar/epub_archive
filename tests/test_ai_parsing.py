from epub_archive.ai import LocalAIClient


def test_ai_json_extraction_from_markdown_and_raw():
    client = LocalAIClient(base_url="http://fake-url")

    # Standard JSON inside markdown block
    text_md = """
    Aquí está la respuesta:
    ```json
    {
        "title": "Cien años de soledad",
        "author": "Gabriel García Márquez",
        "categories": ["Realismo mágico", "Ficción"],
        "summary": "Historia de la familia Buendía en Macondo.",
        "keywords": ["Macondo", "Buendía", "Soledad"]
    }
    ```
    """
    res = client._extract_json(text_md)
    assert res["title"] == "Cien años de soledad"
    assert res["author"] == "Gabriel García Márquez"
    assert "Realismo mágico" in res["categories"]

    # Thinking tags model output
    text_think = """
    <think>
    El libro es una obra cumbre.
    Categorías: Literatura clásica.
    </think>
    {
        "title": "Don Quijote",
        "author": "Cervantes",
        "categories": ["Clásicos"],
        "summary": "Aventuras de un caballero andante.",
        "keywords": ["caballero", "Sancho"]
    }
    """
    res2 = client._extract_json(text_think)
    assert res2["title"] == "Don Quijote"
    assert res2["author"] == "Cervantes"
