#!/usr/bin/env bash
# Cadastra os dois VPS no Coolify: Radar Chat (.180 local) + RadarGamer (.179 remoto).
# Uso: sudo -E bash scripts/vps-coolify-servers-setup.sh
# Env: COOLIFY_SSH_PRIVATE_KEY ou DEPLOY_SSH_KEY; RADARGAMER_SSH_PRIVATE_KEY (opcional, default = mesma chave)
set -euo pipefail
export COOLIFY_SERVERS_ONLY=1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec sudo -E bash "${SCRIPT_DIR}/vps-configure-coolify-radarchat.sh"
