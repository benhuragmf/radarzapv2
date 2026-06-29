#!/usr/bin/env bash
# Diagnóstico + correção SSL Coolify (stack Exited → GHCR + redeploy).
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
PUBLIC_HOST="${PUBLIC_HOST:-151-247-210-180.sslip.io}"

log() { echo "[fix-ssl] $*"; }

log "=== Status containers (radarzap / proxy) ==="
sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep -iE 'radarzap|coolify-proxy|traefik' || true

APP_CTR="$(sudo docker ps -a --format '{{.Names}}' 2>/dev/null | grep -iE 'app.*h143|radarzap.*app|app-0' | head -1 || true)"
if [[ -n "$APP_CTR" ]]; then
  log "=== Logs ${APP_CTR} (últimas 30 linhas) ==="
  sudo docker logs "$APP_CTR" --tail 30 2>&1 || true
fi

log "=== Corrigindo compose (GHCR) + env + redeploy ==="
cd "$DEPLOY_PATH"
export COOLIFY_COMPOSE_MODE=ghcr
export MIGRATE_LEGACY=1
sudo -E bash scripts/vps-configure-coolify-radarzap.sh

log "=== Aguardando HTTPS (até ~3 min) ==="
for i in $(seq 1 12); do
  if curl -sf -o /dev/null --max-time 12 "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null; then
    log "OK: https://${PUBLIC_HOST} respondendo"
    exit 0
  fi
  log "tentativa $i/12..."
  sleep 15
done
log "Containers podem estar subindo — confira Deploy no Coolify (:8000) e logs do app"
