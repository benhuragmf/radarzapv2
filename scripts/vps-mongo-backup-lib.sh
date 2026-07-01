#!/usr/bin/env bash
# Funções compartilhadas — backup Mongo local (Coolify) + Atlas opcional.

vps_mongo_backup_read_env() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r"'"'"
}

vps_mongo_backup_load_config() {
  local coolify_env="/data/coolify/services/${COOLIFY_SERVICE_UUID}/.env"
  MONGO_PW="$(vps_mongo_backup_read_env "$coolify_env" SERVICE_PASSWORD_MONGODB)"
  [[ -z "$MONGO_PW" ]] && MONGO_PW="$(vps_mongo_backup_read_env "$coolify_env" MONGO_PASSWORD)"
  [[ -z "$MONGO_PW" ]] && MONGO_PW="$(vps_mongo_backup_read_env "${DEPLOY_PATH}/.env" MONGO_PASSWORD)"
  if [[ -z "${MONGODB_BACKUP_URL:-}" ]]; then
    MONGODB_BACKUP_URL="$(vps_mongo_backup_read_env "${DEPLOY_PATH}/.env" MONGODB_BACKUP_URL)"
  fi
}

vps_mongo_backup_prune_dir() {
  local dir="$1" keep="$2"
  [[ -d "$dir" ]] || return 0
  local count=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    count=$((count + 1))
    if (( count > keep )); then
      rm -f "$f"
    fi
  done < <(find "$dir" -maxdepth 1 -type f -name '*.archive.gz' -printf '%T@ %p\n' 2>/dev/null | sort -rn | cut -d' ' -f2-)
}

vps_mongo_backup_dump_local() {
  local archive="$1"
  local mongo_cname="${COOLIFY_SERVICE_UUID}-mongodb-1"
  local local_uri="mongodb://admin:${MONGO_PW}@127.0.0.1:27017/${DB_NAME}?authSource=admin"

  if ! docker_cmd ps --format '{{.Names}}' | grep -qF "$mongo_cname"; then
    echo "ERRO: container ${mongo_cname} não está Up" >&2
    return 1
  fi

  docker_cmd exec "$mongo_cname" mongodump \
    --uri="$local_uri" \
    --archive="/tmp/radarchat-backup.archive.gz" \
    --gzip

  docker_cmd cp "${mongo_cname}:/tmp/radarchat-backup.archive.gz" "$archive"
  docker_cmd exec "$mongo_cname" rm -f /tmp/radarchat-backup.archive.gz

  [[ -s "$archive" ]]
}

vps_mongo_backup_sync_atlas() {
  local archive="$1"
  [[ -n "${MONGODB_BACKUP_URL:-}" ]] || return 0
  docker_cmd run --rm \
    -v "${archive}:/backup.archive.gz:ro" \
    mongo:7 \
    mongorestore \
    --uri="${MONGODB_BACKUP_URL}" \
    --archive=/backup.archive.gz \
    --gzip \
    --drop \
    --nsInclude="${DB_NAME}.*"
}

vps_mongo_backup_org_count() {
  local mongo_cname="${COOLIFY_SERVICE_UUID}-mongodb-1"
  local local_uri="mongodb://admin:${MONGO_PW}@127.0.0.1:27017/${DB_NAME}?authSource=admin"
  docker_cmd exec "$mongo_cname" mongosh "$local_uri" --quiet \
    --eval 'db.organizations.countDocuments()' 2>/dev/null || echo 0
}

vps_mongo_backup_mongosh_json() {
  local js="$1"
  local mongo_cname="${COOLIFY_SERVICE_UUID}-mongodb-1"
  local local_uri="mongodb://admin:${MONGO_PW}@127.0.0.1:27017/${DB_NAME}?authSource=admin"
  docker_cmd exec "$mongo_cname" mongosh "$local_uri" --quiet --eval "$js" 2>/dev/null || echo '{}'
}

vps_mongo_backup_load_panel_settings() {
  BACKUP_ENABLED=1
  BACKUP_TZ="${MONGO_BACKUP_TZ:-America/Sao_Paulo}"
  MIN_ORGS="${MONGO_BACKUP_MIN_ORGS:-1}"
  HOURLY_ENABLED=1
  HOURLY_KEEP="${MONGO_BACKUP_HOURLY_KEEP:-3}"
  HOURLY_INTERVAL="${MONGO_BACKUP_HOURLY_INTERVAL:-1}"
  DAILY_ENABLED=1
  DAILY_KEEP="${MONGO_BACKUP_DAILY_KEEP:-3}"
  DAILY_HOUR=0
  TRIDAILY_ENABLED=1
  TRIDAILY_KEEP="${MONGO_BACKUP_TRIDAILY_KEEP:-3}"
  TRIDAILY_INTERVAL=3
  WEEKLY_ENABLED=1
  WEEKLY_KEEP="${MONGO_BACKUP_WEEKLY_KEEP:-3}"
  WEEKLY_DOW=7
  ATLAS_ENABLED=1

  local json
  json="$(vps_mongo_backup_mongosh_json '
    const d = db.systemBackupSettings.findOne({ key: "mongo" });
    if (!d) { print("{}"); } else {
      print(JSON.stringify({
        enabled: d.enabled !== false,
        timezone: d.timezone || "America/Sao_Paulo",
        hourly: d.hourly || {},
        daily: d.daily || {},
        every3d: d.every3d || {},
        weekly: d.weekly || {},
        atlas: d.atlas || {},
        minOrganizations: typeof d.minOrganizations === "number" ? d.minOrganizations : 1
      }));
    }
  ')"

  if command -v jq >/dev/null 2>&1 && [[ -n "$json" && "$json" != "{}" ]]; then
    BACKUP_ENABLED="$(jq -r '.enabled // true' <<<"$json")"
    BACKUP_TZ="$(jq -r '.timezone // "America/Sao_Paulo"' <<<"$json")"
    MIN_ORGS="$(jq -r '.minOrganizations // 1' <<<"$json")"
    HOURLY_ENABLED="$(jq -r '.hourly.enabled // true' <<<"$json")"
    HOURLY_KEEP="$(jq -r '.hourly.keep // 3' <<<"$json")"
    HOURLY_INTERVAL="$(jq -r '.hourly.intervalHours // 1' <<<"$json")"
    DAILY_ENABLED="$(jq -r '.daily.enabled // true' <<<"$json")"
    DAILY_KEEP="$(jq -r '.daily.keep // 3' <<<"$json")"
    DAILY_HOUR="$(jq -r '.daily.hour // 0' <<<"$json")"
    TRIDAILY_ENABLED="$(jq -r '.every3d.enabled // true' <<<"$json")"
    TRIDAILY_KEEP="$(jq -r '.every3d.keep // 3' <<<"$json")"
    TRIDAILY_INTERVAL="$(jq -r '.every3d.intervalDays // 3' <<<"$json")"
    WEEKLY_ENABLED="$(jq -r '.weekly.enabled // true' <<<"$json")"
    WEEKLY_KEEP="$(jq -r '.weekly.keep // 3' <<<"$json")"
    WEEKLY_DOW="$(jq -r '.weekly.dayOfWeek // 7' <<<"$json")"
    ATLAS_ENABLED="$(jq -r '.atlas.enabled // true' <<<"$json")"
  fi
}

vps_mongo_backup_record_run() {
  local status="$1"
  local started_iso="$2"
  local finished_iso="$3"
  local org_count="$4"
  local tier_hourly="$5"
  local tier_daily="$6"
  local tier_tri="$7"
  local tier_weekly="$8"
  local tier_atlas="$9"
  local h_count="${10}"
  local d_count="${11}"
  local t_count="${12}"
  local w_count="${13}"
  local message="${14:-}"
  local error="${15:-}"

  local started_ms finished_ms duration_ms
  started_ms="$(date -d "$started_iso" +%s%3N 2>/dev/null || echo 0)"
  finished_ms="$(date -d "$finished_iso" +%s%3N 2>/dev/null || echo 0)"
  duration_ms=$(( finished_ms - started_ms ))
  (( duration_ms < 0 )) && duration_ms=0

  local msg_esc err_esc
  msg_esc="${message//\"/\\\"}"
  err_esc="${error//\"/\\\"}"

  vps_mongo_backup_mongosh_json "
    db.systemBackupRuns.insertOne({
      status: '${status}',
      startedAt: new Date('${started_iso}'),
      finishedAt: new Date('${finished_iso}'),
      durationMs: ${duration_ms},
      organizations: ${org_count:-0},
      tiers: {
        hourly: ${tier_hourly},
        daily: ${tier_daily},
        every3d: ${tier_tri},
        weekly: ${tier_weekly},
        atlas: ${tier_atlas}
      },
      retentionCounts: {
        hourly: ${h_count:-0},
        daily: ${d_count:-0},
        every3d: ${t_count:-0},
        weekly: ${w_count:-0}
      },
      message: '${msg_esc}',
      error: '${err_esc}',
      createdAt: new Date()
    });
    print('ok');
  " >/dev/null || true
}
