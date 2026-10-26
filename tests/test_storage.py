from epub_archive.storage import Storage


def test_storage_save_list_and_stats(tmp_path):
    storage = Storage(tmp_path)
    try:
        book_id = "book_1"
        digest = "sha256_dummy_1"
        classification = {
            "title": "Breve historia del tiempo",
            "author": "Stephen Hawking",
            "original_title": "A Brief History of Time",
            "original_author": "S. Hawking",
            "categories": ["Divulgación científica", "Física"],
            "summary": "Exploración de cosmología moderna y agujeros negros.",
            "keywords": ["cosmología", "agujeros negros", "big bang"],
        }
        chunks = [
            {"id": "chunk_1", "chapter": "Cap 1", "content": "Nuestra imagen del universo.", "index": 0},
            {"id": "chunk_2", "chapter": "Cap 2", "content": "Espacio y tiempo.", "index": 1},
        ]
        embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]

        storage.save_book(
            book_id=book_id,
            digest=digest,
            classification=classification,
            language="es",
            chunks=chunks,
            embeddings=embeddings,
            year="1988",
            publisher="Bantam Books",
            chapter_count=2,
        )

        books = storage.list_books(limit=10)
        assert len(books) == 1
        b = books[0]
        assert b["title"] == "Breve historia del tiempo"
        assert b["year"] == "1988"
        assert b["status"] == "done"
        assert "Divulgación científica" in b["categories"]

        # Check vector embeddings retrieval
        vecs = storage.get_book_embeddings(book_id)
        assert len(vecs) == 2

        # Check stats
        stats = storage.get_stats()
        assert stats["total_books"] == 1
        assert stats["processed_books"] == 1
        assert stats["total_chunks"] == 2
        assert stats["categories"]["Divulgación científica"] == 1

        # Check cluster update
        storage.update_book_cluster(book_id, 0, "Física y Cosmología")
        books_updated = storage.list_books(limit=10)
        assert books_updated[0]["cluster_id"] == 0
        assert books_updated[0]["cluster_label"] == "Física y Cosmología"

    finally:
        storage.close()


def test_storage_save_manual_book_recovers_error_and_deletes(tmp_path):
    storage = Storage(tmp_path)
    try:
        book_id = "/path/to/damaged_book.epub"
        # Simulate a failed book entry
        storage.save_failure(
            book_id=book_id,
            digest="fake_sha",
            title="Libro Corrupto",
            author="Desconocido",
            error="Bad Zip file: File is not a zip file",
        )

        # Verify error status
        errors = storage.list_books(limit=10, status="error")
        assert len(errors) == 1
        assert errors[0]["id"] == book_id
        assert errors[0]["status"] == "error"
        assert "Bad Zip" in errors[0]["error"]

        # Manually recover the book
        result = storage.save_manual_book(
            book_id=book_id,
            title="El Quijote de la Mancha",
            author="Miguel de Cervantes",
            categories=["Clásicos", "Novela de caballería"],
            summary="Aventuras del ingenioso hidalgo Don Quijote y Sancho Panza.",
            keywords=["hidalgo", "molinos", "caballero"],
            year="1605",
            language="es",
            publisher="Francisco de Robles",
            description="Obra cumbre de la literatura en español.",
            content_sample="En un lugar de la Mancha, de cuyo nombre no quiero acordarme...",
        )

        assert result["title"] == "El Quijote de la Mancha"
        assert result["author"] == "Miguel de Cervantes"
        assert result["status"] == "done"
        assert result["error"] is None
        assert result["year"] == "1605"
        assert result["chunk_count"] == 1
        assert "Clásicos" in result["categories"]

        # Now error list should be empty
        assert len(storage.list_books(limit=10, status="error")) == 0

        # And done list should have 1 book
        done_books = storage.list_books(limit=10, status="done")
        assert len(done_books) == 1
        assert done_books[0]["id"] == book_id
        assert done_books[0]["title"] == "El Quijote de la Mancha"

        # Verify deletion works
        deleted = storage.delete_book(book_id)
        assert deleted is True
        assert len(storage.list_books(limit=10)) == 0

    finally:
        storage.close()

