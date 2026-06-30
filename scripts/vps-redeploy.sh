#!/usr/bin/env bash
# Rebuild + deploy após git pull (VPS já bootstrapped).
set -euo pipefail
cd "${DEPLOY_PATH:-/opt/radarchat}"
git fetch origin main
git reset --hard origin/main
export MONGO_PASSWORD="$(grep '^MONGO_PASSWORD=' .env | cut -d= -f2-)"
DOCKER="sudo docker"
echo "[redeploy] Build sem cache..."
$DOCKER build --no-cache -f docker/Dockerfile.monolith -t radarchat:production .
export RADARCHAT_IMAGE=radarchat:production
export DOCKER_CMD="sudo docker"
sudo -E bash scripts/deploy-remote.sh "$RADARCHAT_IMAGE"
