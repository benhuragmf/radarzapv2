#!/usr/bin/env bash
# Caddy reverse proxy HTTPS → app :3001 (sslip.io ou domínio custom).
set -euo pipefail
PUBLIC_HOST="${PUBLIC_HOST:-151-247-210-180.sslip.io}"
if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy
fi
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
${PUBLIC_HOST} {
  reverse_proxy 127.0.0.1:3001
}
EOF
sudo systemctl enable caddy
sudo systemctl reload caddy || sudo systemctl restart caddy
echo "[caddy] HTTPS ativo: https://${PUBLIC_HOST}"
