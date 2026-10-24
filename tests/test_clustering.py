from epub_archive.clustering import cluster_archive
from epub_archive.storage import Storage


def test_clustering_with_synthetic_vectors(tmp_path):
    storage = Storage(tmp_path)
    try:
        # Book 1: Physics
        storage.save_book(
            book_id="book_phys_1",
            digest="hash1",
            classification={
                "title": "Física Cuántica Básica",
                "author": "Dr. Planck",
                "categories": ["Física", "Ciencia"],
                "summary": "Conceptos cuánticos.",
                "keywords": ["fotones", "energía"],
            },
            language="es",
            chunks=[{"id": "c1", "content": "Texto cuántico 1", "chapter": "1", "index": 0}],
            embeddings=[[1.0, 0.9, 0.0, 0.0]],
        )
        # Book 2: Physics
        storage.save_book(
            book_id="book_phys_2",
            digest="hash2",
            classification={
                "title": "Partículas y Ondas",
                "author": "Dr. Bohr",
                "categories": ["Física", "Ciencia"],
                "summary": "Mecánica cuántica y átomos.",
                "keywords": ["átomos", "electrones"],
            },
            language="es",
            chunks=[{"id": "c2", "content": "Texto cuántico 2", "chapter": "1", "index": 0}],
            embeddings=[[0.95, 0.85, 0.05, 0.0]],
        )
        # Book 3: History
        storage.save_book(
            book_id="book_hist_1",
            digest="hash3",
            classification={
                "title": "Historia de Roma",
                "author": "Prof. Caesar",
                "categories": ["Historia", "Imperio"],
                "summary": "El imperio romano y sus legiones.",
                "keywords": ["Roma", "senado"],
            },
            language="es",
            chunks=[{"id": "c3", "content": "Texto romano", "chapter": "1", "index": 0}],
            embeddings=[[0.0, 0.0, 0.9, 1.0]],
        )

        res = cluster_archive(storage, n_clusters=2)
        assert res["status"] == "success"
        assert res["total_books_clustered"] == 3
        assert len(res["clusters"]) >= 1

        # Check that books in DB now have cluster assigned
        books = storage.list_books(limit=10)
        assert all(b["cluster_id"] is not None for b in books)

    finally:
        storage.close()
