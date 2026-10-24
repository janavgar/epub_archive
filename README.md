# EPUB Archive

Pipeline local de 4 etapas para extraer, clasificar, agrupar temáticamente y buscar contenido en cientos de libros en formato EPUB.

Combina **SQLite** para el catálogo y metadatos estructurados, **ChromaDB** para la base de datos vectorial y modelos locales a través de cualquier servidor compatible con la API de OpenAI (por defecto **LM Studio** en `http://localhost:1234/v1`). La privacidad es total: los libros no salen de tu máquina.

---

## Arquitectura de 4 Etapas

1. **Extracción y Limpieza Profunda (`epub.py`)**:
   - Apertura del contenedor ZIP con `EbookLib`.
   - Limpieza estructural de HTML con `BeautifulSoup4`: eliminación de scripts, estilos, cabeceras, pies (`nav`, `header`, `footer`, `aside`, `svg`), anuncios y etiquetas de maquetación.
   - Normalización Unicode (NFKC) y eliminación de caracteres de control, guiones blandos y espacios especiales.
   - Extracción del **Índice real (TOC)** y metadatos Dublin Core (`título`, `autor`, `año`, `editorial`, `descripción/sinopsis`).

2. **Procesamiento Inteligente y Chunking Semántico (`chunking.py`)**:
   - Fragmentación respetando párrafos y unidades de sentido (sin cortar oraciones ni palabras a la mitad).
   - Solapamiento semántico configurable (`--overlap`, por defecto 150 caracteres) para mantener la continuidad contextual en los límites de cada fragmento.
   - Auto-detección inteligente del modelo de embeddings en LM Studio (`text-embedding-nomic-embed-text-v1.5`, `bge`, etc.).

3. **Capa de Inteligencia y Clasificación (`ai.py` & `clustering.py`)**:
   - **Estrategia "Resumen de Resúmenes"**: Sintetiza el índice formal, los primeros 3 capítulos (planteamiento) y el último (desenlace) para generar resúmenes de alta fidelidad sin saturar el contexto del LLM.
   - **Validación de Metadata con IA**: Compara los metadatos del archivo `.opf` frente a la portada/primer capítulo real y corrige automáticamente erratas en el título o autor.
   - **Clasificación Zero-Shot**: Asignación automática de categorías y palabras clave, con soporte para taxonomías predefinidas (`--categories "Ciencia, Ficción, Historia..."`).
   - **Clasificación por Clustering (Descubrimiento)**: Agrupamiento no supervisado mediante **HDBSCAN** sobre los centroides vectoriales de los libros, descubriendo grupos temáticos y etiquetándolos automáticamente.

4. **Almacenamiento Híbrido (`storage.py`)**:
   - **SQLite**: Título validado, autor, año, idioma, sinopsis, categorías, palabras clave, metadatos originales, conteo de capítulos y fragmentos, y etiquetas de cluster.
   - **ChromaDB**: Vectores semánticos de todos los fragmentos con metadatos asociados para búsqueda vectorial con filtros.

---

## Requisitos e Instalación

- Python 3.10 o superior (compatible con Python 3.14).
- Servidor local iniciado (por ejemplo LM Studio) en `http://localhost:1234/v1` con un modelo de chat y un modelo de embeddings cargados.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

O utilizando `uv`:

```bash
uv pip install -e ".[dev]"
```

### Configuración de Modelos (opcional)

El sistema auto-detecta el modelo de chat y el modelo de embeddings apropiado examinando `/v1/models`. Si prefieres fijarlos explícitamente:

```bash
export LM_STUDIO_BASE_URL=http://localhost:1234/v1
export LM_STUDIO_CHAT_MODEL="google/gemma-4-26b-a4b-qat"
export LM_STUDIO_EMBEDDING_MODEL="text-embedding-nomic-embed-text-v1.5"
```

---

## Aplicación Web (Next.js)

El proyecto incluye una aplicación web completa desarrollada en **Next.js** para gestionar y visualizar la biblioteca de forma interactiva en tu navegador.

### Iniciar la aplicación web

```bash
cd web
npm install
npm run dev
```

Abre tu navegador en **[http://localhost:3000](http://localhost:3000)**.

### Módulos de la Aplicación Web

1. **Dashboard y Estadísticas**: Métricas en vivo (libros procesados, chunks vectorizados, estado del servidor LM Studio, categorías más frecuentes).
2. **Biblioteca de Libros**: Vista en tarjetas con portadas dinámicas y vista en lista, filtros por categoría o estado, y modal de detalle con validación de metadatos OPF e inspección de fragmentos.
3. **Búsqueda Semántica con IA**: Buscador en lenguaje natural por similitud de coseno, consultas sugeridas y visualización de citas exactas.
4. **Clustering Temático (HDBSCAN)**: Ejecución y visualización de grupos temáticos descubiertos automáticamente.
5. **Procesador en Vivo**: Lanzador del pipeline con consola interactiva en tiempo real (SSE), barra de porcentaje animada y tiempo restante estimado (ETA).

---

## Guía de Uso del CLI

### 1. Procesar una colección de libros

```bash
epub-archive process ./mis-libros
```

El pipeline procesa los EPUBs uno a uno mostrando una barra de progreso interactiva con porcentaje, tiempo transcurrido y tiempo restante estimado (ETA). Si un libro falla por estar dañado, registra el error y continúa sin detener el proceso. Los libros no modificados se omiten automáticamente.

Opciones avanzadas:
```bash
# Reprocesar forzosamente y limitar a 20 libros
epub-archive process ./mis-libros --force --max-books 20

# Clasificación Zero-Shot con taxonomía fija
epub-archive process ./mis-libros --categories "Ficción, Historia, Filosofía, Ciencia, Tecnología, Biografía"

# Procesamiento ultrarrápido omitiendo vectores de fragmentos (solo metadata, resumen y categorías)
epub-archive process ./mis-libros --skip-embeddings

# Cambiar solapamiento entre fragmentos
epub-archive process ./mis-libros --overlap 200
```

### 2. Descubrimiento Temático por Clustering (HDBSCAN)

Agrupa libros similares entre sí de forma automática a partir de sus vectores:

```bash
epub-archive cluster
```

O forzando un número específico de clusters temáticos:
```bash
epub-archive cluster --n-clusters 4
```

### 3. Ver estadísticas del archivo

Consulta el estado general de la biblioteca, cuántos libros se han procesado, fragmentos indexados, top de categorías y clusters:

```bash
epub-archive stats
```

### 4. Buscar fragmentos semánticamente

Encuentra fragmentos y citas exactas por significado conceptual:

```bash
epub-archive search "paradoja de Schrödinger y superposición cuántica" --limit 5
epub-archive search "revolución francesa" --author "Stefan Zweig"
```

### 5. Listar libros del catálogo

```bash
# Listar todos los libros con sus categorías y resúmenes
epub-archive list --limit 50

# Listar únicamente libros que fallaron para inspeccionar el motivo
epub-archive list --status error
```

---

## Pruebas

Ejecuta la suite completa de pruebas unitarias:

```bash
pytest
```

