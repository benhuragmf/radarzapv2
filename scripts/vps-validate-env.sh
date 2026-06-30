#!/usr/bin/env bash
# Mostra erros de validateConfig no container (debug deploy).
set -euo pipefail
IMAGE="${1:-radarchat:production}"
ENV_FILE="${2:-.env}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
[[ "${USE_SUDO_DOCKER:-}" == "1" ]] && DOCKER_BIN="sudo docker"
$DOCKER_BIN run --rm --env-file "$ENV_FILE" -e NODE_ENV=production "$IMAGE" \
  node -e "const v=require('./dist/config/environment'); try{v.validateConfig();console.log('validateConfig: OK')}catch(e){console.error(e.message);process.exit(1)}"
