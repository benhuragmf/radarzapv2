#!/usr/bin/env bash
# Dispatcher de deploy Coolify no VPS (chamado pelo workflow Deploy via SSH).
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
TRAEFIK_EXTRA_HOSTS="${TRAEFIK_EXTRA_HOSTS:-151-247-210-180.sslip.io}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
RADARCHAT_IMAGE="${RADARCHAT_IMAGE:-${IMAGE:-ghcr.io/benhuragmf/radarchatv2:latest}}"
DEPLOY_MODE="${DEPLOY_MODE:-app-only}"
REPO_OWNER="${REPO_OWNER:-benhuragmf}"

log() { echo "[deploy-main] $*"; }

cd "$DEPLOY_PATH"
git fetch origin main -q && git reset --hard origin/main -q

export USE_SUDO_DOCKER=1
export DEPLOY_PATH PUBLIC_HOST TRAEFIK_EXTRA_HOSTS COOLIFY_SERVICE_UUID RADARCHAT_IMAGE

if [[ -n "${GHCR_PAT:-}" ]]; then
  echo "$GHCR_PAT" | sudo docker login ghcr.io -u "$REPO_OWNER" --password-stdin
fi

PRUNE_SCRIPT="${DEPLOY_PATH}/scripts/vps-docker-prune-safe.sh"
if [[ -f "$PRUNE_SCRIPT" ]]; then
  log "Pre-deploy: limpeza segura de imagens Docker"
  sudo -E bash "$PRUNE_SCRIPT" || sudo -E bash "$PRUNE_SCRIPT" --aggressive || true
fi

log "modo=${DEPLOY_MODE} image=${RADARCHAT_IMAGE}"

if [[ "$DEPLOY_MODE" == "full-republish" ]]; then
  exec sudo -E bash "${DEPLOY_PATH}/scripts/vps-fix-coolify-ssl.sh"
fi

exec sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-deploy-app.sh"
