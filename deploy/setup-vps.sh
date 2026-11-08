#!/usr/bin/env bash
# Instalación inicial de MassUp en un VPS nuevo con Ubuntu 24.04. Ejecutar como root.
# Se puede repetir sin problema: lo ya hecho se salta.
#   bash setup-vps.sh <url-ssh-del-repo>
# Ej.: bash setup-vps.sh git@github.com:tu-usuario/massup.git
set -euo pipefail

REPO="${1:?Uso: bash setup-vps.sh <url-ssh-del-repo>}"
APP_USER=massup
APP_DIR=/home/$APP_USER/massup

echo "==> Actualizando el sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y git curl ufw fail2ban unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https \
  fonts-dejavu-core fonts-noto-core

echo "==> Actualizaciones de seguridad automáticas"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> SSH: solo con clave, sin contraseña"
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd

echo "==> Cortafuegos: solo SSH, HTTP y HTTPS"
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

echo "==> Memoria de intercambio (ayuda a compilar en VPS pequeños)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Node.js 22 LTS y pm2"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "==> Caddy (HTTPS automático)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "==> Usuario sin privilegios para el bot"
id -u $APP_USER >/dev/null 2>&1 || adduser --disabled-password --gecos "" $APP_USER
sudo -u $APP_USER mkdir -p /home/$APP_USER/.ssh
sudo -u $APP_USER chmod 700 /home/$APP_USER/.ssh

echo "==> Clave de solo lectura para descargar el repositorio privado"
if [ ! -f /home/$APP_USER/.ssh/id_ed25519 ]; then
  sudo -u $APP_USER ssh-keygen -t ed25519 -N "" -C "massup-vps-deploy" -f /home/$APP_USER/.ssh/id_ed25519 >/dev/null
fi
sudo -u $APP_USER bash -c 'ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null'
echo
echo "----------------------------------------------------------------"
echo "Añade esta clave en GitHub -> tu repo -> Settings -> Deploy keys"
echo "(Add deploy key, SIN marcar 'Allow write access'):"
echo
cat /home/$APP_USER/.ssh/id_ed25519.pub
echo "----------------------------------------------------------------"
if ! sudo -u $APP_USER git ls-remote "$REPO" >/dev/null 2>&1; then
  echo
  echo "GitHub todavía no acepta esta clave. Añádela y vuelve a ejecutar este mismo script:"
  echo "  bash setup-vps.sh $REPO"
  exit 2
fi
echo "GitHub acepta la clave."

echo "==> Descargando el código"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u $APP_USER git clone "$REPO" "$APP_DIR"
fi

echo "==> Registros: máximo 14 días (lo promete la política de privacidad)"
sudo -u $APP_USER pm2 install pm2-logrotate >/dev/null
sudo -u $APP_USER pm2 set pm2-logrotate:retain 14 >/dev/null

echo "==> Caddy para panel.massup.shop"
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy

echo "==> Arranque automático de pm2 al reiniciar el VPS"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u $APP_USER --hp /home/$APP_USER >/dev/null

echo
echo "Listo. Ahora:"
echo "  1) Copia tu .env a $APP_DIR/.env (con DEV_MODE=false y PANEL_URL=https://panel.massup.shop)"
echo "  2) Copia tu carpeta data/ a $APP_DIR/data/"
echo "  3) Como $APP_USER: cd $APP_DIR && bash deploy/deploy.sh"
