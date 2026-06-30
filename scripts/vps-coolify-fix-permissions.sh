#!/usr/bin/env bash
# Corrige Permission denied em /data/coolify/services/{uuid} (painel Coolify 500).
set -euo pipefail

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"

log() { echo "[coolify-perms] $*"; }

if [[ ! -d /data/coolify/services ]]; then
  log "Sem /data/coolify/services — ignorando"
  exit 0
fi

log "Ajustando permissões em ${COOLIFY_SERVICE_DIR}"
sudo mkdir -p "${COOLIFY_SERVICE_DIR}"
sudo chmod 755 /data/coolify/services
sudo chmod 755 "${COOLIFY_SERVICE_DIR}" 2>/dev/null || true

if id coolify >/dev/null 2>&1; then
  sudo chown -R coolify:coolify "${COOLIFY_SERVICE_DIR}" 2>/dev/null || \
    sudo chown -R 9999:9999 "${COOLIFY_SERVICE_DIR}" 2>/dev/null || true
else
  sudo chown -R ubuntu:ubuntu "${COOLIFY_SERVICE_DIR}" 2>/dev/null || \
    sudo chown -R root:root "${COOLIFY_SERVICE_DIR}" 2>/dev/null || true
fi

sudo chmod -R u+rwX,g+rwX,o+rX "${COOLIFY_SERVICE_DIR}" 2>/dev/null || true
log "OK — ${COOLIFY_SERVICE_DIR} acessível"
