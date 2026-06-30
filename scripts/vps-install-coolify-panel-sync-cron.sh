#!/usr/bin/env bash
# Cron: mantém status Running no painel Coolify (deploy direto sem labels sentinel).
# Uso: sudo -E bash scripts/vps-install-coolify-panel-sync-cron.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
CRON_FILE="/etc/cron.d/radarchat-coolify-panel-sync"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"

log() { echo "[coolify-panel-cron] $*"; }

[[ "${EUID}" -eq 0 ]] || { log "Execute com sudo"; exit 1; }

cat >"$CRON_FILE" <<EOF
# RadarChat — sync status painel + manter sentinel parado (deploy direto)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
* * * * * root COOLIFY_SERVICE_UUID=${COOLIFY_SERVICE_UUID} DEPLOY_PATH=${DEPLOY_PATH} ${DEPLOY_PATH}/scripts/vps-coolify-disable-sentinel.sh >>/var/log/radarchat-coolify-sync.log 2>&1
EOF
chmod 644 "$CRON_FILE"
log "OK ${CRON_FILE} (sync a cada 1 min → /var/log/radarchat-coolify-sync.log)"
