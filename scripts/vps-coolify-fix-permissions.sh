#!/usr/bin/env bash
# Corrige Permission denied em /data/coolify/services/{uuid} (painel Coolify 500).
# Coolify roda deploy como uid 9999 — o diretório precisa ser legível/gravável por esse usuário.
set -euo pipefail

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"

log() { echo "[coolify-perms] $*"; }

if [[ ! -d /data/coolify ]]; then
  log "Sem /data/coolify — ignorando"
  exit 0
fi

log "Corrigindo permissões Coolify (uuid=${COOLIFY_SERVICE_UUID})"
sudo mkdir -p "${COOLIFY_SERVICE_DIR}"

# Padrão Coolify v4: processo interno usa uid 9999
sudo chown -R 9999:0 /data/coolify/services 2>/dev/null || \
  sudo chown -R ubuntu:ubuntu /data/coolify/services 2>/dev/null || true

sudo find /data/coolify/services -type d -exec chmod 775 {} + 2>/dev/null || true
sudo find /data/coolify/services -type f -exec chmod 664 {} + 2>/dev/null || true
sudo chmod 755 /data/coolify/services

# Garantir arquivos mínimos do stack (Coolify quebra se pasta vazia/inacessível)
if [[ ! -f "${COOLIFY_SERVICE_DIR}/docker-compose.yaml" && -f /opt/radarzap/docker-compose.coolify-ghcr.yml ]]; then
  log "Compose ausente — copiando template GHCR"
  sudo cp /opt/radarzap/docker-compose.coolify-ghcr.yml "${COOLIFY_SERVICE_DIR}/docker-compose.yaml"
fi

log "OK — ${COOLIFY_SERVICE_DIR} (owner: $(stat -c '%U:%G' "${COOLIFY_SERVICE_DIR}" 2>/dev/null || echo '?'))"
