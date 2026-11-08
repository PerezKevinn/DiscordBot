#!/usr/bin/env bash
# Instala/actualiza MassUp en el VPS. Ejecutar como el usuario "massup" dentro de la carpeta del bot:
#   cd ~/massup && bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Falta el archivo .env"; exit 1; }
grep -q '^DEV_MODE=false' .env || echo "⚠️  Aviso: DEV_MODE no está en false (los comandos solo se registrarán en tu servidor)."

echo "==> Descargando la última versión"
git pull --ff-only

echo "==> Dependencias y compilación del bot"
npm ci
npm run build

echo "==> Panel web"
npm run panel:install
npm run panel:build

echo "==> (Re)iniciando"
chmod 600 .env
pm2 startOrReload ecosystem.config.cjs
pm2 save
pm2 status massup
echo "Hecho. Registros en vivo: pm2 logs massup"
