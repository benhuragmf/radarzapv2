#!/usr/bin/env bash
# Deploy no servidor: pull da imagem GHCR + docker compose.
# Uso: RADARCHAT_IMAGE=ghcr.io/owner/radarchat:abc123 bash scripts/deploy-remote.sh
set -euo pipefail

IMAGE="${1:?informe a imagem (ex.: ghcr.io/owner/radarchat:sha)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.deploy.yml}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
if [[ "${USE_SUDO_DOCKER:-}" == "1" ]] || ! docker info >/dev/null 2>&1; then
  DOCKER_BIN="sudo docker"
fi

# Carrega secrets via --env-file (evita bash source quebrar em MAIL_FROM com <>)
ENV_FILE="${ENV_FILE:-.env}"
COMPOSE_ENV=()
if [[ -f "$ENV_FILE" ]]; then
  COMPOSE_ENV=(--env-file "$ENV_FILE")
  # export para app env_file + interpolação ${MONGO_PASSWORD}
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

export RADARCHAT_IMAGE="$IMAGE"

echo "[deploy] Imagem: $RADARCHAT_IMAGE"
$DOCKER_BIN pull "$RADARCHAT_IMAGE" || {
  echo "[deploy] ERRO: falha ao baixar $RADARCHAT_IMAGE"
  exit 1
}

run_compose() {
  local extra=(RADARCHAT_IMAGE="$RADARCHAT_IMAGE")
  [[ -n "${MONGO_PASSWORD:-}" ]] && extra+=(MONGO_PASSWORD="$MONGO_PASSWORD")
  if [[ "$DOCKER_BIN" == "sudo docker" ]]; then
    sudo env "${extra[@]}" docker compose "$@"
  else
    env "${extra[@]}" docker compose "$@"
  fi
}

run_compose "${COMPOSE_ENV[@]}" -f "$COMPOSE_FILE" up -d --remove-orphans
run_compose "${COMPOSE_ENV[@]}" -f "$COMPOSE_FILE" ps

echo "[deploy] Health check..."
for i in $(seq 1 30); do
  # /api/services/health exige sessão (401) — considerar app no ar se a porta responde
  if wget -q --spider http://127.0.0.1:3001/ 2>/dev/null; then
    echo "[deploy] OK"
    exit 0
  fi
  if wget -qO- http://127.0.0.1:3001/api/services/health 2>/dev/null | grep -q healthy; then
    echo "[deploy] OK"
    exit 0
  fi
  sleep 2
done

echo "[deploy] AVISO: health não respondeu em 60s — verifique logs"
run_compose "${COMPOSE_ENV[@]}" -f "$COMPOSE_FILE" logs --tail=40 app
exit 1
