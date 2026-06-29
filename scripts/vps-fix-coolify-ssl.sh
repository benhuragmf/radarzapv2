#!/usr/bin/env bash
# Garante app em :3001 + HTTPS (app.radarchat.com.br + sslip.io legado) via Traefik Coolify.
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
TRAEFIK_EXTRA_HOSTS="${TRAEFIK_EXTRA_HOSTS:-151-247-210-180.sslip.io}"

log() { echo "[fix-ssl] $*"; }

coolify_app_running() {
  sudo docker ps --format '{{.Names}}' 2>/dev/null | grep -qE 'h143brhw|^[a-z0-9]{20,}-app-'
}

apply_traefik_routes() {
  PUBLIC_HOST="$PUBLIC_HOST" sudo -E bash scripts/vps-coolify-traefik-route-legacy.sh || true
  local extra host
  for extra in ${TRAEFIK_EXTRA_HOSTS//,/ }; do
    extra="$(echo "$extra" | xargs)"
    [[ -z "$extra" || "$extra" == "$PUBLIC_HOST" ]] && continue
    log "Rota legado: ${extra}"
    PUBLIC_HOST="$extra" sudo -E bash scripts/vps-coolify-traefik-route-legacy.sh || true
  done
}

log "=== 1) Garantir app em :3001 ==="
cd "$DEPLOY_PATH"
if coolify_app_running; then
  log "Stack Coolify detectada — aguardando :3001 (sem subir legado GHCR)"
  if ! curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
    log "Republicando stack Coolify com bind :3001 no host..."
    export COOLIFY_COMPOSE_MODE=ghcr
    export MIGRATE_LEGACY=0
    export COOLIFY_REPUBLISH_DIRECT=1
    export SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
    export PUBLIC_HOST="${PUBLIC_HOST}"
    sudo -E bash scripts/vps-configure-coolify-radarzap.sh || true
  fi
elif ! curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
  sudo -E bash -c 'source .env 2>/dev/null; export USE_SUDO_DOCKER=1; bash scripts/deploy-remote.sh "${RADARZAP_IMAGE:-ghcr.io/benhuragmf/radarzapv2:latest}"' || true
fi
for i in $(seq 1 20); do
  if curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
    log "App OK em :3001"
    break
  fi
  [[ "$i" -eq 20 ]] && { log "ERRO: app não subiu em :3001"; exit 1; }
  sleep 5
done

log "=== 2) HTTPS Traefik → :3001 (${PUBLIC_HOST}) ==="
apply_traefik_routes

log "=== 3) Atualizar Coolify env/domínio (${PUBLIC_HOST}) ==="
export COOLIFY_COMPOSE_MODE=ghcr
export MIGRATE_LEGACY=0
export PUBLIC_HOST="${PUBLIC_HOST}"
sudo -E bash scripts/vps-configure-coolify-radarzap.sh || true

log "=== 4) Verificar HTTPS ==="
for i in $(seq 1 12); do
  if curl -sf -o /dev/null --max-time 12 "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null; then
    log "OK: https://${PUBLIC_HOST}"
    exit 0
  fi
  log "tentativa $i/12..."
  sleep 10
done
log "Se ainda falhar: docker logs coolify-proxy --tail 50"
