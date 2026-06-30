#!/usr/bin/env bash
# Deploy leve em producao Coolify: pull GHCR + recria so o servico app.
# Mongo, Redis, Traefik e rotas HTTPS permanecem intactos (~2-4 min vs ~12 min full).
# Uso: sudo -E bash scripts/vps-coolify-deploy-app.sh
# Full republish (compose + SSL): scripts/vps-fix-coolify-ssl.sh
set -euo pipefail

# Sem comandos externos aqui: sudo secure_path pode ocultar tr/sed do PATH inicial.
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

coolify_mongo_running() {
  sudo docker ps --format '{{.Names}}' 2>/dev/null | grep -qF "${COOLIFY_SERVICE_UUID}-mongodb-1"
}

wait_app_health() {
  local i
  for i in $(seq 1 "$WAIT_MAX"); do
    if curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
      log "App OK em :3001 (tentativa $i/$WAIT_MAX)"
      return 0
    fi
    log "Aguardando :3001 ($i/$WAIT_MAX)..."
    sleep "$WAIT_INTERVAL_SEC"
  done
  return 1
}

dump_app_logs() {
  local cname
  cname="$(sudo docker ps -a --format '{{.Names}}' 2>/dev/null | grep -E "${COOLIFY_SERVICE_UUID}-app" | head -1 || true)"
  [[ -n "$cname" ]] || return 0
  log "=== Logs ${cname} (ultimas 40 linhas) ==="
  sudo docker logs "$cname" --tail 40 2>&1 | while read -r line; do log "  $line"; done
}

log "Iniciando deploy app-only (uuid=${COOLIFY_SERVICE_UUID}, image=${RADARZAP_IMAGE})"

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

env_file="${COOLIFY_SERVICE_DIR}/.env"
if [[ -f "$env_file" ]]; then
  if sudo grep -q '^RADARZAP_IMAGE=' "$env_file"; then
    sudo sed -i "s|^RADARZAP_IMAGE=.*|RADARZAP_IMAGE=${RADARZAP_IMAGE}|" "$env_file"
  else
    echo "RADARZAP_IMAGE=${RADARZAP_IMAGE}" | sudo tee -a "$env_file" >/dev/null
  fi
fi

log "Pull app -> ${RADARZAP_IMAGE}"
if ! (cd "$COOLIFY_SERVICE_DIR" && sudo docker compose --env-file .env \
  -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" pull app); then
  log "ERRO: docker compose pull app falhou"
  dump_app_logs
  exit 1
fi

log "Recriando somente app (--no-deps --force-recreate, mongo/redis preservados)..."
if (cd "$COOLIFY_SERVICE_DIR" && sudo docker compose --env-file .env \
  -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" up -d --no-deps --force-recreate --wait --wait-timeout 180 app) 2>/dev/null; then
  log "Compose --wait OK"
elif ! (cd "$COOLIFY_SERVICE_DIR" && sudo docker compose --env-file .env \
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
