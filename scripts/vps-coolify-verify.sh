#!/usr/bin/env bash
# Gate obrigatório: falha (exit 1) se produção Coolify estiver incompleta, duplicada ou desincronizada.
# Uso: sudo -E bash scripts/vps-coolify-verify.sh
set -euo pipefail

CANONICAL_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
CANONICAL_NAME="${COOLIFY_SERVICE_NAME:-RadarChat}"
COOLIFY_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${CANONICAL_UUID}}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"

failures=0
log() { echo "[coolify-verify] $*"; }
fail() { log "FALHA: $*"; failures=$((failures + 1)); }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

log "=== Gate produção RadarChat (uuid=${CANONICAL_UUID}) ==="

# --- Disco (gate deploy) ---
disk_pct="$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo 0)"
if [[ "$disk_pct" =~ ^[0-9]+$ ]] && (( disk_pct >= 92 )); then
  fail "disco / em ${disk_pct}% — rode scripts/vps-docker-prune-safe.sh na VPS antes do deploy"
elif [[ "$disk_pct" =~ ^[0-9]+$ ]] && (( disk_pct >= 82 )); then
  log "AVISO: disco / em ${disk_pct}% — limpeza recomendada"
else
  log "OK disco / (${disk_pct}% usado)"
fi

# --- Docker containers ---
for svc in app mongodb redis; do
  cname="${CANONICAL_UUID}-${svc}-1"
  if ! docker_cmd ps --format '{{.Names}} {{.Status}}' | grep -qF "$cname"; then
    fail "container ausente ou parado: ${cname}"
  elif docker_cmd ps --format '{{.Names}} {{.Status}}' | grep -F "$cname" | grep -qiE 'exited|restarting|dead'; then
    fail "container unhealthy: ${cname} — $(docker_cmd ps --format '{{.Status}}' --filter "name=^${cname}$" 2>/dev/null || echo '?')"
  else
    log "OK container ${cname}"
  fi
done

# --- Health HTTP ---
if curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
  log "OK :3001/api/services/health"
else
  fail ":3001 não responde health"
fi

if curl -sf -o /dev/null --max-time 12 "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null; then
  log "OK https://${PUBLIC_HOST}/api/services/health"
else
  fail "HTTPS ${PUBLIC_HOST} sem health"
fi

# --- Compose canônico ---
if [[ ! -f "${COOLIFY_DIR}/docker-compose.yaml" ]]; then
  fail "compose ausente em ${COOLIFY_DIR}"
fi
if [[ ! -r "${COOLIFY_DIR}/.env" ]]; then
  fail ".env Coolify ilegível em ${COOLIFY_DIR}"
fi

# --- Permissões (painel 500) ---
if [[ ! -w "${COOLIFY_DIR}" ]] && [[ "${EUID}" -ne 0 ]]; then
  fail "sem permissão de escrita em ${COOLIFY_DIR} (painel Coolify 500)"
fi

# --- Legado GHCR não deve competir ---
legacy="$(docker_cmd ps --format '{{.Names}}' 2>/dev/null | grep -E '^radarchat-' || true)"
if [[ -n "$legacy" ]]; then
  fail "stack legado radarchat-* ainda rodando: ${legacy}"
fi

# --- Coolify DB: uma única stack RadarChat ---
if docker_cmd ps --format '{{.Names}}' | grep -q '^coolify-db$'; then
  psql_coolify() {
    docker_cmd exec coolify-db psql -U coolify -d coolify -t -A -c "$1" 2>/dev/null | tr -d '\r'
  }

  svc_count="$(psql_coolify "SELECT count(*) FROM services WHERE deleted_at IS NULL AND (lower(name) LIKE '%radar%' OR uuid = '${CANONICAL_UUID}');" || echo 0)"
  if [[ "${svc_count:-0}" != "1" ]]; then
    fail "esperado 1 service RadarChat no Coolify, encontrado: ${svc_count:-?}"
    psql_coolify "SELECT uuid || ' | ' || name FROM services WHERE deleted_at IS NULL;" 2>/dev/null | while read -r line; do
      [[ -n "$line" ]] && log "  service: $line"
    done || true
  else
    canon_name="$(psql_coolify "SELECT name FROM services WHERE uuid = '${CANONICAL_UUID}' AND deleted_at IS NULL LIMIT 1;" || true)"
    if [[ "$canon_name" != "$CANONICAL_NAME" ]]; then
      fail "service canônico nome='${canon_name:-?}' (esperado ${CANONICAL_NAME})"
    else
      log "OK 1 service Coolify: ${CANONICAL_UUID} | ${CANONICAL_NAME}"
    fi
  fi

  dup_radarchat="$(psql_coolify "SELECT count(*) FROM services WHERE deleted_at IS NULL AND lower(name) LIKE '%radarchat%' AND uuid != '${CANONICAL_UUID}';" || echo 0)"
  if [[ "${dup_radarchat:-0}" != "0" ]]; then
    fail "service 'radarchat' duplicado ainda registrado (${dup_radarchat})"
  fi

  proj_radarchat="$(psql_coolify "SELECT count(*) FROM projects WHERE deleted_at IS NULL AND lower(name) = 'radarchat' AND id NOT IN (SELECT e.project_id FROM environments e JOIN services s ON s.environment_id = e.id WHERE s.uuid = '${CANONICAL_UUID}' AND s.deleted_at IS NULL LIMIT 1);" || echo 0)"
  if [[ "${proj_radarchat:-0}" != "0" ]]; then
    fail "projeto Radar Chat duplicado ainda existe no painel"
  fi

  bad_app="$(psql_coolify "SELECT count(*) FROM service_applications sa JOIN services s ON s.id = sa.service_id WHERE s.uuid = '${CANONICAL_UUID}' AND sa.status NOT LIKE 'running:%';" || echo 0)"
  bad_db="$(psql_coolify "SELECT count(*) FROM service_databases sd JOIN services s ON s.id = sd.service_id WHERE s.uuid = '${CANONICAL_UUID}' AND sd.status NOT LIKE 'running:%';" || echo 0)"
  if [[ "${bad_app:-0}" != "0" || "${bad_db:-0}" != "0" ]]; then
    log "painel desincronizado (apps=${bad_app:-?} dbs=${bad_db:-?}) — sync automático..."
    sudo -E bash "${DEPLOY_PATH:-/opt/radarchat}/scripts/vps-coolify-sync-panel.sh" || true
    sleep 3
    bad_app="$(psql_coolify "SELECT count(*) FROM service_applications sa JOIN services s ON s.id = sa.service_id WHERE s.uuid = '${CANONICAL_UUID}' AND sa.status NOT LIKE 'running:%';" || echo 0)"
    bad_db="$(psql_coolify "SELECT count(*) FROM service_databases sd JOIN services s ON s.id = sd.service_id WHERE s.uuid = '${CANONICAL_UUID}' AND sd.status NOT LIKE 'running:%';" || echo 0)"
  fi
  if [[ "${bad_app:-0}" != "0" || "${bad_db:-0}" != "0" ]]; then
    fail "status painel desincronizado (apps=${bad_app:-?} dbs=${bad_db:-?} — esperado running:*)"
  else
    log "OK status painel running:* nos componentes"
  fi
else
  fail "coolify-db ausente — impossível validar dedupe no painel"
fi

# --- Pastas duplicadas ---
orphan_dirs=0
for dir in /data/coolify/services/*/; do
  [[ -d "$dir" ]] || continue
  uuid="$(basename "$dir")"
  [[ "$uuid" == "$CANONICAL_UUID" ]] && continue
  if [[ "$uuid" == h143* ]] || grep -qiE 'radar|radarchat' "$dir/docker-compose.yaml" 2>/dev/null; then
    fail "pasta duplicada em /data/coolify/services/${uuid}"
    orphan_dirs=$((orphan_dirs + 1))
  fi
done
[[ "$orphan_dirs" -eq 0 ]] && log "OK sem pastas duplicadas em /data/coolify/services"

log "=== Resultado: ${failures} falha(s) ==="
if [[ "$failures" -gt 0 ]]; then
  log "Correção: sudo -E bash ${DEPLOY_PATH}/scripts/vps-coolify-reconcile.sh"
  exit 1
fi

log "GATE OK — produção RadarChat íntegra"
exit 0
