#!/usr/bin/env bash
# Instala a chave pública do deploy (DEPLOY_SSH_KEY) no VPS RadarGamer via senha inicial.
# Uso: sudo -E bash scripts/vps-setup-radargamer-ssh.sh
# Env: RADARGAMER_PASSWORD (obrigatório), COOLIFY_SSH_PRIVATE_KEY ou DEPLOY_SSH_KEY
set -euo pipefail

RADARGAMER_SERVER_IP="${RADARGAMER_SERVER_IP:-151.247.210.179}"
COOLIFY_SSH_USER="${COOLIFY_SSH_USER:-ubuntu}"
KEY_CONTENT="${COOLIFY_SSH_PRIVATE_KEY:-${DEPLOY_SSH_KEY:-}}"
RADARGAMER_PASSWORD="${RADARGAMER_PASSWORD:-}"

log() { echo "[radargamer-ssh] $*" >&2; }

if [[ -z "$RADARGAMER_PASSWORD" ]]; then
  log "ERRO: defina RADARGAMER_PASSWORD (senha ubuntu do painel Platon, só para bootstrap)"
  exit 1
fi
if [[ -z "$KEY_CONTENT" ]]; then
  log "ERRO: defina COOLIFY_SSH_PRIVATE_KEY ou DEPLOY_SSH_KEY"
  exit 1
fi

command -v ssh-keygen >/dev/null || { log "ERRO: ssh-keygen ausente"; exit 1; }

if ! command -v sshpass >/dev/null 2>&1; then
  log "Instalando sshpass..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sshpass openssh-client
fi

KEY_FILE="$(mktemp)"
trap 'rm -f "$KEY_FILE" "${KEY_FILE}.pub"' EXIT
umask 077
printf '%s\n' "$KEY_CONTENT" >"$KEY_FILE"
chmod 600 "$KEY_FILE"
ssh-keygen -y -f "$KEY_FILE" >"${KEY_FILE}.pub"

log "Testando login por senha em ${COOLIFY_SSH_USER}@${RADARGAMER_SERVER_IP}..."
if ! SSHPASS="$RADARGAMER_PASSWORD" sshpass -e ssh \
  -o StrictHostKeyChecking=accept-new \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o ConnectTimeout=20 \
  "${COOLIFY_SSH_USER}@${RADARGAMER_SERVER_IP}" 'echo ok' | grep -q ok; then
  log "ERRO: senha ou rede — confira firewall Platon (porta 22) e credenciais"
  exit 1
fi

log "Instalando chave pública no authorized_keys..."
SSHPASS="$RADARGAMER_PASSWORD" sshpass -e ssh-copy-id \
  -i "$KEY_FILE" \
  -o StrictHostKeyChecking=accept-new \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  "${COOLIFY_SSH_USER}@${RADARGAMER_SERVER_IP}"

log "Testando SSH por chave (mesma do RadarZap / Coolify)..."
if ssh -i "$KEY_FILE" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=15 "${COOLIFY_SSH_USER}@${RADARGAMER_SERVER_IP}" 'echo ok' | grep -q ok; then
  log "OK — ${COOLIFY_SSH_USER}@${RADARGAMER_SERVER_IP} aceita a chave de deploy"
else
  log "ERRO: chave instalada mas login por chave falhou"
  exit 1
fi
