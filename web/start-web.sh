#!/bin/bash
set -e

# Configuración de entorno para el servicio en segundo plano
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/josea."
export PORT=3002
export NODE_ENV="production"

PROJECT_DIR="/Users/josea./Sistema/epub_archive"
WEB_DIR="$PROJECT_DIR/web"

cd "$WEB_DIR"

# Asegurar que la compilación de producción esté lista
if [ ! -f "$WEB_DIR/.next/BUILD_ID" ]; then
  /opt/homebrew/bin/npm run build
fi

# Arrancar Next.js en el puerto 3002
exec /opt/homebrew/bin/node "$WEB_DIR/node_modules/.bin/next" start -p 3002
