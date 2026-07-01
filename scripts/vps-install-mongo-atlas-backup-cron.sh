#!/usr/bin/env bash
# Cron: backup Mongo com retenção (hora/dia/3d/semana) + Atlas opcional.
# Requer scripts em ${DEPLOY_PATH}; MONGODB_BACKUP_URL opcional para Atlas.
# Uso: sudo -E bash scripts/vps-install-mongo-atlas-backup-cron.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
CRON_FILE="/etc/cron.d/radarchat-mongo-backup"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"

log() { echo "[mongo-backup-cron] $*"; }

if [[ "${EUID}" -ne 0 ]]; then
  log "Execute com sudo"
  exit 1
fi

mkdir -p /var/backups/radarchat/mongo/{hourly,daily,every-3d,weekly}
touch /var/log/radarchat-mongo-backup.log
chmod 640 /var/log/radarchat-mongo-backup.log

rm -f /etc/cron.d/radarchat-mongo-atlas-backup 2>/dev/null || true

cat >"$CRON_FILE" <<EOF
# Radar Chat — backup Mongo local (retenção) + Atlas espelho
# hora: 3 | dia: 3 | cada 3 dias: 3 | semanal: 3
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 * * * * root DEPLOY_PATH=${DEPLOY_PATH} COOLIFY_SERVICE_UUID=${COOLIFY_SERVICE_UUID} ${DEPLOY_PATH}/scripts/vps-mongo-backup-retention.sh >>/var/log/radarchat-mongo-backup.log 2>&1
EOF

chmod 644 "$CRON_FILE"
log "OK ${CRON_FILE} (a cada hora → /var/log/radarchat-mongo-backup.log)"
log "Arquivos: /var/backups/radarchat/mongo/{hourly,daily,every-3d,weekly}"
