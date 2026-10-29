from __future__ import annotations

import argparse
import logging
import signal
import sys
from pathlib import Path

from epub_archive.ai import (
    PROVIDER_PRESETS,
    AIConfig,
    LocalAIClient,
    get_config_path,
    load_ai_config,
    save_ai_config,
)
from epub_archive.clustering import cluster_archive
from epub_archive.pipeline import process_directory, search
from epub_archive.storage import Storage

logger = logging.getLogger("epub_archive")


def _add_runtime_options(parser: argparse.ArgumentParser, defaults: bool) -> None:
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(".epub_archive") if defaults else argparse.SUPPRESS,
        help="Carpeta de SQLite, ChromaDB y configuración (predeterminada: .epub_archive).",
    )
    parser.add_argument(
        "--provider",
        choices=list(PROVIDER_PRESETS.keys()),
        default=None if defaults else argparse.SUPPRESS,
        help="Proveedor de IA para chat/clasificación (lm_studio, ollama, llamacpp, vllm, openai, gemini, openrouter, custom).",
    )
    parser.add_argument(
        "--base-url",
        default=None if defaults else argparse.SUPPRESS,
        help="URL base del endpoint compatible con OpenAI (ej: http://localhost:1234/v1 o http://localhost:11434/v1).",
    )
    parser.add_argument(
        "--api-key",
        default=None if defaults else argparse.SUPPRESS,
        help="Clave API opcional para el proveedor de IA.",
    )
    parser.add_argument(
        "--chat-model",
        default=None if defaults else argparse.SUPPRESS,
        help="Identificador del modelo para chat/clasificación.",
    )
    parser.add_argument(
        "--embedding-model",
        default=None if defaults else argparse.SUPPRESS,
        help="Identificador del modelo para embeddings vectoriales.",
    )
    parser.add_argument(
        "--embedding-provider",
        choices=list(PROVIDER_PRESETS.keys()),
        default=None if defaults else argparse.SUPPRESS,
        help="Proveedor específico para embeddings si es distinto al de chat.",
    )
    parser.add_argument(
        "--embedding-base-url",
        default=None if defaults else argparse.SUPPRESS,
        help="URL base específica para el servidor de embeddings.",
    )
    parser.add_argument(
        "--embedding-api-key",
        default=None if defaults else argparse.SUPPRESS,
        help="Clave API específica para el proveedor de embeddings.",
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="epub-archive",
        description="Extrae, clasifica, agrupa y busca libros EPUB con backends de IA configurables.",
    )
    _add_runtime_options(parser, defaults=True)
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Config Command
    config_parser = subparsers.add_parser(
        "config",
        help="Muestra, prueba o guarda la configuración del backend de IA (LM Studio, Ollama, OpenAI, Gemini, etc.).",
    )
    _add_runtime_options(config_parser, defaults=False)
    config_parser.add_argument(
        "--separate-embedding",
        dest="separate_embedding",
        action="store_true",
        default=None,
        help="Habilita el uso de un proveedor independiente para los embeddings.",
    )
    config_parser.add_argument(
        "--same-embedding",
        dest="separate_embedding",
        action="store_false",
        default=None,
        help="Usa el mismo proveedor tanto para chat como para embeddings.",
    )
    config_parser.add_argument(
        "--test",
        action="store_true",
        help="Prueba la conexión con el backend configurado y lista los modelos disponibles.",
    )
    config_parser.add_argument(
        "--reset",
        action="store_true",
        help="Restablece la configuración por defecto (LM Studio en localhost:1234).",
    )

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

    # Manual Add / Correct Command
    manual_parser = subparsers.add_parser(
        "manual",
        help="Introduce o subsana manualmente un libro en el catálogo (útil si falló el proceso automático).",
    )
    _add_runtime_options(manual_parser, defaults=False)
    manual_parser.add_argument("book_id", help="Ruta del archivo EPUB o identificador único del libro.")
    manual_parser.add_argument("--title", required=True, help="Título del libro.")
    manual_parser.add_argument("--author", required=True, help="Autor del libro.")
    manual_parser.add_argument("--categories", help="Categorías separadas por comas (ej: 'Ciencia, Ficción').")
    manual_parser.add_argument("--summary", default="", help="Resumen o síntesis ejecutiva del libro.")
    manual_parser.add_argument("--keywords", help="Palabras clave separadas por comas.")
    manual_parser.add_argument("--year", default="", help="Año de publicación.")
    manual_parser.add_argument("--language", default="es", help="Idioma (predeterminado: 'es').")
    manual_parser.add_argument("--publisher", default="", help="Editorial.")
    manual_parser.add_argument("--description", default="", help="Sinopsis o descripción del libro.")
    manual_parser.add_argument("--original-title", default="", help="Título original.")
    manual_parser.add_argument("--original-author", default="", help="Autor original.")

    # Delete Command
    delete_parser = subparsers.add_parser(
        "delete", help="Elimina un libro de la base de datos y opcionalmente del almacenamiento físico."
    )
    _add_runtime_options(delete_parser, defaults=False)
    delete_parser.add_argument("book_id", help="Ruta o ID del libro a eliminar.")
    delete_parser.add_argument(
        "--delete-file",
        action="store_true",
        help="Elimina también permanentemente el archivo .epub del disco.",
    )

    # Duplicates Command
    dup_parser = subparsers.add_parser(
        "duplicates", help="Identifica libros duplicados por hash SHA-256 o por título y autor."
    )
    _add_runtime_options(dup_parser, defaults=False)
    dup_parser.add_argument(
        "--by",
        choices=["sha256", "title", "both"],
        default="both",
        help="Criterio de detección: 'sha256' (idénticos), 'title' (mismo título y autor) o 'both' (ambos).",
    )

    return parser


def _handle_config_command(args: argparse.Namespace) -> None:
    if getattr(args, "reset", False):
        cfg = AIConfig()
        path = save_ai_config(cfg, args.data_dir)
        print(f"Configuración de IA restablecida a valores por defecto en: {path}")
    else:
        current = load_ai_config(args.data_dir)
        updated_dict = current.to_dict()
        changed = False

        if args.provider is not None:
            updated_dict["provider"] = args.provider
            if args.base_url is None and args.provider != current.provider:
                updated_dict["base_url"] = PROVIDER_PRESETS[args.provider]["default_base_url"]
            changed = True
        if args.base_url is not None:
            updated_dict["base_url"] = args.base_url
            changed = True
        if args.api_key is not None:
            updated_dict["api_key"] = args.api_key
            changed = True
        if args.chat_model is not None:
            updated_dict["chat_model"] = args.chat_model
            changed = True
        if args.embedding_model is not None:
            updated_dict["embedding_model"] = args.embedding_model
            changed = True
        if getattr(args, "separate_embedding", None) is not None:
            updated_dict["separate_embedding"] = bool(args.separate_embedding)
            changed = True
        if args.embedding_provider is not None:
            updated_dict["embedding_provider"] = args.embedding_provider
            updated_dict["separate_embedding"] = True
            if args.embedding_base_url is None and args.embedding_provider != current.embedding_provider:
                updated_dict["embedding_base_url"] = PROVIDER_PRESETS[args.embedding_provider]["default_base_url"]
            changed = True
        if args.embedding_base_url is not None:
            updated_dict["embedding_base_url"] = args.embedding_base_url
            updated_dict["separate_embedding"] = True
            changed = True
        if args.embedding_api_key is not None:
            updated_dict["embedding_api_key"] = args.embedding_api_key
            changed = True

        cfg = AIConfig.from_dict(updated_dict)
        if changed:
            path = save_ai_config(cfg, args.data_dir)
            print(f"Configuración de IA guardada en: {path}")

    preset_name = PROVIDER_PRESETS.get(cfg.provider, {}).get("name", cfg.provider)
    emb_preset_name = PROVIDER_PRESETS.get(cfg.embedding_provider, {}).get("name", cfg.embedding_provider)

    print("\n=== CONFIGURACIÓN DE BACKEND DE IA ===")
    print(f"Archivo config       : {get_config_path(args.data_dir)}")
    print(f"Proveedor Chat       : {preset_name} ({cfg.provider})")
    print(f"URL Chat             : {cfg.base_url}")
    print(f"API Key Chat         : {'Configurada (***)' if cfg.api_key else 'No requerida / vacía'}")
    print(f"Modelo Chat          : {cfg.chat_model or '(Detección automática)'}")
    if cfg.separate_embedding:
        print(f"Embeddings separados : Sí")
        print(f"Proveedor Embeddings : {emb_preset_name} ({cfg.embedding_provider})")
        print(f"URL Embeddings       : {cfg.embedding_base_url}")
        print(f"API Key Embeddings   : {'Configurada (***)' if cfg.embedding_api_key else 'No requerida / vacía'}")
    else:
        print(f"Embeddings separados : No (usa el mismo backend de Chat)")
    print(f"Modelo Embeddings    : {cfg.embedding_model or '(Detección automática)'}")
    print()

    if getattr(args, "test", False):
        client = LocalAIClient(config=cfg, data_dir=args.data_dir)
        print("Probando conexión con el servidor de Chat...")
        try:
            models = client._fetch_available_models()
            rec_chat = client.get_chat_model() if models else "(ninguno)"
            print(f"  [OK] Conectado a {client.base_url} ({len(models)} modelos detectados)")
            print(f"  Modelo de chat activo : {rec_chat}")
            if models:
                print(f"  Modelos disponibles   : {', '.join(models[:10])}{'...' if len(models) > 10 else ''}")
        except Exception as exc:
            print(f"  [ERROR] Falló conexión de Chat: {exc}")

        print("\nProbando conexión con el servidor de Embeddings...")
        try:
            emb_models = client._fetch_available_embedding_models()
            rec_emb = client.get_embedding_model() if emb_models else "(ninguno)"
            print(f"  [OK] Conectado a {client.embedding_base_url} ({len(emb_models)} modelos detectados)")
            print(f"  Modelo embeddings activo: {rec_emb}")
        except Exception as exc:
            print(f"  [ERROR] Falló conexión de Embeddings: {exc}")
        print()


def main() -> None:
    def _sig_handler(signum, frame):
        raise KeyboardInterrupt

    try:
        signal.signal(signal.SIGTERM, _sig_handler)
    except (ValueError, AttributeError):
        pass

    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr
    )
    parser = _parser()
    args = parser.parse_args()

    if args.command == "process" and args.max_books is not None and args.max_books < 1:
        parser.error("--max-books debe ser mayor que cero.")

    if args.command == "config":
        try:
            _handle_config_command(args)
        except (ValueError, RuntimeError) as exc:
            parser.exit(1, f"Error: {exc}\n")
        return

    storage = None
    try:
        storage = Storage(args.data_dir)
        ai = LocalAIClient(
            base_url=args.base_url,
            chat_model=args.chat_model,
            embedding_model=args.embedding_model,
            provider=args.provider,
            api_key=args.api_key,
            embedding_provider=args.embedding_provider,
            embedding_base_url=args.embedding_base_url,
            embedding_api_key=args.embedding_api_key,
            data_dir=args.data_dir,
        )

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
                if meta.get("book_id"):
                    print(f"BookID: {meta['book_id']}")
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

        elif args.command == "manual":
            cats = [c.strip() for c in args.categories.split(",") if c.strip()] if getattr(args, "categories", None) else []
            keys = [k.strip() for k in args.keywords.split(",") if k.strip()] if getattr(args, "keywords", None) else []

            book = storage.save_manual_book(
                book_id=args.book_id,
                title=args.title,
                author=args.author,
                categories=cats,
                summary=getattr(args, "summary", "") or "",
                keywords=keys,
                year=getattr(args, "year", "") or "",
                language=getattr(args, "language", "es") or "es",
                publisher=getattr(args, "publisher", "") or "",
                description=getattr(args, "description", "") or "",
                original_title=getattr(args, "original_title", "") or "",
                original_author=getattr(args, "original_author", "") or "",
                content_sample=getattr(args, "content", "") or "",
                ai=ai,
            )
            print(f"\nLibro introducido/subsanado manualmente con éxito:")
            print(f"  • ID/Ruta   : {book['id']}")
            print(f"  • Título    : {book['title']}")
            print(f"  • Autor     : {book['author']}")
            if book.get("year"):
                print(f"  • Año       : {book['year']}")
            if book.get("categories"):
                print(f"  • Categorías: {', '.join(book['categories'])}")
            print(f"  • Estado    : {book['status']}")
            print()

        elif args.command == "delete":
            deleted = storage.delete_book(args.book_id, delete_file=args.delete_file)
            if deleted:
                msg = f"Libro eliminado de la base de datos (SQLite y ChromaDB): '{args.book_id}'"
                if args.delete_file:
                    msg += " y del almacenamiento físico en disco."
                else:
                    msg += " (archivo físico conservado en disco)."
                print(msg)
            else:
                print(f"Error: No se encontró ningún libro con identificador '{args.book_id}'.", file=sys.stderr)
                raise SystemExit(1)

        elif args.command == "duplicates":
            groups = storage.find_duplicates(by=args.by)
            if not groups:
                print(f"No se detectaron libros duplicados en el archivo (criterio: {args.by}).")
                return

            total_dupes = sum(len(g["books"]) for g in groups)
            print(f"\n=== LIBROS DUPLICADOS DETECTADOS ===")
            print(f"Total grupos: {len(groups)} | Total libros implicados: {total_dupes}\n")

            for idx, g in enumerate(groups, start=1):
                type_desc = "Hash SHA-256 idéntico" if g["type"] == "sha256" else "Mismo título y autor"
                print(f"[{idx}] {g['title']} — {g['author']} ({g['count']} copias) [{type_desc}]")
                for b in g["books"]:
                    exists_str = "Existe en disco" if b.get("file_exists") else "NO encontrado en disco"
                    print(f"    • [{b['status']}] {b['id']} ({exists_str})")
                print()

    except KeyboardInterrupt:
        logger.info("Proceso detenido por el usuario.")
        sys.exit(130)
    except (ValueError, RuntimeError) as exc:
        parser.exit(1, f"Error: {exc}\n")
    finally:
        if storage:
            storage.close()


if __name__ == "__main__":
    main()
