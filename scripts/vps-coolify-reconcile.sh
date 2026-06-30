#!/usr/bin/env bash
# Reconcilia Coolify ↔ Docker real: sobe stack canônica, status "running" no painel, remove resource duplicado.
# Canônico: h143brhw5f8tgfj9trj0f3bd → app.radarchat.com.br
# Uso: sudo -E bash scripts/vps-coolify-reconcile.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
CANONICAL_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${CANONICAL_UUID}}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"

log() { echo "[coolify-reconcile] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

log "=== 1) Permissões Coolify ==="
sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-fix-permissions.sh"

log "=== 2) Subir stack canônica (app + mongo + redis) ==="
if [[ ! -f "${COOLIFY_DIR}/docker-compose.yaml" ]]; then
  log "ERRO: compose ausente em ${COOLIFY_DIR}"
  log "Rode uma vez: sudo -E bash ${DEPLOY_PATH}/scripts/vps-fix-coolify-ssl.sh"
  exit 1
fi

if ! (cd "$COOLIFY_DIR" && docker_cmd compose --env-file .env \
  -f docker-compose.yaml -p "${CANONICAL_UUID}" up -d --remove-orphans); then
  log "ERRO: docker compose up falhou"
  exit 1
fi

log "=== 3) Health :3001 ==="
for i in $(seq 1 24); do
  if curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
    log "OK :3001 (tentativa $i)"
    break
  fi
  [[ "$i" -eq 24 ]] && { log "ERRO: :3001 não respondeu"; exit 1; }
  sleep 5
done

log "=== 4) Sincronizar painel Coolify + remover duplicata ==="
sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-sync-panel.sh"

log "=== 5) Containers ==="
docker_cmd ps --format 'table {{.Names}}\t{{.Status}}' | grep -E "${CANONICAL_UUID}|NAMES" || true

log "=== 6) Gate de verificação ==="
sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-verify.sh"

log "=== OK ==="
log "Painel: use só RadarChat → production → resource ${CANONICAL_UUID:0:12}…"
log "App: https://${PUBLIC_HOST}"
