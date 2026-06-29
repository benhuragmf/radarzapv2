#!/usr/bin/env bash
# Restaura app legado em :3001 + HTTPS sslip.io (Caddy) quando Coolify ainda não roteia o domínio.
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
PUBLIC_HOST="${PUBLIC_HOST:-151-247-210-180.sslip.io}"

log() { echo "[restore-https] $*"; }

cd "$DEPLOY_PATH"
export USE_SUDO_DOCKER=1
export ENV_FILE=.env

log "Subindo stack legado (se imagem GHCR configurada)..."
if [[ -f .env ]] && sudo docker compose -f docker-compose.deploy.yml ps -q app 2>/dev/null | grep -q .; then
  sudo docker compose -f docker-compose.deploy.yml up -d --remove-orphans || true
elif [[ -f .env ]]; then
  # pull latest via deploy script if RADARZAP_IMAGE in env
  set -a; source .env 2>/dev/null || true; set +a
  if [[ -n "${RADARZAP_IMAGE:-}" ]]; then
    bash scripts/deploy-remote.sh "$RADARZAP_IMAGE" || sudo docker compose -f docker-compose.deploy.yml up -d || true
  else
    log "AVISO: RADARZAP_IMAGE ausente — compose pode falhar"
    sudo docker compose -f docker-compose.deploy.yml up -d || true
  fi
fi

for i in $(seq 1 20); do
  if curl -sf -o /dev/null http://127.0.0.1:3001/ 2>/dev/null || curl -sf -o /dev/null http://127.0.0.1:3001/api/services/health 2>/dev/null; then
    log "App responde em :3001"
    break
  fi
  sleep 3
done

# Coolify Traefik/Caddy proxy costuma usar 80/443 — Caddy do host só se 443 estiver livre para sslip.io
if sudo ss -tlnp 2>/dev/null | grep -q ':443'; then
  log "Porta 443 em uso (provavelmente proxy Coolify). HTTPS do app virá após domínio no resource RadarZap."
  log "Painel Coolify: http://$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):8000"
  exit 0
fi

log "Reativando Caddy → https://${PUBLIC_HOST}"
sudo bash scripts/vps-setup-caddy-https.sh
log "OK: https://${PUBLIC_HOST}"
