#!/usr/bin/env bash
# Hotfix rápido (~1–2 min): permissões Coolify + patch .env + restart só o app (sem pull GHCR, sem Traefik/SSL).
# Uso VPS: sudo -E bash scripts/vps-coolify-hotfix-env.sh
# Local:    npm run vps:hotfix:env  (sync secrets .env → GitHub → workflow SSH)
set -euo pipefail

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
WAIT_MAX="${WAIT_MAX:-18}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-5}"

log() { echo "[hotfix-env] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

log "1/4 Permissões Coolify"
sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-fix-permissions.sh"

log "2/4 Sync env (Discord + chaves exportadas)"
if [[ -n "${DISCORD_TOKEN:-}${DISCORD_CLIENT_ID:-}${DISCORD_CLIENT_SECRET:-}${RADARCHAT_SYSTEM_ADMIN_DISCORD_IDS:-}" ]]; then
  sudo -E bash "${DEPLOY_PATH}/scripts/vps-sync-discord-env.sh"
else
  log "Sem DISCORD_* no shell — mantém .env existente"
fi

if [[ ! -f "${COOLIFY_SERVICE_DIR}/docker-compose.yaml" ]]; then
  log "ERRO: stack ausente em ${COOLIFY_SERVICE_DIR} — rode vps-fix-coolify-ssl.sh uma vez"
  exit 1
fi

log "3/4 Restart app (sem pull, mongo/redis intactos)"
if ! (cd "$COOLIFY_SERVICE_DIR" && docker_cmd compose --env-file .env \
  -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" up -d --no-deps --force-recreate app); then
  log "ERRO: compose up app falhou"
  exit 1
fi

log "4/6 Health :3001"
for ((i = 1; i <= WAIT_MAX; i++)); do
  if curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
    log "OK — app respondeu (tentativa $i/$WAIT_MAX)"
    break
  fi
  [[ "$i" -eq "$WAIT_MAX" ]] && {
    log "ERRO: app não respondeu em :3001"
    docker_cmd logs "${COOLIFY_SERVICE_UUID}-app-1" --tail 30 2>&1 || true
    exit 1
  }
  sleep "$WAIT_INTERVAL_SEC"
done

log "5/6 Sync painel Coolify"
sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-sync-panel.sh"

log "6/6 Gate de verificação"
exec sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-verify.sh"
