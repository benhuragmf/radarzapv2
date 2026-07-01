#!/usr/bin/env bash
# Restaura clientes (organizations) na produção Coolify:
# 1) audita volumes Mongo locais na VPS
# 2) remonta o Mongo do stack para o volume com mais dados (banco ao vivo local)
# 3) se necessário, copia via mongodump/mongorestore entre volumes
#
# Mongo = banco primário local na VPS (volume Docker persistente).
# Não apaga volumes — só troca qual volume o container Coolify monta.
#
# Uso: sudo -E bash scripts/vps-mongo-restore-clients.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/vps-mongo-volume-lib.sh
source "${SCRIPT_DIR}/vps-mongo-volume-lib.sh"

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
DB_NAME="${MONGO_DB_NAME:-discord-whatsapp}"
MIN_ORGS_TO_RESTORE="${MIN_ORGS_TO_RESTORE:-1}"

log() { echo "[mongo-restore] $*" >&2; }
fail() { log "ERRO: $*"; exit 1; }

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

ensure_mongo_password_in_env() {
  local env_file="${COOLIFY_SERVICE_DIR}/.env"
  [[ -f "$env_file" ]] || fail "env Coolify ausente: ${env_file}"

  local pw
  pw="$(read_env_var "$env_file" SERVICE_PASSWORD_MONGODB)"
  [[ -z "$pw" ]] && pw="$(read_env_var "$env_file" MONGO_PASSWORD)"
  [[ -z "$pw" ]] && pw="$(read_env_var "${DEPLOY_PATH}/.env" MONGO_PASSWORD)"
  [[ -z "$pw" ]] && fail "MONGO_PASSWORD / SERVICE_PASSWORD_MONGODB ausente"

  MONGO_PW="$pw"

  # Garante paridade — app e mongo usam a mesma senha do volume legado
  if ! grep -q "^SERVICE_PASSWORD_MONGODB=" "$env_file" 2>/dev/null; then
    echo "SERVICE_PASSWORD_MONGODB=${MONGO_PW}" >>"$env_file"
  fi
  if ! grep -q "^MONGO_PASSWORD=" "$env_file" 2>/dev/null; then
    echo "MONGO_PASSWORD=${MONGO_PW}" >>"$env_file"
  fi
  if ! grep -q "^MONGODB_URL=" "$env_file" 2>/dev/null; then
    echo "MONGODB_URL=mongodb://admin:${MONGO_PW}@mongodb:27017/${DB_NAME}?authSource=admin" >>"$env_file"
  fi
}

current_mongo_volume() {
  vps_mongo_current_volume "${COOLIFY_SERVICE_UUID}-mongodb-1"
}

count_orgs_live() {
  count_orgs_in_volume "$(current_mongo_volume)"
}

count_orgs_in_volume() {
  vps_mongo_count_orgs_in_volume "$1" "$MONGO_PW" "$DB_NAME"
}

pick_best_volume() {
  vps_mongo_pick_richest_volume "$MONGO_PW" "$DB_NAME"
}

patch_compose_mongo_external() {
  local compose="$1" vol_name="$2"
  python3 - "$compose" "$vol_name" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
vol = sys.argv[2]
text = path.read_text(encoding="utf-8")
lines = text.splitlines(keepends=True)

out: list[str] = []
in_volumes = False
replaced_mongo = False
skip_until_next_key = False

for line in lines:
    stripped = line.strip()

    if stripped == "volumes:" and not in_volumes:
        in_volumes = True
        out.append(line)
        continue

    if in_volumes:
        if stripped.startswith("mongodb-data:"):
            out.append("  mongodb-data:\n")
            out.append("    external: true\n")
            out.append(f"    name: {vol}\n")
            replaced_mongo = True
            skip_until_next_key = True
            continue
        if skip_until_next_key:
            if line.startswith("  ") and not line.startswith("    ") and stripped.endswith(":"):
                skip_until_next_key = False
            else:
                continue
        out.append(line)
        continue

    out.append(line)

if not replaced_mongo:
    raise SystemExit("mongodb-data: não encontrado no compose")

path.write_text("".join(out), encoding="utf-8")
PY
}

remount_mongo_volume() {
  local target_vol="$1"
  local compose="${COOLIFY_SERVICE_DIR}/docker-compose.yaml"
  [[ -f "$compose" ]] || fail "compose ausente: ${compose}"

  cp "$compose" "${compose}.bak.$(date +%Y%m%d%H%M%S)"
  patch_compose_mongo_external "$compose" "$target_vol"
  log "Compose patchado — mongodb-data external → ${target_vol}"

  cd "$COOLIFY_SERVICE_DIR"
  docker_cmd compose --env-file .env -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" stop app mongodb || true
  docker_cmd compose --env-file .env -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" rm -f mongodb || true
  docker_cmd compose --env-file .env -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" up -d mongodb

  for i in $(seq 1 30); do
    if docker_cmd exec "${COOLIFY_SERVICE_UUID}-mongodb-1" mongosh \
      "mongodb://admin:${MONGO_PW}@127.0.0.1:27017/admin?authSource=admin" \
      --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1; then
      log "Mongo OK após remount (tentativa $i)"
      break
    fi
    [[ "$i" -eq 30 ]] && fail "Mongo não respondeu após remount"
    sleep 2
  done

  docker_cmd compose --env-file .env -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" up -d app
}

copy_via_dump() {
  local source_vol="$1"
  local src_c="mongo-restore-src-$$"
  local live_c="${COOLIFY_SERVICE_UUID}-mongodb-1"
  local work="/tmp/radarchat-mongo-restore-$$"

  log "Cópia mongodump ${source_vol} → ${live_c}..."
  docker_cmd run -d --name "$src_c" -v "${source_vol}:/data/db" mongo:7 mongod --bind_ip_all >/dev/null
  for _ in $(seq 1 25); do
    docker_cmd exec "$src_c" mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1 && break
    sleep 1
  done

  docker_cmd exec "$src_c" mongodump \
    --uri="mongodb://admin:${MONGO_PW}@127.0.0.1:27017/${DB_NAME}?authSource=admin" \
    --out=/tmp/restore-dump

  rm -rf "$work"
  mkdir -p "$work"
  docker_cmd cp "${src_c}:/tmp/restore-dump/${DB_NAME}" "$work/"
  docker_cmd cp "$work/${DB_NAME}" "${live_c}:/tmp/restore-incoming"
  docker_cmd exec "$live_c" mongorestore \
    --uri="mongodb://admin:${MONGO_PW}@127.0.0.1:27017/?authSource=admin" \
    --db="${DB_NAME}" --drop "/tmp/restore-incoming"

  docker_cmd rm -f "$src_c" >/dev/null 2>&1 || true
  rm -rf "$work"
}

log "=== Restauração clientes Mongo (VPS local) ==="
[[ -d "$COOLIFY_SERVICE_DIR" ]] || fail "stack Coolify ausente em ${COOLIFY_SERVICE_DIR}"

ensure_mongo_password_in_env

cur_vol="$(current_mongo_volume)"
live_count="$(count_orgs_live 2>/dev/null || echo 0)"
log "Volume ativo: ${cur_vol:-?} | organizations atuais: ${live_count}"

IFS='|' read -r best_vol best_count <<< "$(pick_best_volume)"
log "Melhor volume: ${best_vol:-?} (${best_count} organizations)"

if [[ -z "$best_vol" || ! "$best_count" =~ ^[0-9]+$ ]] || (( best_count < MIN_ORGS_TO_RESTORE )); then
  fail "Nenhum volume com clientes (organizations >= ${MIN_ORGS_TO_RESTORE}). Rode vps-mongo-audit.sh para detalhes."
fi

if [[ "$cur_vol" == "$best_vol" && "$live_count" == "$best_count" ]]; then
  log "Nada a fazer — Coolify já monta ${best_vol} com ${live_count} organizations."
  exit 0
fi

if [[ "$cur_vol" != "$best_vol" ]]; then
  log "Remontando Mongo Coolify → volume ${best_vol} (${best_count} orgs)..."
  remount_mongo_volume "$best_vol"
elif (( live_count < best_count )); then
  log "Mesmo volume mas contagem diverge — cópia via dump..."
  copy_via_dump "$best_vol"
else
  log "Volume correto; contagem OK."
fi

final_count="$(count_orgs_live)"
log "Organizations após restore: ${final_count}"

if (( final_count < MIN_ORGS_TO_RESTORE )); then
  fail "Restore incompleto — organizations=${final_count}"
fi

log "Reiniciando app..."
cd "$COOLIFY_SERVICE_DIR"
docker_cmd compose --env-file .env -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" up -d --no-deps --force-recreate app

for i in $(seq 1 24); do
  if curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
    log "App healthy — clientes restaurados (${final_count} organizations)."
    exit 0
  fi
  sleep 5
done

fail "App não respondeu health após restore (organizations=${final_count})"
