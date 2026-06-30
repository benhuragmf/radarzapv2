#!/usr/bin/env bash
# Dispatcher de deploy Coolify no VPS (chamado pelo workflow Deploy via SSH).
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
TRAEFIK_EXTRA_HOSTS="${TRAEFIK_EXTRA_HOSTS:-151-247-210-180.sslip.io}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
RADARZAP_IMAGE="${RADARZAP_IMAGE:-${IMAGE:-ghcr.io/benhuragmf/radarzapv2:latest}}"
DEPLOY_MODE="${DEPLOY_MODE:-app-only}"
REPO_OWNER="${REPO_OWNER:-benhuragmf}"

log() { echo "[deploy-main] $*"; }

cd "$DEPLOY_PATH"
git fetch origin main -q && git reset --hard origin/main -q

export USE_SUDO_DOCKER=1
export DEPLOY_PATH PUBLIC_HOST TRAEFIK_EXTRA_HOSTS COOLIFY_SERVICE_UUID RADARZAP_IMAGE

if [[ -n "${GHCR_PAT:-}" ]]; then
  echo "$GHCR_PAT" | sudo docker login ghcr.io -u "$REPO_OWNER" --password-stdin
fi

log "modo=${DEPLOY_MODE} image=${RADARZAP_IMAGE}"

if [[ "$DEPLOY_MODE" == "full-republish" ]]; then
  exec sudo -E bash "${DEPLOY_PATH}/scripts/vps-fix-coolify-ssl.sh"
fi

exec sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-deploy-app.sh"
