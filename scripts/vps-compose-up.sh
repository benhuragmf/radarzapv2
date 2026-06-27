#!/usr/bin/env bash
# Sobe stack Docker Compose lendo .env (sem rebuild).
set -euo pipefail
cd "${DEPLOY_PATH:-/opt/radarzap}"
IMAGE="${1:-radarzap:production}"
export DOCKER_CMD="${DOCKER_CMD:-sudo docker}"
bash scripts/deploy-remote.sh "$IMAGE"
