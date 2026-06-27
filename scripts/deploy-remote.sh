#!/usr/bin/env bash
# Deploy no servidor: pull da imagem GHCR + docker compose.
# Uso: RADARZAP_IMAGE=ghcr.io/owner/radarzap:abc123 bash scripts/deploy-remote.sh
set -euo pipefail

IMAGE="${1:?informe a imagem (ex.: ghcr.io/owner/radarzap:sha)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.deploy.yml}"

# Carrega secrets do .env no servidor (não sobrescrever com env vazio do SSH)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export RADARZAP_IMAGE="$IMAGE"
COMPOSE="${DOCKER_CMD:-docker} compose"
ENV_PREFIX="RADARZAP_IMAGE=$RADARZAP_IMAGE"
if [[ -n "${MONGO_PASSWORD:-}" ]]; then
  ENV_PREFIX="$ENV_PREFIX MONGO_PASSWORD=$MONGO_PASSWORD"
fi

echo "[deploy] Imagem: $RADARZAP_IMAGE"
${DOCKER_CMD:-docker} pull "$RADARZAP_IMAGE" 2>/dev/null || true
env $ENV_PREFIX $COMPOSE -f "$COMPOSE_FILE" up -d --remove-orphans
env $ENV_PREFIX $COMPOSE -f "$COMPOSE_FILE" ps

echo "[deploy] Health check..."
for i in $(seq 1 30); do
  if wget -qO- http://127.0.0.1:3001/api/services/health 2>/dev/null | grep -q healthy; then
    echo "[deploy] OK"
    exit 0
  fi
  sleep 2
done

echo "[deploy] AVISO: health não respondeu em 60s — verifique logs"
  ${DOCKER_CMD:-docker} compose -f "$COMPOSE_FILE" logs --tail=40 app
exit 1
