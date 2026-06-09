#!/usr/bin/env bash
# Deploy no servidor: pull da imagem GHCR + docker compose.
# Uso: RADARZAP_IMAGE=ghcr.io/owner/radarzap:abc123 bash scripts/deploy-remote.sh
set -euo pipefail

IMAGE="${1:?informe a imagem (ex.: ghcr.io/owner/radarzap:sha)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.deploy.yml}"

export RADARZAP_IMAGE="$IMAGE"

echo "[deploy] Imagem: $RADARZAP_IMAGE"
docker pull "$RADARZAP_IMAGE"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

echo "[deploy] Health check..."
for i in $(seq 1 30); do
  if wget -qO- http://127.0.0.1:3001/api/services/health 2>/dev/null | grep -q healthy; then
    echo "[deploy] OK"
    exit 0
  fi
  sleep 2
done

echo "[deploy] AVISO: health não respondeu em 60s — verifique logs"
docker compose -f "$COMPOSE_FILE" logs --tail=40 app
exit 1
