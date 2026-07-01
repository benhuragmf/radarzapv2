#!/usr/bin/env bash
# Backup Mongo local (Coolify) com retenção em camadas + espelho Atlas opcional.
# Lê política em systemBackupSettings (painel /admin/backup) quando disponível.
#
# Uso: sudo -E bash scripts/vps-mongo-backup-retention.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/vps-mongo-backup-lib.sh
source "${SCRIPT_DIR}/vps-mongo-backup-lib.sh"

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
DB_NAME="${MONGO_DB_NAME:-discord-whatsapp}"
BACKUP_ROOT="${MONGO_BACKUP_ROOT:-/var/backups/radarchat/mongo}"
LOG_FILE="${MONGO_BACKUP_LOG:-/var/log/radarchat-mongo-backup.log}"

RUN_STARTED="$(date -Iseconds)"
TIER_HOURLY=0
TIER_DAILY=0
TIER_TRI=0
TIER_WEEKLY=0
TIER_ATLAS=0
RUN_STATUS="success"
RUN_MESSAGE=""
RUN_ERROR=""
H_COUNT=0
D_COUNT=0
T_COUNT=0
W_COUNT=0
ORG_COUNT=0

log() { echo "[mongo-backup] $(date -Iseconds) $*" | tee -a "$LOG_FILE" 2>/dev/null || echo "[mongo-backup] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/radarchat-mongo-backup.log"

finish_run() {
  local finished
  finished="$(date -Iseconds)"
  vps_mongo_backup_record_run \
    "$RUN_STATUS" "$RUN_STARTED" "$finished" "$ORG_COUNT" \
    "$TIER_HOURLY" "$TIER_DAILY" "$TIER_TRI" "$TIER_WEEKLY" "$TIER_ATLAS" \
    "$H_COUNT" "$D_COUNT" "$T_COUNT" "$W_COUNT" \
    "$RUN_MESSAGE" "$RUN_ERROR"
}

archive="/tmp/radarchat-mongo-retention-$$.archive.gz"
cleanup() { rm -f "$archive" 2>/dev/null || true; }
on_exit() { cleanup; finish_run; }
trap on_exit EXIT

vps_mongo_backup_load_config
vps_mongo_backup_load_panel_settings

mkdir -p "${BACKUP_ROOT}/hourly" "${BACKUP_ROOT}/daily" "${BACKUP_ROOT}/every-3d" "${BACKUP_ROOT}/weekly"

if [[ -z "${MONGO_PW:-}" ]]; then
  RUN_STATUS="failed"
  RUN_ERROR="senha Mongo local ausente"
  log "ERRO: ${RUN_ERROR}"
  exit 1
fi

if [[ "$BACKUP_ENABLED" == "false" ]]; then
  RUN_STATUS="skipped"
  RUN_MESSAGE="backup desabilitado no painel admin"
  log "${RUN_MESSAGE}"
  exit 0
fi

now_hour="$(TZ="${BACKUP_TZ}" date +%H | sed 's/^0*//')"
[[ -z "$now_hour" ]] && now_hour=0
now_date="$(TZ="${BACKUP_TZ}" date +%Y-%m-%d)"
now_dow="$(TZ="${BACKUP_TZ}" date +%u)"
epoch_day="$(( $(TZ="${BACKUP_TZ}" date +%s) / 86400 ))"

ORG_COUNT="$(vps_mongo_backup_org_count)"
log "organizations=${ORG_COUNT} tz=${BACKUP_TZ}"

if [[ ! "$ORG_COUNT" =~ ^[0-9]+$ ]] || (( ORG_COUNT < MIN_ORGS )); then
  RUN_STATUS="skipped"
  RUN_MESSAGE="banco com poucos dados (${ORG_COUNT} orgs, mínimo ${MIN_ORGS})"
  log "AVISO: ${RUN_MESSAGE}"
  exit 0
fi

should_hourly=1
if [[ "$HOURLY_ENABLED" != "true" && "$HOURLY_ENABLED" != "1" ]]; then
  should_hourly=0
elif (( HOURLY_INTERVAL > 1 )); then
  latest_hourly="$(find "${BACKUP_ROOT}/hourly" -maxdepth 1 -type f -name '*.archive.gz' -printf '%T@\n' 2>/dev/null | sort -rn | head -1 || true)"
  if [[ -n "$latest_hourly" ]]; then
    now_epoch="$(date +%s)"
    latest_epoch="${latest_hourly%%.*}"
    age_hours=$(( (now_epoch - latest_epoch) / 3600 ))
    if (( age_hours < HOURLY_INTERVAL )); then
      should_hourly=0
      log "hourly: aguardando intervalo (${age_hours}h < ${HOURLY_INTERVAL}h)"
    fi
  fi
fi

if (( should_hourly == 0 )) && [[ "$now_hour" != "$DAILY_HOUR" ]]; then
  RUN_STATUS="skipped"
  RUN_MESSAGE="fora da janela horária/diária configurada"
  log "${RUN_MESSAGE}"
  exit 0
fi

log "mongodump → ${archive}"
if ! vps_mongo_backup_dump_local "$archive"; then
  RUN_STATUS="failed"
  RUN_ERROR="mongodump falhou"
  log "ERRO: ${RUN_ERROR}"
  exit 1
fi

if (( should_hourly == 1 )) && [[ "$HOURLY_ENABLED" == "true" || "$HOURLY_ENABLED" == "1" ]]; then
  hourly_name="$(TZ="${BACKUP_TZ}" date +%Y%m%dT%H).archive.gz"
  cp "$archive" "${BACKUP_ROOT}/hourly/${hourly_name}"
  vps_mongo_backup_prune_dir "${BACKUP_ROOT}/hourly" "$HOURLY_KEEP"
  TIER_HOURLY=1
  log "hourly: ${hourly_name} (mantém ${HOURLY_KEEP})"
fi

if [[ "$now_hour" == "$DAILY_HOUR" ]] && [[ "$DAILY_ENABLED" == "true" || "$DAILY_ENABLED" == "1" ]]; then
  daily_name="${now_date}.archive.gz"
  cp "$archive" "${BACKUP_ROOT}/daily/${daily_name}"
  vps_mongo_backup_prune_dir "${BACKUP_ROOT}/daily" "$DAILY_KEEP"
  TIER_DAILY=1
  log "daily: ${daily_name} (mantém ${DAILY_KEEP})"

  if [[ "$TRIDAILY_ENABLED" == "true" || "$TRIDAILY_ENABLED" == "1" ]] && (( epoch_day % TRIDAILY_INTERVAL == 0 )); then
    tri_name="${now_date}.archive.gz"
    cp "$archive" "${BACKUP_ROOT}/every-3d/${tri_name}"
    vps_mongo_backup_prune_dir "${BACKUP_ROOT}/every-3d" "$TRIDAILY_KEEP"
    TIER_TRI=1
    log "every-3d: ${tri_name} (mantém ${TRIDAILY_KEEP}, intervalo ${TRIDAILY_INTERVAL}d)"
  fi

  if [[ "$WEEKLY_ENABLED" == "true" || "$WEEKLY_ENABLED" == "1" ]] && [[ "$now_dow" == "$WEEKLY_DOW" ]]; then
    week_name="$(TZ="${BACKUP_TZ}" date +%Y-W%V).archive.gz"
    cp "$archive" "${BACKUP_ROOT}/weekly/${week_name}"
    vps_mongo_backup_prune_dir "${BACKUP_ROOT}/weekly" "$WEEKLY_KEEP"
    TIER_WEEKLY=1
    log "weekly: ${week_name} (mantém ${WEEKLY_KEEP}, dow=${WEEKLY_DOW})"
  fi
fi

if [[ -n "${MONGODB_BACKUP_URL:-}" ]] && [[ "$ATLAS_ENABLED" == "true" || "$ATLAS_ENABLED" == "1" ]] && (( TIER_HOURLY == 1 )); then
  log "mongorestore → Atlas..."
  if vps_mongo_backup_sync_atlas "$archive" 2>&1 | tee -a "$LOG_FILE"; then
    TIER_ATLAS=1
    log "Atlas OK (espelho atualizado)"
  else
    RUN_MESSAGE="Atlas falhou — backups locais salvos"
    log "AVISO: ${RUN_MESSAGE}"
  fi
elif [[ -z "${MONGODB_BACKUP_URL:-}" ]]; then
  log "Atlas: MONGODB_BACKUP_URL ausente — só backup local"
else
  log "Atlas: desabilitado no painel ou sem backup horário nesta execução"
fi

H_COUNT="$(find "${BACKUP_ROOT}/hourly" -maxdepth 1 -name '*.archive.gz' 2>/dev/null | wc -l | tr -d ' ')"
D_COUNT="$(find "${BACKUP_ROOT}/daily" -maxdepth 1 -name '*.archive.gz' 2>/dev/null | wc -l | tr -d ' ')"
T_COUNT="$(find "${BACKUP_ROOT}/every-3d" -maxdepth 1 -name '*.archive.gz' 2>/dev/null | wc -l | tr -d ' ')"
W_COUNT="$(find "${BACKUP_ROOT}/weekly" -maxdepth 1 -name '*.archive.gz' 2>/dev/null | wc -l | tr -d ' ')"
RUN_MESSAGE="retenção: hourly=${H_COUNT} daily=${D_COUNT} every-3d=${T_COUNT} weekly=${W_COUNT}"
log "OK — ${RUN_MESSAGE} root=${BACKUP_ROOT}"
