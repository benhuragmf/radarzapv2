#!/usr/bin/env bash
# Corrige Permission denied em /data/coolify/services/{uuid} (painel Coolify 500 / Settings).
# Coolify v4.1+ pode resetar /data/coolify para 2700 9999:root no restart — ubuntu não atravessa.
set -euo pipefail

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"
COOLIFY_SSH_USER="${COOLIFY_SSH_USER:-ubuntu}"

log() { echo "[coolify-perms] $*"; }

if [[ ! -d /data/coolify ]]; then
  log "Sem /data/coolify — ignorando"
  exit 0
fi

log "Corrigindo permissões Coolify (uuid=${COOLIFY_SERVICE_UUID})"

# Grupo coolify (GID 9999) — padrão Coolify non-root SSH
if ! getent group coolify >/dev/null 2>&1; then
  sudo groupadd -g 9999 coolify 2>/dev/null || sudo groupadd coolify 2>/dev/null || true
fi
if id "$COOLIFY_SSH_USER" >/dev/null 2>&1; then
  sudo usermod -aG coolify "$COOLIFY_SSH_USER" 2>/dev/null || true
fi

# Parent dirs: Coolify #10401 reseta /data/coolify para 2700 9999:root após restart
for parent in /data/coolify /data/coolify/services /data/coolify/applications /data/coolify/databases; do
  sudo mkdir -p "$parent"
done

sudo chown 9999:coolify /data/coolify /data/coolify/services 2>/dev/null || \
  sudo chown 9999:0 /data/coolify /data/coolify/services 2>/dev/null || true
sudo chmod 2750 /data/coolify /data/coolify/services 2>/dev/null || \
  sudo chmod 755 /data/coolify /data/coolify/services 2>/dev/null || true

sudo mkdir -p "${COOLIFY_SERVICE_DIR}"

sudo chown -R 9999:coolify /data/coolify/services 2>/dev/null || \
  sudo chown -R 9999:0 /data/coolify/services 2>/dev/null || \
  sudo chown -R ubuntu:ubuntu /data/coolify/services 2>/dev/null || true

sudo find /data/coolify/services -type d -exec chmod 2775 {} + 2>/dev/null || \
  sudo find /data/coolify/services -type d -exec chmod 775 {} + 2>/dev/null || true
sudo find /data/coolify/services -type f -exec chmod 664 {} + 2>/dev/null || true

if command -v setfacl >/dev/null 2>&1; then
  sudo setfacl -R -m "u:${COOLIFY_SSH_USER}:rwx" /data/coolify/services 2>/dev/null || true
  sudo setfacl -R -d -m "u:${COOLIFY_SSH_USER}:rwx" /data/coolify/services 2>/dev/null || true
fi

if [[ ! -f "${COOLIFY_SERVICE_DIR}/docker-compose.yaml" && -f /opt/radarzap/docker-compose.coolify-ghcr.yml ]]; then
  log "Compose ausente — copiando template GHCR"
  sudo cp /opt/radarzap/docker-compose.coolify-ghcr.yml "${COOLIFY_SERVICE_DIR}/docker-compose.yaml"
fi

# Travessia como ubuntu (mesmo teste do painel ao abrir Settings)
if id "$COOLIFY_SSH_USER" >/dev/null 2>&1; then
  if ! sudo -u "$COOLIFY_SSH_USER" test -x "${COOLIFY_SERVICE_DIR}" 2>/dev/null; then
    log "AVISO: ${COOLIFY_SSH_USER} não atravessa ${COOLIFY_SERVICE_DIR} — relaxando parents"
    sudo chmod 755 /data/coolify /data/coolify/services "${COOLIFY_SERVICE_DIR}" 2>/dev/null || true
  fi
fi

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^coolify$'; then
  log "Reiniciando container coolify..."
  sudo docker restart coolify >/dev/null 2>&1 || true
  sleep 10
fi

parent_perm="$(stat -c '%a %U:%G' /data/coolify 2>/dev/null || echo '?')"
svc_perm="$(stat -c '%a %U:%G' "${COOLIFY_SERVICE_DIR}" 2>/dev/null || echo '?')"
log "OK — /data/coolify=${parent_perm} service=${svc_perm}"

if id "$COOLIFY_SSH_USER" >/dev/null 2>&1; then
  if sudo -u "$COOLIFY_SSH_USER" test -x "${COOLIFY_SERVICE_DIR}" 2>/dev/null; then
    log "OK travessia ${COOLIFY_SSH_USER} → ${COOLIFY_SERVICE_DIR}"
  else
    log "ERRO: ${COOLIFY_SSH_USER} ainda sem acesso a ${COOLIFY_SERVICE_DIR}"
    exit 1
  fi
fi
