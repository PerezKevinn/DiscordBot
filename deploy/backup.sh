#!/usr/bin/env bash
# Copia de seguridad diaria de data/ (configuraciones, pings, puntos, logos y membresías/órdenes de Premium).
# Ejecutar como el usuario "massup". Programarla con cron (crontab -e):
#   30 4 * * * bash /home/massup/massup/deploy/backup.sh >> /home/massup/backups/backup.log 2>&1
#
# Variables opcionales:
#   BACKUP_DIR        carpeta local de copias (por defecto ~/backups)
#   BACKUP_KEEP_DAYS  días que se conservan en local (por defecto 14)
#   RCLONE_REMOTE     destino fuera del VPS, p. ej. "gdrive:massup-backups" (requiere rclone configurado)
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="$BACKUP_DIR/massup-data-$STAMP.tar.gz"

[ -d "$APP_DIR/data" ] || { echo "No existe $APP_DIR/data"; exit 1; }
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# data/cache se regenera sola: no hace falta copiarla
tar -czf "$FILE" -C "$APP_DIR" --exclude='data/cache' data
chmod 600 "$FILE"
tar -tzf "$FILE" > /dev/null # comprueba que el archivo se puede leer
echo "$(date -Is) Copia creada: $FILE ($(du -h "$FILE" | cut -f1))"

# Borra las copias locales más antiguas que KEEP_DAYS
find "$BACKUP_DIR" -maxdepth 1 -name 'massup-data-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

# Copia fuera del VPS (si se configuró): sin esto, un fallo del disco se lleva también las copias
if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$FILE" "$RCLONE_REMOTE" && echo "$(date -Is) Subida a $RCLONE_REMOTE"
  rclone delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d" --include 'massup-data-*.tar.gz' || true
fi
