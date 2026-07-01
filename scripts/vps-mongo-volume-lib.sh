#!/usr/bin/env bash
# Funções compartilhadas — auditoria volumes Mongo na VPS.
# Requer: docker_cmd() e opcional COOLIFY_SERVICE_UUID no ambiente.

vps_mongo_read_env_var() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r"'"'"
}

vps_mongo_load_password() {
  local coolify_env="${1:-}" deploy_env="${2:-/opt/radarchat/.env}"
  local pw=""
  [[ -n "$coolify_env" ]] && pw="$(vps_mongo_read_env_var "$coolify_env" SERVICE_PASSWORD_MONGODB)"
  [[ -z "$pw" && -n "$coolify_env" ]] && pw="$(vps_mongo_read_env_var "$coolify_env" MONGO_PASSWORD)"
  [[ -z "$pw" ]] && pw="$(vps_mongo_read_env_var "$deploy_env" MONGO_PASSWORD)"
  printf '%s' "$pw"
}

vps_mongo_current_volume() {
  local cname="$1"
  docker_cmd inspect "$cname" --format '{{range .Mounts}}{{if eq .Destination "/data/db"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true
}

vps_mongo_count_orgs_in_volume() {
  local vol="$1" pw="$2" db="${3:-discord-whatsapp}"
  local live_c="${COOLIFY_SERVICE_UUID:-}-mongodb-1"
  local cur_vol count=0 tmp

  if [[ -n "${COOLIFY_SERVICE_UUID:-}" ]]; then
    cur_vol="$(vps_mongo_current_volume "$live_c")"
    if [[ -n "$cur_vol" && "$cur_vol" == "$vol" ]] && docker_cmd ps --format '{{.Names}}' | grep -qF "$live_c"; then
      count="$(docker_cmd exec "$live_c" mongosh \
        "mongodb://admin:${pw}@127.0.0.1:27017/${db}?authSource=admin" \
        --quiet --eval 'try { db.organizations.countDocuments() } catch(e) { 0 }' 2>/dev/null || echo 0)"
      echo "$count"
      return
    fi
  fi

  tmp="mongo-vol-audit-$$-${RANDOM}"
  if ! docker_cmd run -d --name "$tmp" -v "${vol}:/data/db" mongo:7 mongod --bind_ip_all >/dev/null 2>&1; then
    echo "-1"
    return
  fi

  for _ in $(seq 1 25); do
    docker_cmd exec "$tmp" mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1 && break
    sleep 1
  done

  if [[ -n "$pw" ]]; then
    count="$(docker_cmd exec "$tmp" mongosh \
      "mongodb://admin:${pw}@127.0.0.1:27017/${db}?authSource=admin" \
      --quiet --eval 'try { db.organizations.countDocuments() } catch(e) { 0 }' 2>/dev/null || echo 0)"
  else
    count="$(docker_cmd exec "$tmp" mongosh --quiet --eval \
      "try { db.getSiblingDB('${db}').organizations.countDocuments() } catch(e) { 0 }" 2>/dev/null || echo 0)"
  fi

  docker_cmd rm -f "$tmp" >/dev/null 2>&1 || true
  echo "$count"
}

vps_mongo_pick_richest_volume() {
  local pw="$1" db="${2:-discord-whatsapp}"
  local best="" best_n=-1 vol c
  while read -r vol; do
    [[ -z "$vol" ]] && continue
    c="$(vps_mongo_count_orgs_in_volume "$vol" "$pw" "$db")"
    echo "[mongo-vol] ${vol} → ${c} organizations" >&2
    if [[ "$c" =~ ^[0-9]+$ ]] && (( c > best_n )); then
      best_n="$c"
      best="$vol"
    fi
  done < <(docker_cmd volume ls --format '{{.Name}}' | grep -E 'mongodb-data|mongo-data' | sort -u || true)
  printf '%s|%s' "${best:-}" "${best_n:--1}"
}
