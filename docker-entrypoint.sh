#!/bin/sh
set -e

mkdir -p /disk /app/.epub_archive

DISK_IMG="/disk/epub_archive_30gb.img"

if [ ! -f "$DISK_IMG" ]; then
  echo "Creando disco virtual sparse ext4 de 30 GB en $DISK_IMG..."
  truncate -s 30G "$DISK_IMG"
  mkfs.ext4 -F -m 0 -L epub_archive "$DISK_IMG"
fi

if ! mountpoint -q /app/.epub_archive; then
  echo "Montando volumen limitado a 30 GB en /app/.epub_archive..."
  mount -o loop "$DISK_IMG" /app/.epub_archive
fi

# Inicializar esquema de SQLite y colección de ChromaDB si están vacíos
/app/.venv/bin/python -c "from pathlib import Path; from epub_archive.storage import Storage; Storage(Path('/app/.epub_archive')).close()"

cd /app/web
exec "$@"
