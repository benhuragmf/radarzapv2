#!/usr/bin/env bash
# Audita volumes Mongo na VPS: qual tem dados de clientes (organizations).
# Uso: sudo -E bash scripts/vps-mongo-audit.sh
set -euo pipefail

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"
DB_NAME="${MONGO_DB_NAME:-discord-whatsapp}"

log() { echo "[mongo-audit] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

read_env_var() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r"'"'"
}

MONGO_PW="$(read_env_var "${COOLIFY_SERVICE_DIR}/.env" SERVICE_PASSWORD_MONGODB)"
[[ -z "$MONGO_PW" ]] && MONGO_PW="$(read_env_var "${COOLIFY_SERVICE_DIR}/.env" MONGO_PASSWORD)"
[[ -z "$MONGO_PW" ]] && MONGO_PW="$(read_env_var "${DEPLOY_PATH:-/opt/radarchat}/.env" MONGO_PASSWORD)"

current_mongo_volume() {
  local cname="${COOLIFY_SERVICE_UUID}-mongodb-1"
  docker_cmd inspect "$cname" --format '{{range .Mounts}}{{if eq .Destination "/data/db"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true
}

count_orgs_in_volume() {
  local vol="$1" pw="${2:-}"
  local tmp="mongo-audit-$$-${RANDOM}"
  local uri count=0

  if ! docker_cmd run -d --name "$tmp" -v "${vol}:/data/db" mongo:7 mongod --bind_ip_all >/dev/null 2>&1; then
    echo "-1"
    return
  fi

  for _ in $(seq 1 20); do
    if docker_cmd exec "$tmp" mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1; then
      break
    fi
    sleep 1
  done

  if [[ -n "$pw" ]]; then
    uri="mongodb://admin:${pw}@127.0.0.1:27017/${DB_NAME}?authSource=admin"
    count="$(docker_cmd exec "$tmp" mongosh "$uri" --quiet --eval \
      'try { db.organizations.countDocuments() } catch(e) { -2 }' 2>/dev/null || echo -2)"
    if [[ "$count" == "-2" || "$count" == "" ]]; then
      count="$(docker_cmd exec "$tmp" mongosh "$uri" --quiet --eval \
        'try { db.getSiblingDB("radarchat").organizations.countDocuments() } catch(e) { -2 }' 2>/dev/null || echo -2)"
    fi
  else
    count="$(docker_cmd exec "$tmp" mongosh --quiet --eval \
      "try { db.getSiblingDB('${DB_NAME}').organizations.countDocuments() } catch(e) { -2 }" 2>/dev/null || echo -2)"
  fi

  docker_cmd rm -f "$tmp" >/dev/null 2>&1 || true
  echo "${count:--2}"
}

log "=== Auditoria Mongo (db=${DB_NAME}, uuid=${COOLIFY_SERVICE_UUID}) ==="
log "Senha Mongo: ${MONGO_PW:+configurada}${MONGO_PW:-AUSENTE}"

cur_vol="$(current_mongo_volume)"
log "Volume ativo Coolify: ${cur_vol:-?}"

best_vol="" best_count=-1
while read -r vol; do
  [[ -z "$vol" ]] && continue
  c="$(count_orgs_in_volume "$vol" "$MONGO_PW")"
  log "  volume=${vol} organizations=${c}"
  if [[ "$c" =~ ^[0-9]+$ ]] && (( c > best_count )); then
    best_count="$c"
    best_vol="$vol"
  fi
done < <(docker_cmd volume ls --format '{{.Name}}' | grep -E 'mongodb-data|mongo-data' | sort -u || true)

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
