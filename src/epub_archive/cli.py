from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from epub_archive.ai import LocalAIClient
from epub_archive.clustering import cluster_archive
from epub_archive.pipeline import process_directory, search
from epub_archive.storage import Storage


def _add_runtime_options(parser: argparse.ArgumentParser, defaults: bool) -> None:
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(".epub_archive") if defaults else argparse.SUPPRESS,
        help="Carpeta de SQLite y ChromaDB (predeterminada: .epub_archive).",
    )
    parser.add_argument(
        "--base-url",
        default=(
            os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
            if defaults
            else argparse.SUPPRESS
        ),
        help="URL base del endpoint compatible con OpenAI (por defecto: http://localhost:1234/v1).",
    )
    parser.add_argument(
        "--chat-model",
        default=(
            os.getenv("LM_STUDIO_CHAT_MODEL", "")
            if defaults
            else argparse.SUPPRESS
        ),
        help="Identificador del modelo para chat/clasificación.",
    )
    parser.add_argument(
        "--embedding-model",
        default=(
            os.getenv("LM_STUDIO_EMBEDDING_MODEL", "")
            if defaults
            else argparse.SUPPRESS
        ),
        help="Identificador del modelo para embeddings vectoriales.",
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="epub-archive",
        description="Extrae, clasifica, agrupa y busca libros EPUB con modelos locales.",
    )
    _add_runtime_options(parser, defaults=True)
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Process Command
    process_parser = subparsers.add_parser(
        "process", help="Procesa los EPUB de una carpeta a través del pipeline de 4 etapas."
    )
    _add_runtime_options(process_parser, defaults=False)
    process_parser.add_argument("input_dir", type=Path, help="Directorio con archivos .epub a procesar.")
    process_parser.add_argument(
        "--force", action="store_true", help="Reprocesa libros aunque no hayan cambiado."
    )
    process_parser.add_argument(
        "--max-books", type=int, help="Limita la cantidad máxima de libros procesados."
    )
    process_parser.add_argument(
        "--categories",
        type=str,
        help="Taxonomía para clasificación zero-shot (ej: 'Ciencia, Ficción, Historia, Filosofía').",
    )
    process_parser.add_argument(
        "--overlap",
        type=int,
        default=150,
        help="Caracteres de solapamiento semántico entre fragmentos (por defecto: 150).",
    )
    process_parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Omite la generación de vectores para clasificar a máxima velocidad.",
    )

    # Search Command
    search_parser = subparsers.add_parser(
        "search", help="Busca fragmentos relevantes por similitud semántica en ChromaDB."
    )
    _add_runtime_options(search_parser, defaults=False)
    search_parser.add_argument("query", help="Texto o pregunta a buscar.")
    search_parser.add_argument("--limit", type=int, default=5, help="Número de resultados a mostrar.")
    search_parser.add_argument("--author", type=str, help="Filtra resultados por autor.")

    # Cluster Command (Unsupervised Discovery)
    cluster_parser = subparsers.add_parser(
        "cluster", help="Agrupa libros por similitud temático-vectorial usando clustering (HDBSCAN)."
    )
    _add_runtime_options(cluster_parser, defaults=False)
    cluster_parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=2,
        help="Tamaño mínimo de cada cluster en HDBSCAN (por defecto: 2).",
    )
    cluster_parser.add_argument(
        "--n-clusters",
        type=int,
        help="Fuerza un número específico de grupos temáticos mediante clustering aglomerativo.",
    )

    # Stats Command
    stats_parser = subparsers.add_parser(
        "stats", help="Muestra estadísticas globales del archivo, categorías y clusters."
    )
    _add_runtime_options(stats_parser, defaults=False)

    # List Command
    list_parser = subparsers.add_parser(
        "list", help="Muestra títulos, metadatos y clasificaciones registradas."
    )
    _add_runtime_options(list_parser, defaults=False)
    list_parser.add_argument("--limit", type=int, default=100)
    list_parser.add_argument("--status", choices=["done", "error"], help="Filtra por estado del libro.")

    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr
    )
    parser = _parser()
    args = parser.parse_args()

    if args.command == "process" and args.max_books is not None and args.max_books < 1:
        parser.error("--max-books debe ser mayor que cero.")

    storage = None
    try:
        storage = Storage(args.data_dir)
        ai = LocalAIClient(args.base_url, args.chat_model, args.embedding_model)

        if args.command == "process":
            categories_list = None
            if getattr(args, "categories", None):
                categories_list = [c.strip() for c in args.categories.split(",") if c.strip()]

            processed, skipped, failed = process_directory(
                input_dir=args.input_dir,
                storage=storage,
                ai=ai,
                force=args.force,
                max_books=args.max_books,
                candidate_categories=categories_list,
                overlap_chars=args.overlap,
                skip_embeddings=args.skip_embeddings,
            )
            print(
                f"\nResultado final: {processed} procesados, {skipped} sin cambios, "
                f"{failed} fallidos."
            )
            if failed:
                raise SystemExit(1)

        elif args.command == "search":
            matches = search(
                query=args.query,
                storage=storage,
                ai=ai,
                limit=args.limit,
                author=getattr(args, "author", None),
            )
            if not matches:
                print("No se encontraron fragmentos relevantes. Procesa primero una colección.")
                return

            print(f"\nResultados para: '{args.query}'\n")
            for number, match in enumerate(matches, start=1):
                meta = match["metadata"]
                year_info = f" ({meta['year']})" if meta.get("year") else ""
                print(
                    f"[{number}] {meta.get('title', 'Sin título')} — "
                    f"{meta.get('author', 'Autor desconocido')}{year_info} | "
                    f"{meta.get('chapter', 'Capítulo')} (distancia: {match['distance']:.3f})"
                )
                print("-" * 60)
                print(match["content"].strip())
                print()

        elif args.command == "cluster":
            print("Analizando vectores de libros y calculando clusters temáticos...")
            result = cluster_archive(
                storage=storage,
                ai=ai,
                min_cluster_size=args.min_cluster_size,
                n_clusters=args.n_clusters,
            )
            if result.get("status") == "insufficient_data":
                print(f"Aviso: {result['message']}")
                return

            print(f"\nAgrupamiento completado: {result['total_books_clustered']} libros analizados en {result['cluster_count']} grupos temáticos:\n")
            for cluster in result["clusters"]:
                c_id = cluster["cluster_id"]
                prefix = f"Grupo #{c_id + 1}" if c_id >= 0 else "Outliers"
                print(f"=== {prefix}: {cluster['label']} ({cluster['book_count']} libros) ===")
                for b in cluster["books"]:
                    cats = ", ".join(b["categories"])
                    print(f"  • {b['title']} — {b['author']} [{cats}]")
                print()

        elif args.command == "stats":
            stats = storage.get_stats()
            print("\n=== ESTADO DEL ARCHIVO EPUB ===")
            print(f"Total libros registrados : {stats['total_books']}")
            print(f"  • Procesados con éxito : {stats['processed_books']}")
            print(f"  • Fallidos con error   : {stats['failed_books']}")
            print(f"Total fragmentos (chunks): {stats['total_chunks']}")
            print("\nCategorías más frecuentes:")
            for cat, count in stats["categories"].items():
                print(f"  • {cat}: {count} libros")
            if stats["clusters"]:
                print("\nClusters temáticos descubiertos:")
                for cl in stats["clusters"]:
                    print(f"  • Grupo #{cl['cluster_id'] + 1} ({cl['cluster_label']}): {cl['count']} libros")
            print()

        elif args.command == "list":
            if args.limit < 1 or args.limit > 500:
                parser.error("--limit debe estar entre 1 y 500.")
            books = storage.list_books(args.limit, status=getattr(args, "status", None))
            if not books:
                print("No hay libros registrados con los criterios solicitados.")
                return
            for book in books:
                categories = ", ".join(book["categories"]) or "Sin clasificar"
                year_str = f" ({book['year']})" if book.get("year") else ""
                cluster_str = f" [Grupo: {book['cluster_label']}]" if book.get("cluster_label") else ""
                print(f"{book['title']} — {book['author']}{year_str} [{book['status']}]{cluster_str}")
                print(f"  Categorías: {categories}")
                if book.get("summary"):
                    print(f"  Resumen: {book['summary']}")
                if book.get("keywords"):
                    print(f"  Palabras clave: {', '.join(book['keywords'])}")
                if book.get("error"):
                    print(f"  Error registrado: {book['error']}")
                print()

    except (ValueError, RuntimeError) as exc:
        parser.exit(1, f"Error: {exc}\n")
    finally:
        if storage:
            storage.close()


if __name__ == "__main__":
    main()

