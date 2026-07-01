#!/usr/bin/env bash
# Audita volumes Mongo na VPS: qual tem dados de clientes (organizations).
# Uso: sudo -E bash scripts/vps-mongo-audit.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/vps-mongo-volume-lib.sh
source "${SCRIPT_DIR}/vps-mongo-volume-lib.sh"

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"
DB_NAME="${MONGO_DB_NAME:-discord-whatsapp}"

log() { echo "[mongo-audit] $*" >&2; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

MONGO_PW="$(vps_mongo_load_password "${COOLIFY_SERVICE_DIR}/.env" "${DEPLOY_PATH:-/opt/radarchat}/.env")"

log "=== Auditoria Mongo (db=${DB_NAME}, uuid=${COOLIFY_SERVICE_UUID}) ==="
log "Senha Mongo: $([ -n "$MONGO_PW" ] && echo configurada || echo AUSENTE)"

cur_vol="$(vps_mongo_current_volume "${COOLIFY_SERVICE_UUID}-mongodb-1")"
log "Volume ativo Coolify: ${cur_vol:-?}"

IFS='|' read -r best_vol best_count <<< "$(vps_mongo_pick_richest_volume "$MONGO_PW" "$DB_NAME")"

log "---"
log "Melhor volume: ${best_vol:-nenhum} (${best_count} organizations)"
log "Volume Coolify: ${cur_vol:-?}"

if [[ -n "$cur_vol" && "$cur_vol" == "$best_vol" && "$best_count" -ge 0 ]]; then
  log "OK: Coolify já usa o volume com mais clientes."
elif [[ -n "$best_vol" && "$best_count" -gt 0 ]]; then
  log "AÇÃO: remontar Coolify Mongo → ${best_vol} (${best_count} orgs)"
else
  log "AVISO: nenhum volume com organizations encontrado."
fi
