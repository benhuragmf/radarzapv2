#!/usr/bin/env bash
# Garante app em :3001 + HTTPS (app.radarchat.com.br + sslip.io legado) via Traefik Coolify.
# Deploy rotineiro (só imagem app): scripts/vps-coolify-deploy-app.sh (~2–4 min).
# Só mudou .env/Discord: scripts/vps-coolify-hotfix-env.sh ou npm run vps:hotfix:env (~1–2 min).
# NÃO use este script para hotfix de variável — leva ~8–10 min (Traefik + republish completo).
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
TRAEFIK_EXTRA_HOSTS="${TRAEFIK_EXTRA_HOSTS:-151-247-210-180.sslip.io}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"

log() { echo "[fix-ssl] $*"; }

dump_app_logs() {
  local cname
  cname="$(sudo docker ps -a --format '{{.Names}}' 2>/dev/null | grep -E "${COOLIFY_SERVICE_UUID}-app|h143brhw.*app" | head -1 || true)"
  [[ -n "$cname" ]] || return 0
  log "=== Logs ${cname} (últimas 40 linhas) ==="
  sudo docker logs "$cname" --tail 40 2>&1 | while read -r line; do log "  $line"; done
}

stop_conflicting_containers() {
  sudo -E bash scripts/vps-purge-legacy-stack.sh || true
}

apply_traefik_routes() {
  PUBLIC_HOST="$PUBLIC_HOST" sudo -E bash scripts/vps-coolify-traefik-route-legacy.sh || true
  local extra
  for extra in ${TRAEFIK_EXTRA_HOSTS//,/ }; do
    extra="$(echo "$extra" | xargs)"
    [[ -z "$extra" || "$extra" == "$PUBLIC_HOST" ]] && continue
    log "Rota legado: ${extra}"
    PUBLIC_HOST="$extra" sudo -E bash scripts/vps-coolify-traefik-route-legacy.sh || true
  done
}

wait_app_health() {
  local max="${1:-36}"
  local i
  for i in $(seq 1 "$max"); do
    if curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
      log "App OK em :3001 (tentativa $i/$max)"
      return 0
    fi
    log "Aguardando :3001 ($i/$max)..."
    sleep 10
  done
  return 1
}

log "=== 0) Permissões stack Coolify + Discord env ==="
sudo -E bash scripts/vps-coolify-fix-permissions.sh || true
if [[ -n "${DISCORD_CLIENT_SECRET:-}" || -n "${DISCORD_CLIENT_ID:-}" || -n "${DISCORD_TOKEN:-}" ]]; then
  sudo -E bash scripts/vps-sync-discord-env.sh || true
elif [[ -f "${DEPLOY_PATH}/.env" ]]; then
  sudo bash scripts/vps-patch-env-key.sh "${DEPLOY_PATH}/.env" DISCORD_GUILD_ID "${DISCORD_GUILD_ID:-1521572626793889925}" || true
fi

log "=== 1) Parar legado + republicar Coolify ==="
cd "$DEPLOY_PATH"
stop_conflicting_containers
export COOLIFY_COMPOSE_MODE=ghcr
export MIGRATE_LEGACY=0
export COOLIFY_REPUBLISH_DIRECT=1
export PUBLIC_HOST="${PUBLIC_HOST}"
export SERVICE_UUID="${COOLIFY_SERVICE_UUID}"
export RADARZAP_IMAGE="${RADARZAP_IMAGE:-ghcr.io/benhuragmf/radarzapv2:latest}"
sudo -E bash scripts/vps-configure-coolify-radarzap.sh || true

if ! wait_app_health 36; then
  log "ERRO: app não respondeu em :3001 após republish"
  dump_app_logs
  exit 1
fi

log "=== 2) HTTPS Traefik → :3001 (${PUBLIC_HOST}) ==="
apply_traefik_routes

log "=== 3) Verificar HTTPS + gate produção ==="
for i in $(seq 1 18); do
  if curl -sf -o /dev/null --max-time 12 "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null; then
    log "OK: https://${PUBLIC_HOST}"
    break
  fi
  log "HTTPS tentativa $i/18..."
  sleep 10
  [[ "$i" -eq 18 ]] && {
    dump_app_logs
    log "Se ainda falhar: docker logs coolify-proxy --tail 50"
    exit 1
  }
done

sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-sync-panel.sh"
exec sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-verify.sh"
