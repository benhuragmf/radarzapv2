#!/usr/bin/env bash
# Corrige sentinel Coolify (docker.sock) + sincroniza painel — status "Exited" com containers Up.
# Deploy direto: sentinel é DESLIGADO (não reiniciado) — ver vps-coolify-disable-sentinel.sh
# Uso: sudo -E bash scripts/vps-coolify-fix-sentinel.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
CANONICAL_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"

log() { echo "[coolify-sentinel] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

psql_coolify() {
  docker_cmd exec coolify-db psql -U coolify -d coolify -t -A -c "$1" 2>/dev/null | tr -d '\r'
}

panel_off_count() {
  local apps dbs
  apps="$(psql_coolify "SELECT count(*) FROM service_applications sa JOIN services s ON s.id = sa.service_id WHERE s.uuid = '${CANONICAL_UUID}' AND sa.status NOT LIKE 'running:%';" || echo 99)"
  dbs="$(psql_coolify "SELECT count(*) FROM service_databases sd JOIN services s ON s.id = sd.service_id WHERE s.uuid = '${CANONICAL_UUID}' AND sd.status NOT LIKE 'running:%';" || echo 99)"
  echo "$(( ${apps:-99} + ${dbs:-99} ))"
}

log "=== 1) Docker socket ==="
if docker_cmd ps --format '{{.Names}}' | grep -q '^coolify$'; then
  docker_cmd exec -u root coolify chmod 666 /var/run/docker.sock 2>/dev/null || true
  log "OK docker.sock"
fi

log "=== 2) Desativar sentinel (deploy direto RadarChat) ==="
exec sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-disable-sentinel.sh"
