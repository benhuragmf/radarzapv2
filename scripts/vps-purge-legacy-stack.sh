#!/usr/bin/env bash
# Remove stack legado GHCR (docker-compose.deploy.yml) do host — volumes preservados.
# Coolify (h143brhw…) continua como única produção.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"

log() { echo "[purge-legacy] $*"; }

is_coolify_name() {
  local name="$1"
  [[ "$name" == *"$COOLIFY_SERVICE_UUID"* ]] && return 0
  [[ "$name" == *"coolify"* ]] && return 0
  [[ "$name" == *"h143brhw"* ]] && return 0
  return 1
}

log "=== Stack legado GHCR em ${DEPLOY_PATH} ==="
if [[ -f "${DEPLOY_PATH}/docker-compose.deploy.yml" ]]; then
  if [[ -f "${DEPLOY_PATH}/.env" ]]; then
    (cd "$DEPLOY_PATH" && sudo docker compose -f docker-compose.deploy.yml --env-file .env down --remove-orphans) || true
  else
    (cd "$DEPLOY_PATH" && sudo docker compose -f docker-compose.deploy.yml down --remove-orphans) || true
  fi
  log "docker compose deploy down OK"
else
  log "compose legado ausente — limpando containers órfãos radarchat-*"
fi

while read -r cname; do
  [[ -z "$cname" ]] && continue
  if is_coolify_name "$cname"; then
    continue
  fi
  if [[ "$cname" == radarchat-* ]]; then
    log "Removendo: $cname"
    sudo docker rm -f "$cname" 2>/dev/null || true
  fi
done < <(sudo docker ps -a --format '{{.Names}}' 2>/dev/null || true)

left="$(sudo docker ps -a --format '{{.Names}}' 2>/dev/null | grep -E '^radarchat-' || true)"
if [[ -n "$left" ]]; then
  log "AVISO: containers radarchat-* restantes:"
  echo "$left" | while read -r line; do log "  $line"; done
else
  log "OK: zero containers radarchat-* legado"
fi

log ""
log "=== Coolify (deve continuar Up) ==="
sudo docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null \
  | grep -iE 'h143|coolify-proxy' || log "(nenhum container Coolify listado)"

if curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
  log "OK: :3001 health"
else
  log "AVISO: :3001 sem health — rode scripts/vps-fix-coolify-ssl.sh"
  exit 1
fi

log "Volumes Docker NÃO foram apagados (sessões WA / Mongo Coolify preservados)."
