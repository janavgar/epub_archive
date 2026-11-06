#!/bin/sh
set -e

mkdir -p /disk /app/.epub_archive

DISK_IMG="/disk/epub_archive_30gb.img"
TARGET_GB="${EPUB_DISK_SIZE_GB:-60}"

if [ ! -f "$DISK_IMG" ]; then
  echo "Creando disco virtual sparse ext4 de ${TARGET_GB} GB en $DISK_IMG..."
  truncate -s "${TARGET_GB}G" "$DISK_IMG"
  mkfs.ext4 -F -m 0 -L epub_archive "$DISK_IMG"
else
  CURRENT_BYTES=$(stat -c %s "$DISK_IMG" 2>/dev/null || echo 0)
  TARGET_BYTES=$((TARGET_GB * 1024 * 1024 * 1024))
  if [ "$CURRENT_BYTES" -lt "$TARGET_BYTES" ]; then
    echo "Ampliando disco virtual sparse a ${TARGET_GB} GB..."
    truncate -s "${TARGET_GB}G" "$DISK_IMG"
  fi
fi

if ! mountpoint -q /app/.epub_archive; then
  echo "Montando volumen en /app/.epub_archive..."
  mount -o loop "$DISK_IMG" /app/.epub_archive
  LOOP_DEV=$(df --output=source /app/.epub_archive | tail -n 1)
  if [ -n "$LOOP_DEV" ]; then
    losetup -c "$LOOP_DEV" 2>/dev/null || true
    resize2fs "$LOOP_DEV" 2>/dev/null || true
  fi
fi

# Inicializar esquema de SQLite y colección de ChromaDB si están vacíos
/app/.venv/bin/python -c "from pathlib import Path; from epub_archive.storage import Storage; Storage(Path('/app/.epub_archive')).close()"

cd /app/web
exec "$@"
