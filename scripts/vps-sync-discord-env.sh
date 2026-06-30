#!/usr/bin/env bash
# Sincroniza DISCORD_* para /opt/radarchat/.env e stack Coolify (variáveis já exportadas no shell).
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"

log() { echo "[sync-discord-env] $*"; }

patch_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local key val
  for key in DISCORD_TOKEN DISCORD_CLIENT_ID DISCORD_CLIENT_SECRET DISCORD_GUILD_ID; do
    val="${!key:-}"
    if [[ -n "$val" ]]; then
      sudo bash "${DEPLOY_PATH}/scripts/vps-patch-env-key.sh" "$file" "$key" "$val"
    fi
  done
}

log "Patch Discord env em ${DEPLOY_PATH}/.env"
patch_file "${DEPLOY_PATH}/.env"
if [[ -f "${COOLIFY_SERVICE_DIR}/.env" ]]; then
  log "Patch Discord env em ${COOLIFY_SERVICE_DIR}/.env"
  patch_file "${COOLIFY_SERVICE_DIR}/.env"
fi
log "OK"
