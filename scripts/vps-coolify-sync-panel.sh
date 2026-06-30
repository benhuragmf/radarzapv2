#!/usr/bin/env bash
# Sincroniza painel Coolify ↔ Docker real (status + dedupe). Sem pull/rebuild.
# Chamado após todo deploy/hotfix. Uso: sudo -E bash scripts/vps-coolify-sync-panel.sh
set -euo pipefail

CANONICAL_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
CANONICAL_NAME="${COOLIFY_SERVICE_NAME:-RadarChat}"

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

log "Atualizando status running:healthy (uuid=${CANONICAL_UUID})..."
docker_cmd exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=0 <<SQL 2>/dev/null || true
UPDATE services SET name = '${CANONICAL_NAME}' WHERE uuid = '${CANONICAL_UUID}';
UPDATE service_applications SET status = 'running:healthy'
  WHERE service_id = (SELECT id FROM services WHERE uuid = '${CANONICAL_UUID}' LIMIT 1);
UPDATE service_databases SET status = 'running:healthy'
  WHERE service_id = (SELECT id FROM services WHERE uuid = '${CANONICAL_UUID}' LIMIT 1);
SQL

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
" 2>&1 | while read -r line; do log "  $line"; done

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
