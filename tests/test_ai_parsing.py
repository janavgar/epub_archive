from epub_archive.ai import (
    AIConfig,
    LocalAIClient,
    infer_provider_from_url,
    load_ai_config,
    normalize_base_url,
    save_ai_config,
)


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


def test_ai_config_persistence_and_separate_embedding_backend(tmp_path):
    assert normalize_base_url("http://localhost:11434", "ollama") == "http://localhost:11434/v1"
    assert infer_provider_from_url("http://localhost:11434/v1") == "ollama"
    assert infer_provider_from_url("http://localhost:1234/v1") == "lm_studio"

    cfg = AIConfig.from_dict(
        {
            "provider": "ollama",
            "base_url": "http://localhost:11434",
            "chat_model": "llama3.2",
            "embedding_model": "nomic-embed-text",
            "separate_embedding": True,
            "embedding_provider": "lm_studio",
            "embedding_base_url": "http://localhost:1234",
        }
    )
    saved_path = save_ai_config(cfg, tmp_path)
    assert saved_path.is_file()

    loaded = load_ai_config(tmp_path)
    assert loaded.provider == "ollama"
    assert loaded.base_url == "http://localhost:11434/v1"
    assert loaded.chat_model == "llama3.2"
    assert loaded.separate_embedding is True
    assert loaded.embedding_provider == "lm_studio"
    assert loaded.embedding_base_url == "http://localhost:1234/v1"
    assert loaded.embedding_model == "nomic-embed-text"

    client = LocalAIClient(data_dir=tmp_path)
    assert client.provider == "ollama"
    assert client.base_url == "http://localhost:11434/v1"
    assert client.get_chat_model() == "llama3.2"
    assert client.embedding_provider == "lm_studio"
    assert client.embedding_base_url == "http://localhost:1234/v1"
    assert client.get_embedding_model() == "nomic-embed-text"
