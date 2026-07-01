#!/usr/bin/env bash
# Backup ao vivo: espelha Mongo local (VPS) → MongoDB Atlas (MONGODB_BACKUP_URL).
# Primário continua MONGODB_URL local; Atlas é réplica espelhada via cron.
# Uso: sudo -E bash scripts/vps-mongo-sync-atlas-backup.sh
set -euo pipefail

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
DB_NAME="${MONGO_DB_NAME:-discord-whatsapp}"
LOG_FILE="${MONGO_ATLAS_BACKUP_LOG:-/var/log/radarchat-mongo-atlas-backup.log}"
MIN_ORGS="${MONGO_ATLAS_BACKUP_MIN_ORGS:-1}"

log() { echo "[mongo-atlas-backup] $(date -Iseconds) $*" | tee -a "$LOG_FILE"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

read_env() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r"'"'"
}

load_config() {
  local coolify_env="/data/coolify/services/${COOLIFY_SERVICE_UUID}/.env"
  MONGO_PW="$(read_env "$coolify_env" SERVICE_PASSWORD_MONGODB)"
  [[ -z "$MONGO_PW" ]] && MONGO_PW="$(read_env "$coolify_env" MONGO_PASSWORD)"
  [[ -z "$MONGO_PW" ]] && MONGO_PW="$(read_env "${DEPLOY_PATH}/.env" MONGO_PASSWORD)"
  MONGODB_BACKUP_URL="$(read_env "${DEPLOY_PATH}/.env" MONGODB_BACKUP_URL)"
  [[ -z "$MONGODB_BACKUP_URL" ]] && MONGODB_BACKUP_URL="${MONGODB_BACKUP_URL:-}"
}

mongo_cname="${COOLIFY_SERVICE_UUID}-mongodb-1"
archive="/tmp/radarchat-mongo-atlas-backup-$$.archive.gz"

cleanup() { rm -f "$archive" 2>/dev/null || true; }
trap cleanup EXIT

load_config

if [[ -z "${MONGODB_BACKUP_URL:-}" ]]; then
  log "ERRO: MONGODB_BACKUP_URL ausente em ${DEPLOY_PATH}/.env"
  exit 1
fi

if [[ -z "${MONGO_PW:-}" ]]; then
  log "ERRO: senha Mongo local ausente"
  exit 1
fi

if ! docker_cmd ps --format '{{.Names}}' | grep -qF "$mongo_cname"; then
  log "ERRO: container ${mongo_cname} não está Up"
  exit 1
fi

local_uri="mongodb://admin:${MONGO_PW}@127.0.0.1:27017/${DB_NAME}?authSource=admin"
org_count="$(docker_cmd exec "$mongo_cname" mongosh "$local_uri" --quiet \
  --eval 'db.organizations.countDocuments()' 2>/dev/null || echo 0)"

log "Local organizations=${org_count}"

if [[ ! "$org_count" =~ ^[0-9]+$ ]] || (( org_count < MIN_ORGS )); then
  log "AVISO: banco local com poucos dados (${org_count}) — sync Atlas abortado (proteção)"
  exit 0
fi

log "mongodump local → archive..."
docker_cmd exec "$mongo_cname" mongodump \
  --uri="$local_uri" \
  --archive="/tmp/radarchat-atlas.archive.gz" \
  --gzip

docker_cmd cp "${mongo_cname}:/tmp/radarchat-atlas.archive.gz" "$archive"
docker_cmd exec "$mongo_cname" rm -f /tmp/radarchat-atlas.archive.gz

if [[ ! -s "$archive" ]]; then
  log "ERRO: dump vazio"
  exit 1
fi

log "mongorestore → Atlas (${DB_NAME})..."
docker_cmd run --rm \
  -v "${archive}:/backup.archive.gz:ro" \
  mongo:7 \
  mongorestore \
  --uri="${MONGODB_BACKUP_URL}" \
  --archive=/backup.archive.gz \
  --gzip \
  --drop \
  --nsInclude="${DB_NAME}.*"

log "OK — backup Atlas sincronizado (${org_count} organizations espelhadas)"
