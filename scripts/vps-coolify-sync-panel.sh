#!/usr/bin/env bash
# Sincroniza painel Coolify ↔ Docker real (status + dedupe). Sem pull/rebuild.
# Chamado após todo deploy/hotfix. Uso: sudo -E bash scripts/vps-coolify-sync-panel.sh
set -euo pipefail

CANONICAL_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
CANONICAL_NAME="${COOLIFY_SERVICE_NAME:-RadarChat}"
COOLIFY_SERVER_UUID="${COOLIFY_SERVER_UUID:-hklsapd6w3wwu9g00k514vjt}"
COOLIFY_SSH_USER="${COOLIFY_SSH_USER:-ubuntu}"

log() { echo "[coolify-sync-panel] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

if ! docker_cmd ps --format '{{.Names}}' | grep -q '^coolify$'; then
  log "AVISO: container coolify ausente — sync painel ignorado"
  exit 0
fi

psql_coolify() {
  docker_cmd exec coolify-db psql -U coolify -d coolify -t -A -c "$1" 2>/dev/null | tr -d '\r'
}

log "Atualizando status running (uuid=${CANONICAL_UUID})..."

# Aguardar painel Coolify após restart (tinker falha se routes cache ausente)
for i in $(seq 1 30); do
  if curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:8000/" 2>/dev/null; then
    break
  fi
  [[ "$i" -eq 30 ]] && log "AVISO: Coolify :8000 lento — sync segue mesmo assim"
  sleep 2
done

psql_coolify "UPDATE services SET name = '${CANONICAL_NAME}' WHERE uuid = '${CANONICAL_UUID}';" || true
psql_coolify "UPDATE service_applications SET status = 'running:healthy' WHERE service_id = (SELECT id FROM services WHERE uuid = '${CANONICAL_UUID}' LIMIT 1);" || true
psql_coolify "UPDATE service_databases SET status = 'running:healthy' WHERE service_id = (SELECT id FROM services WHERE uuid = '${CANONICAL_UUID}' LIMIT 1);" || true
psql_coolify "UPDATE servers SET is_reachable = true, \"user\" = '${COOLIFY_SSH_USER}' WHERE uuid = '${COOLIFY_SERVER_UUID}';" || true

docker_cmd exec coolify php artisan tinker --execute="
\$keep = '${CANONICAL_UUID}';
foreach (\\App\\Models\\Service::query()->get() as \$s) {
  if (\$s->uuid === \$keep) {
    \$s->name = '${CANONICAL_NAME}';
    \$s->save();
    foreach (\$s->applications as \$app) {
      \$app->status = 'running:healthy';
      \$app->save();
    }
    foreach (\$s->databases as \$db) {
      \$db->status = 'running:healthy';
      \$db->save();
    }
    echo 'SYNC_OK ' . \$keep . PHP_EOL;
    continue;
  }
  \$n = strtolower((string) (\$s->name ?? ''));
  if (str_contains(\$n, 'radar') || str_contains(\$n, 'radarchat')) {
    \$uuid = \$s->uuid;
    try { \$s->forceDelete(); echo 'DELETED ' . \$uuid . PHP_EOL; }
    catch (\\Throwable \$e) {
      try { \$s->delete(); echo 'SOFT_DELETED ' . \$uuid . PHP_EOL; }
      catch (\\Throwable \$e2) { echo 'DELETE_FAIL ' . \$uuid . PHP_EOL; }
    }
  }
}
foreach (\\App\\Models\\Project::all() as \$p) {
  if (strtolower(\$p->name ?? '') !== 'radarzap') { continue; }
  \$count = \\App\\Models\\Service::whereHas('environment', fn(\$q) => \$q->where('project_id', \$p->id))->count();
  if (\$count === 0) {
    try { \$p->forceDelete(); echo 'DELETED_PROJECT RadarZap' . PHP_EOL; }
    catch (\\Throwable \$e) { try { \$p->delete(); } catch (\\Throwable \$e2) {} }
  }
}
" 2>&1 | while read -r line; do log "  $line"; done || true

docker_cmd exec coolify php artisan tinker --execute="
\$srv = \\App\\Models\\Server::where('uuid', '${COOLIFY_SERVER_UUID}')->first();
if (\$srv) {
  \$srv->user = '${COOLIFY_SSH_USER}';
  try { \$srv->is_reachable = true; } catch (\\Throwable \$e) {}
  \$srv->save();
  echo 'SERVER_REACHABLE ' . '${COOLIFY_SERVER_UUID}' . PHP_EOL;
}
" 2>&1 | while read -r line; do log "  $line"; done || true

svc_status="$(psql_coolify "SELECT COALESCE((SELECT status FROM service_applications sa JOIN services s ON s.id = sa.service_id WHERE s.uuid = '${CANONICAL_UUID}' LIMIT 1), 'sem-app');" || echo '?')"
app_bad="$(psql_coolify "SELECT count(*) FROM service_applications sa JOIN services s ON s.id = sa.service_id WHERE s.uuid = '${CANONICAL_UUID}' AND sa.status NOT LIKE 'running:%';" || echo '?')"
db_bad="$(psql_coolify "SELECT count(*) FROM service_databases sd JOIN services s ON s.id = sd.service_id WHERE s.uuid = '${CANONICAL_UUID}' AND sd.status NOT LIKE 'running:%';" || echo '?')"
log "Pós-sync DB: service=${svc_status} apps_off=${app_bad} dbs_off=${db_bad}"

for dir in /data/coolify/services/*/; do
  [[ -d "$dir" ]] || continue
  uuid="$(basename "$dir")"
  [[ "$uuid" == "$CANONICAL_UUID" ]] && continue
  if [[ "$uuid" == h143* ]] || grep -qiE 'radar|radarchat' "$dir/docker-compose.yaml" 2>/dev/null; then
    log "Removendo pasta duplicada ${uuid}…"
    (cd "$dir" && docker_cmd compose down --remove-orphans 2>/dev/null) || true
    sudo rm -rf "$dir" 2>/dev/null || true
  fi
done

log "Sync painel concluído"
