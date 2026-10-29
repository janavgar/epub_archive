FROM node:24-bookworm-slim

# Copiar binarios de uv para gestionar el entorno Python y CLI
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Instalar dependencias mínimas del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    procps \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_INSTALL_DIR=/opt/python \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 1. Instalar la parte Python (epub-archive CLI, ChromaDB, SQLite, scikit-learn)
COPY pyproject.toml uv.lock README.md LICENSE ./
COPY src ./src

RUN uv python install 3.12 && \
    uv sync --frozen --no-dev --python 3.12

# 2. Instalar y compilar la parte Web (Next.js)
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# Preparar directorios de datos y punto de montaje de libros
RUN mkdir -p /app/.epub_archive "/Users/josea./Libros"

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /app/web

ENV NODE_ENV=production \
    PORT=3002 \
    UV_NO_SYNC=1 \
    LM_STUDIO_BASE_URL=http://host.docker.internal:1234/v1

EXPOSE 3002

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start", "--", "-p", "3002", "-H", "0.0.0.0"]
