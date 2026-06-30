#!/usr/bin/env bash
# Reconcilia Coolify ↔ Docker real: sobe stack canônica, status "running" no painel, remove resource duplicado.
# Canônico: h143brhw5f8tgfj9trj0f3bd → app.radarchat.com.br
# Uso: sudo -E bash scripts/vps-coolify-reconcile.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
CANONICAL_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${CANONICAL_UUID}}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"

log() { echo "[coolify-reconcile] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

log "=== 1) Permissões Coolify ==="
sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-fix-permissions.sh"

log "=== 2) Subir stack canônica (app + mongo + redis) ==="
if [[ ! -f "${COOLIFY_DIR}/docker-compose.yaml" ]]; then
  log "ERRO: compose ausente em ${COOLIFY_DIR}"
  log "Rode uma vez: sudo -E bash ${DEPLOY_PATH}/scripts/vps-fix-coolify-ssl.sh"
  exit 1
fi

if ! (cd "$COOLIFY_DIR" && docker_cmd compose --env-file .env \
  -f docker-compose.yaml -p "${CANONICAL_UUID}" up -d --remove-orphans); then
  log "ERRO: docker compose up falhou"
  exit 1
fi

log "=== 3) Health :3001 ==="
for i in $(seq 1 24); do
  if curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
    log "OK :3001 (tentativa $i)"
    break
  fi
  [[ "$i" -eq 24 ]] && { log "ERRO: :3001 não respondeu"; exit 1; }
  sleep 5
done

log "=== 4) Sincronizar painel Coolify + remover duplicata ==="
if ! docker_cmd ps --format '{{.Names}}' | grep -q '^coolify$'; then
  log "Container coolify ausente — stack Docker OK, painel manual depois"
  exit 0
fi

psql_coolify() {
  docker_cmd exec coolify-db psql -U coolify -d coolify -t -A -c "$1" 2>/dev/null | tr -d '\r'
}

# Status no Coolify v4 vem de service_applications / service_databases (não coluna type em services)
log "  Atualizando status running:healthy nos componentes canônicos..."
docker_cmd exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=0 <<SQL 2>/dev/null || true
UPDATE services SET name = 'RadarChat' WHERE uuid = '${CANONICAL_UUID}';
UPDATE service_applications SET status = 'running:healthy'
  WHERE service_id = (SELECT id FROM services WHERE uuid = '${CANONICAL_UUID}' LIMIT 1);
UPDATE service_databases SET status = 'running:healthy'
  WHERE service_id = (SELECT id FROM services WHERE uuid = '${CANONICAL_UUID}' LIMIT 1);
SQL

docker_cmd exec coolify php artisan tinker --execute="
\$keep = '${CANONICAL_UUID}';
foreach (\\App\\Models\\Service::query()->get() as \$s) {
  \$line = \$s->uuid . ' | ' . (\$s->name ?? '?');
  echo \$line . PHP_EOL;
  if (\$s->uuid === \$keep) {
    \$s->name = 'RadarChat';
    \$s->save();
    foreach (\$s->applications as \$app) {
      \$app->status = 'running:healthy';
      \$app->save();
      echo 'APP_OK ' . (\$app->name ?? '?') . PHP_EOL;
    }
    foreach (\$s->databases as \$db) {
      \$db->status = 'running:healthy';
      \$db->save();
      echo 'DB_OK ' . (\$db->name ?? '?') . PHP_EOL;
    }
    echo 'KEEP ' . \$keep . PHP_EOL;
    continue;
  }
  \$n = strtolower((string) (\$s->name ?? ''));
  if (str_contains(\$n, 'radar') || str_contains(\$n, 'radarchat')) {
    try {
      \$uuid = \$s->uuid;
      \$s->forceDelete();
      echo 'DELETED ' . \$uuid . PHP_EOL;
    } catch (\\Throwable \$e) {
      try {
        \$uuid = \$s->uuid;
        \$s->delete();
        echo 'SOFT_DELETED ' . \$uuid . PHP_EOL;
      } catch (\\Throwable \$e2) {
        echo 'DELETE_FAIL ' . \$s->uuid . ' ' . \$e2->getMessage() . PHP_EOL;
      }
    }
  }
}
foreach (\\App\\Models\\Project::all() as \$p) {
  \$count = \\App\\Models\\Service::whereHas('environment', fn(\$q) => \$q->where('project_id', \$p->id))->count();
  echo 'PROJECT ' . \$p->name . ' uuid=' . \$p->uuid . ' services=' . \$count . PHP_EOL;
  if (\$count === 0 && strtolower(\$p->name ?? '') === 'radarzap') {
    try {
      \$p->forceDelete();
      echo 'DELETED_PROJECT RadarZap' . PHP_EOL;
    } catch (\\Throwable \$e) {
      try {
        \$p->delete();
        echo 'SOFT_DELETED_PROJECT RadarZap' . PHP_EOL;
      } catch (\\Throwable \$e2) {
        echo 'DELETE_PROJECT_FAIL ' . \$e2->getMessage() . PHP_EOL;
      }
    }
  }
}
echo 'DONE' . PHP_EOL;
" 2>&1 | while read -r line; do log "  $line"; done

# Pastas órfãs em /data/coolify/services (duplicata sem registro no painel)
for dir in /data/coolify/services/*/; do
  [[ -d "$dir" ]] || continue
  uuid="$(basename "$dir")"
  [[ "$uuid" == "$CANONICAL_UUID" ]] && continue
  if [[ "$uuid" == h143* ]] || grep -qiE 'radar|radarchat' "$dir/.env" 2>/dev/null || \
     grep -qiE 'radar|radarchat' "$dir/docker-compose.yaml" 2>/dev/null; then
    log "  Removendo pasta duplicada ${uuid}…"
    (cd "$dir" && docker_cmd compose down --remove-orphans 2>/dev/null) || true
    sudo rm -rf "$dir" 2>/dev/null || true
  fi
done

log "  Serviços restantes no Coolify:"
while read -r line; do
  [[ -n "$line" ]] && log "    $line"
done < <(psql_coolify "SELECT uuid || ' | ' || name FROM services WHERE deleted_at IS NULL ORDER BY name;" 2>/dev/null || true)

log "=== 5) Containers ==="
docker_cmd ps --format 'table {{.Names}}\t{{.Status}}' | grep -E "${CANONICAL_UUID}|NAMES" || true

log "=== OK ==="
log "Painel: use só RadarChat → production → resource ${CANONICAL_UUID:0:12}…"
log "App: https://${PUBLIC_HOST}"
