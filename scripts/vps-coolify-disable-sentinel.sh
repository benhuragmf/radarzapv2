#!/usr/bin/env bash
# Desativa coolify-sentinel (deploy direto sem labels) + sync painel Running.
# O sentinel marca "exited" mesmo com containers Up — bug conhecido Coolify + compose manual.
# Uso: sudo -E bash scripts/vps-coolify-disable-sentinel.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
MARKER="/data/coolify/.radarchat-sentinel-disabled"

log() { echo "[coolify-disable-sentinel] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

if docker_cmd ps -a --format '{{.Names}}' | grep -qx 'coolify-sentinel'; then
  docker_cmd update --restart=no coolify-sentinel 2>/dev/null || true
  docker_cmd stop coolify-sentinel 2>/dev/null || true
  log "coolify-sentinel parado (restart=no)"
else
  log "coolify-sentinel ausente — skip"
fi

if docker_cmd ps --format '{{.Names}}' | grep -q '^coolify$'; then
  docker_cmd exec -u root coolify chmod 666 /var/run/docker.sock 2>/dev/null || true
fi

sudo mkdir -p /data/coolify
date -Iseconds | sudo tee "$MARKER" >/dev/null

sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-sync-panel.sh"
sudo -E bash "${DEPLOY_PATH}/scripts/vps-install-coolify-panel-sync-cron.sh" || true

log "OK — painel sincronizado; sentinel desativado para RadarChat (deploy direto)"
