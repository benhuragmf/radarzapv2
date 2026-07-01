#!/usr/bin/env bash
# Cron: backup Mongo local → Atlas a cada 30 min (backup ao vivo).
# Requer MONGODB_BACKUP_URL em /opt/radarchat/.env
# Uso: sudo -E bash scripts/vps-install-mongo-atlas-backup-cron.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
CRON_FILE="/etc/cron.d/radarchat-mongo-atlas-backup"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"

log() { echo "[mongo-atlas-cron] $*"; }

if [[ "${EUID}" -ne 0 ]]; then
  log "Execute com sudo"
  exit 1
fi

if ! grep -q '^MONGODB_BACKUP_URL=' "${DEPLOY_PATH}/.env" 2>/dev/null; then
  log "ERRO: MONGODB_BACKUP_URL ausente em ${DEPLOY_PATH}/.env"
  exit 1
fi

touch /var/log/radarchat-mongo-atlas-backup.log
chmod 640 /var/log/radarchat-mongo-atlas-backup.log

cat >"$CRON_FILE" <<EOF
# Radar Chat — espelho Mongo local → Atlas (backup ao vivo)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
*/30 * * * * root DEPLOY_PATH=${DEPLOY_PATH} COOLIFY_SERVICE_UUID=${COOLIFY_SERVICE_UUID} ${DEPLOY_PATH}/scripts/vps-mongo-sync-atlas-backup.sh >>/var/log/radarchat-mongo-atlas-backup.log 2>&1
EOF

chmod 644 "$CRON_FILE"
log "OK ${CRON_FILE} (sync a cada 30 min → /var/log/radarchat-mongo-atlas-backup.log)"
