#!/usr/bin/env bash
# Diagnóstico: Coolify vs stack legado GHCR no VPS RadarZap (.180).
set -euo pipefail

PUBLIC_HOST="${PUBLIC_HOST:-151-247-210-180.sslip.io}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"

log() { echo "[coolify-status] $*"; }

log "=== Docker (radarzap / coolify / h143) ==="
sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null \
  | grep -iE 'coolify|radarzap|h143|mongo|redis|traefik|caddy' || echo "(nenhum container correspondente)"

log ""
log "=== Health :3001 (host) ==="
if curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
  log "OK http://127.0.0.1:3001/api/services/health"
else
  log "FALHA :3001 — app não responde no host"
fi

log ""
log "=== Health HTTPS app ==="
if curl -sf -o /dev/null --max-time 10 "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null; then
  log "OK https://${PUBLIC_HOST}/api/services/health"
else
  log "FALHA HTTPS ${PUBLIC_HOST}"
fi

log ""
log "=== Stack legado (docker-compose.deploy.yml) ==="
if [[ -f "${DEPLOY_PATH}/docker-compose.deploy.yml" ]]; then
  (cd "$DEPLOY_PATH" && sudo docker compose -f docker-compose.deploy.yml ps 2>/dev/null) || true
else
  log "compose legado ausente"
fi

log ""
log "=== Coolify API (serviço radarzap) ==="
if curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:8000/" 2>/dev/null | grep -qE '200|302'; then
  log "Painel Coolify :8000 responde"
else
  log "Painel Coolify :8000 não responde"
fi

COOLIFY_URL="${COOLIFY_URL:-http://127.0.0.1:8000}"
if command -v docker >/dev/null && docker ps --format '{{.Names}}' | grep -q '^coolify$'; then
  out="$(docker exec coolify php artisan tinker --execute='
$s = \App\Models\Service::where("name", "radarzap")->first();
if (!$s) { echo "service=ausente"; exit; }
echo "service=" . $s->uuid . " status=" . ($s->status ?? "?");
' 2>/dev/null)" || out=""
  log "Mongo Coolify: ${out:-indisponível}"
fi

log ""
log "=== Resumo ==="
coolify_app="$(sudo docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | grep -iE 'h143|coolify.*app' | head -3 || true)"
legacy_app="$(sudo docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | grep -iE 'radarzap.*app|radarzapv2' | grep -vi coolify | head -3 || true)"
if [[ -n "$coolify_app" ]]; then
  log "App Coolify (resource): SIM"
  echo "$coolify_app" | while read -r line; do log "  $line"; done
else
  log "App Coolify (resource): NÃO (stack Exited ou sem deploy)"
fi
if [[ -n "$legacy_app" ]]; then
  log "App legado GHCR: SIM (ativo)"
  echo "$legacy_app" | while read -r line; do log "  $line"; done
else
  log "App legado GHCR: NÃO rodando"
fi
