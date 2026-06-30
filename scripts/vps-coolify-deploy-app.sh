#!/usr/bin/env bash
# Deploy leve em producao Coolify: pull GHCR + recria so o servico app.
# Mongo, Redis, Traefik e rotas HTTPS permanecem intactos (~2-4 min vs ~12 min full).
# Uso: sudo -E bash scripts/vps-coolify-deploy-app.sh
# Full republish (compose + SSL): scripts/vps-fix-coolify-ssl.sh
set -euo pipefail

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID//$'\r'/}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR//$'\r'/}"
RADARZAP_IMAGE="${RADARZAP_IMAGE:-ghcr.io/benhuragmf/radarzapv2:latest}"
RADARZAP_IMAGE="${RADARZAP_IMAGE//$'\r'/}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
DEPLOY_PATH="${DEPLOY_PATH//$'\r'/}"
WAIT_MAX="${WAIT_MAX:-36}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-5}"

log() { echo "[coolify-deploy-app] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

coolify_mongo_running() {
  local names
  names="$(docker_cmd ps --format '{{.Names}}' 2>/dev/null || true)"
  [[ "$names" == *"${COOLIFY_SERVICE_UUID}-mongodb-1"* ]]
}

set_radarzap_image_env() {
  local env_file="$1"
  local image="$2"
  [[ -f "$env_file" ]] || return 0

  local tmp found=0 line
  tmp="$(mktemp)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == RADARZAP_IMAGE=* ]]; then
      printf 'RADARZAP_IMAGE=%s\n' "$image" >>"$tmp"
      found=1
    else
      printf '%s\n' "$line" >>"$tmp"
    fi
  done <"$env_file"
  if [[ "$found" -eq 0 ]]; then
    printf 'RADARZAP_IMAGE=%s\n' "$image" >>"$tmp"
  fi
  if [[ "${EUID}" -eq 0 ]]; then
    cp "$tmp" "$env_file"
  else
    sudo cp "$tmp" "$env_file"
  fi
  rm -f "$tmp"
}

wait_app_health() {
  local i
  for ((i = 1; i <= WAIT_MAX; i++)); do
    if /usr/bin/curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
      log "App OK em :3001 (tentativa $i/$WAIT_MAX)"
      return 0
    fi
    log "Aguardando :3001 ($i/$WAIT_MAX)..."
    sleep "$WAIT_INTERVAL_SEC"
  done
  return 1
}

dump_app_logs() {
  local cname names
  names="$(docker_cmd ps -a --format '{{.Names}}' 2>/dev/null || true)"
  cname=""
  while IFS= read -r line; do
    if [[ "$line" == *"${COOLIFY_SERVICE_UUID}-app"* ]]; then
      cname="$line"
      break
    fi
  done <<<"$names"
  [[ -n "$cname" ]] || return 0
  log "=== Logs ${cname} (ultimas 40 linhas) ==="
  docker_cmd logs "$cname" --tail 40 2>&1 | while IFS= read -r line; do log "  $line"; done
}

log "Iniciando deploy app-only (uuid=${COOLIFY_SERVICE_UUID}, image=${RADARZAP_IMAGE})"

sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-fix-permissions.sh" || true

if [[ ! -d "$COOLIFY_SERVICE_DIR" || ! -f "${COOLIFY_SERVICE_DIR}/docker-compose.yaml" ]]; then
  log "ERRO: stack Coolify ausente em ${COOLIFY_SERVICE_DIR}"
  log "Use deploy full: sudo -E bash ${DEPLOY_PATH}/scripts/vps-fix-coolify-ssl.sh"
  exit 1
fi

if ! coolify_mongo_running; then
  log "ERRO: Mongo Coolify nao esta Up (${COOLIFY_SERVICE_UUID}-mongodb-1)"
  log "Primeiro deploy exige republicacao full"
  exit 1
fi

set_radarzap_image_env "${COOLIFY_SERVICE_DIR}/.env" "$RADARZAP_IMAGE"

log "Pull app -> ${RADARZAP_IMAGE}"
if ! (cd "$COOLIFY_SERVICE_DIR" && docker_cmd compose --env-file .env \
  -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" pull app); then
  log "ERRO: docker compose pull app falhou"
  dump_app_logs
  exit 1
fi

log "Recriando somente app (--no-deps --force-recreate, mongo/redis preservados)..."
if (cd "$COOLIFY_SERVICE_DIR" && docker_cmd compose --env-file .env \
  -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" up -d --no-deps --force-recreate --wait --wait-timeout 180 app) 2>/dev/null; then
  log "Compose --wait OK"
elif ! (cd "$COOLIFY_SERVICE_DIR" && docker_cmd compose --env-file .env \
  -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" up -d --no-deps --force-recreate app); then
  log "ERRO: docker compose up app falhou"
  dump_app_logs
  exit 1
fi

if ! wait_app_health; then
  log "ERRO: health :3001 falhou apos deploy app"
  dump_app_logs
  exit 1
fi

log "Deploy app concluido (${RADARZAP_IMAGE})"
