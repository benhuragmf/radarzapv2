#!/usr/bin/env bash
# Corrige sentinel Coolify (docker.sock) + sincroniza painel — status "Exited" com containers Up.
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

log "=== 1) Docker socket (Coolify lê status dos containers) ==="
if docker_cmd ps --format '{{.Names}}' | grep -q '^coolify$'; then
  docker_cmd exec -u root coolify chmod 666 /var/run/docker.sock 2>/dev/null || true
  log "OK docker.sock legível pelo container coolify"
else
  log "AVISO: container coolify ausente"
fi

log "=== 2) Reiniciar sentinel / realtime ==="
for c in coolify-sentinel coolify-realtime; do
  if docker_cmd ps -a --format '{{.Names}}' | grep -qx "$c"; then
    docker_cmd restart "$c" >/dev/null 2>&1 || true
    log "restarted ${c}"
  fi
done

if docker_cmd ps --format '{{.Names}}' | grep -q '^coolify$'; then
  docker_cmd exec coolify php artisan tinker --execute="
try {
  \$server = \\App\\Models\\Server::first();
  if (\$server && class_exists('\\App\\Actions\\Server\\StartSentinel')) {
    \\App\\Actions\\Server\\StartSentinel::run(server: \$server, restart: true, latestVersion: 'latest');
    echo 'SENTINEL_OK';
  } else { echo 'SENTINEL_SKIP'; }
} catch (\\Throwable \$e) { echo 'SENTINEL_ERR'; }
" 2>/dev/null | while read -r line; do log "  tinker: $line"; done || true
fi

sleep 5

log "=== 3) Sync painel ==="
sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-sync-panel.sh"

log "=== 4) Aguardar sentinel (15s) e re-sync se necessário ==="
sleep 15
off="$(panel_off_count)"
if [[ "${off:-0}" -gt 0 ]]; then
  log "Status revertido (off=${off}) — parando coolify-sentinel e re-sync"
  docker_cmd stop coolify-sentinel 2>/dev/null || true
  sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-sync-panel.sh"
  off="$(panel_off_count)"
fi

log "=== 5) Cron sync painel (a cada 2 min) ==="
if [[ -f "${DEPLOY_PATH}/scripts/vps-install-coolify-panel-sync-cron.sh" ]]; then
  sudo -E bash "${DEPLOY_PATH}/scripts/vps-install-coolify-panel-sync-cron.sh" || true
fi

off="$(panel_off_count)"
if [[ "${off:-0}" -eq 0 ]]; then
  log "OK painel sincronizado (apps+dbs running:*)"
else
  log "AVISO: painel ainda off=${off} — app em produção pode estar OK (docker ps)"
  exit 1
fi
