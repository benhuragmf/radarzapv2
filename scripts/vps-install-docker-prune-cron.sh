#!/usr/bin/env bash
# Cron de limpeza Docker no VPS — evita "no space left on device" no deploy.
# Uso: sudo -E DEPLOY_PATH=/opt/radarchat bash scripts/vps-install-docker-prune-cron.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
DEPLOY_PATH="${DEPLOY_PATH//$'\r'/}"
CRON_FILE="/etc/cron.d/radarchat-docker-prune"
PRUNE_SCRIPT="${DEPLOY_PATH}/scripts/vps-docker-prune-safe.sh"

log() { echo "[docker-prune-install] $*"; }

if [[ "${EUID}" -ne 0 ]]; then
  log "Execute com sudo"
  exit 1
fi

if [[ ! -f "$PRUNE_SCRIPT" ]]; then
  log "ERRO: ${PRUNE_SCRIPT} ausente — git pull em ${DEPLOY_PATH}"
  exit 1
fi

chmod +x "$PRUNE_SCRIPT"

cat >"$CRON_FILE" <<EOF
# Radar Chat — limpeza Docker (imagens/cache; volumes sessions/mongo preservados)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 */6 * * * root DEPLOY_PATH=${DEPLOY_PATH} ${PRUNE_SCRIPT} --cron >> /var/log/radarchat-docker-prune.log 2>&1
15 3 * * * root DEPLOY_PATH=${DEPLOY_PATH} ${PRUNE_SCRIPT} --cron --aggressive >> /var/log/radarchat-docker-prune.log 2>&1
EOF
chmod 644 "$CRON_FILE"
log "Cron instalado: ${CRON_FILE} (a cada 6h + diario 03:15)"

log "Executando limpeza inicial..."
DEPLOY_PATH="$DEPLOY_PATH" bash "$PRUNE_SCRIPT" --cron --aggressive || true
log "Concluido"
