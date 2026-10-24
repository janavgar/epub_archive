from __future__ import annotations

import logging
from collections import Counter
from typing import Any

import numpy as np
from sklearn.cluster import HDBSCAN, AgglomerativeClustering

from epub_archive.ai import LocalAIClient
from epub_archive.storage import Storage

logger = logging.getLogger(__name__)


def cluster_archive(
    storage: Storage,
    ai: LocalAIClient | None = None,
    min_cluster_size: int = 2,
    n_clusters: int | None = None,
) -> dict[str, Any]:
    """Clusters all processed books in the archive based on the centroid of their chunk embeddings."""
    books = storage.list_books(limit=10000, status="done")
    if len(books) < 2:
        return {
            "status": "insufficient_data",
            "message": "Se necesitan al menos 2 libros procesados para realizar clustering.",
            "clusters": [],
        }

    book_vectors: list[np.ndarray] = []
    valid_books: list[dict[str, Any]] = []

    for b in books:
        vecs = storage.get_book_embeddings(b["id"])
        if not vecs:
            continue
        arr = np.array(vecs, dtype=np.float32)
        centroid = np.mean(arr, axis=0)
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm
        book_vectors.append(centroid)
        valid_books.append(b)

    if len(valid_books) < 2:
        return {
            "status": "insufficient_data",
            "message": "No se encontraron suficientes vectores indexados para agrupar libros.",
            "clusters": [],
        }

    matrix = np.array(book_vectors)

    # Perform clustering
    labels: np.ndarray
    if n_clusters is not None and n_clusters > 1:
        # User explicitly requested N clusters
        k = min(n_clusters, len(valid_books))
        clusterer = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average")
        labels = clusterer.fit_predict(matrix)
    else:
        # Default HDBSCAN density clustering
        effective_min_size = max(2, min(min_cluster_size, len(valid_books) // 2))
        hdb = HDBSCAN(
            min_cluster_size=effective_min_size,
            min_samples=1,
            metric="cosine",
        )
        labels = hdb.fit_predict(matrix)

        # Fallback to Agglomerative if HDBSCAN marked everything as noise (-1) on small collections
        unique_labels = set(labels) - {-1}
        if not unique_labels and len(valid_books) >= 2:
            k = max(2, min(3, len(valid_books)))
            fallback = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average")
            labels = fallback.fit_predict(matrix)

    # Group books by cluster
    clusters_map: dict[int, list[dict[str, Any]]] = {}
    for label, book in zip(labels, valid_books):
        clusters_map.setdefault(int(label), []).append(book)

    cluster_summaries: list[dict[str, Any]] = []

    for c_id, members in sorted(clusters_map.items()):
        # Determine descriptive label
        cat_counter: Counter[str] = Counter()
        key_counter: Counter[str] = Counter()
        for m in members:
            for cat in m.get("categories", []):
                cat_counter[cat] += 1
            for kw in m.get("keywords", []):
                key_counter[kw] += 1

        top_cats = [cat for cat, _ in cat_counter.most_common(2)]
        top_keys = [kw for kw, _ in key_counter.most_common(3)]

        if c_id == -1:
            label_text = "Sin grupo específico (Outliers / Dispersos)"
        elif top_cats:
            label_text = " / ".join(top_cats)
        elif top_keys:
            label_text = ", ".join(top_keys)
        else:
            label_text = f"Temática general {c_id + 1}"

        # Persist cluster assignment in database
        for m in members:
            storage.update_book_cluster(m["id"], c_id, label_text)

        cluster_summaries.append(
            {
                "cluster_id": c_id,
                "label": label_text,
                "book_count": len(members),
                "books": [
                    {
                        "title": m["title"],
                        "author": m["author"],
                        "categories": m["categories"],
                    }
                    for m in members
                ],
            }
        )

    return {
        "status": "success",
        "total_books_clustered": len(valid_books),
        "cluster_count": len([c for c in cluster_summaries if c["cluster_id"] >= 0]),
        "clusters": cluster_summaries,
    }
