#!/usr/bin/env bash
# Sobe stack Docker Compose lendo .env (sem rebuild).
set -euo pipefail
cd "${DEPLOY_PATH:-/opt/radarzap}"
IMAGE="${1:-radarzap:production}"
export USE_SUDO_DOCKER=1
bash scripts/deploy-remote.sh "$IMAGE"
