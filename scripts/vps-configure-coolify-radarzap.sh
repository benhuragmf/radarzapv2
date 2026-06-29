#!/usr/bin/env bash
# Configura resource RadarZap no Coolify (API) e opcionalmente migra do compose legado.
# Uso: sudo -E bash scripts/vps-configure-coolify-radarzap.sh
# Env: DEPLOY_PATH, PUBLIC_HOST, MIGRATE_LEGACY (0|1), COOLIFY_ROOT_EMAIL, COOLIFY_ROOT_PASSWORD
set -euo pipefail

COOLIFY_URL="${COOLIFY_URL:-http://127.0.0.1:8000}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
PUBLIC_HOST="${PUBLIC_HOST:-151-247-210-180.sslip.io}"
PUBLIC_URL="https://${PUBLIC_HOST}"
MIGRATE_LEGACY="${MIGRATE_LEGACY:-1}"
ROOT_EMAIL="${COOLIFY_ROOT_EMAIL:-admin@${PUBLIC_HOST}}"
ROOT_PASSWORD="${COOLIFY_ROOT_PASSWORD:-}"

log() { echo "[coolify-config] $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { log "ERRO: comando '$1' ausente"; exit 1; }
}

need_cmd curl
need_cmd jq
need_cmd docker
need_cmd base64

psql_exec() {
  docker exec coolify-db psql -U coolify -d coolify -t -A -c "$1" 2>/dev/null | tr -d '\r'
}

api() {
  local method="$1" path="$2"
  shift 2
  local tmp http
  tmp="$(mktemp)"
  http="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
    -H "Authorization: Bearer ${API_TOKEN#*|}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    "${COOLIFY_URL}${path}" "$@")"
  if [[ "$http" -lt 200 || "$http" -ge 300 ]]; then
    log "API ${method} ${path} → HTTP ${http}: $(cat "$tmp")"
    rm -f "$tmp"
    return 1
  fi
  cat "$tmp"
  rm -f "$tmp"
}

wait_coolify() {
  for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" "${COOLIFY_URL}/" | grep -qE '200|302'; then
      return 0
    fi
    sleep 2
  done
  log "ERRO: Coolify não responde em ${COOLIFY_URL}"
  exit 1
}

ensure_root_user() {
  local count
  count="$(psql_exec 'SELECT count(*) FROM users;' || echo 0)"
  if [[ "${count:-0}" != "0" ]]; then
    log "Usuário Coolify já existe (count=$count)."
    return 0
  fi
  if [[ -z "$ROOT_PASSWORD" ]]; then
    ROOT_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)Aa1!"
  fi
  log "Criando usuário root Coolify (${ROOT_EMAIL})..."
  docker exec coolify php artisan tinker --execute="
\$email = '${ROOT_EMAIL}';
\$pass = '${ROOT_PASSWORD}';
if (\\App\\Models\\User::count() > 0) { echo 'exists'; exit; }
\$user = \\App\\Models\\User::create([
  'name' => 'Benhur',
  'email' => \$email,
  'password' => \\Illuminate\\Support\\Facades\\Hash::make(\$pass),
]);
\$team = \\App\\Models\\Team::create(['name' => 'RadarZap', 'personal_team' => true]);
\$user->teams()->attach(\$team, ['role' => 'owner']);
\$user->current_team_id = \$team->id;
\$user->save();
echo 'ok';
" >/dev/null
  log "Login Coolify: ${ROOT_EMAIL} / senha gerada (veja secret COOLIFY_ROOT_PASSWORD ou logs do workflow)."
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::add-mask::${ROOT_PASSWORD}"
    log "COOLIFY_ROOT_PASSWORD=${ROOT_PASSWORD}"
  fi
}

ensure_team() {
  log "Garantindo team vinculado ao usuário..."
  local out
  out="$(docker exec coolify php artisan tinker --execute='
$user = \App\Models\User::orderBy("id")->first();
if (!$user || !$user->id) { echo "ERROR:no-user"; exit(1); }
$team = \App\Models\Team::first();
if (!$team) {
  $team = \App\Models\Team::create(["name" => "RadarZap", "personal_team" => true]);
  $user->teams()->syncWithoutDetaching([$team->id => ["role" => "owner"]]);
}
if (!$user->current_team_id) {
  $user->current_team_id = $team->id;
  $user->save();
}
\DB::table("servers")->whereNull("team_id")->update(["team_id" => $team->id]);
echo "team=" . $team->id . " user=" . $user->id;
' 2>&1)" || true
  if ! echo "$out" | grep -q 'team='; then
    log "ERRO ao garantir team: $out"
    exit 1
  fi
  log "$out"
}

enable_api_and_token() {
  ensure_team

  log "Habilitando API Coolify..."
  docker exec coolify php artisan tinker --execute='
$s = \App\Models\InstanceSettings::first();
$s->is_api_enabled = true;
$s->save();
echo "ok";
' >/dev/null
  docker exec coolify php artisan config:clear >/dev/null 2>&1 || true
  sleep 10

  log "Gerando token API..."
  local out
  out="$(docker exec coolify php artisan tinker --execute='
$user = \App\Models\User::orderBy("id")->first();
$team = \App\Models\Team::first();
if (!$user || !$team || !$user->id || !$team->id) { echo "ERROR:no-user-team"; exit(1); }
\Laravel\Sanctum\PersonalAccessToken::where("name", "radarzap-automation")->delete();
$plain = \Illuminate\Support\Str::random(48);
$pat = new \Laravel\Sanctum\PersonalAccessToken();
$pat->name = "radarzap-automation";
$pat->token = hash("sha256", $plain);
$pat->abilities = "[\"root\"]";
$pat->tokenable_type = get_class($user);
$pat->tokenable_id = $user->id;
$pat->team_id = $team->id;
$pat->save();
echo "TOKEN|" . $plain;
' 2>&1)" || true
  API_TOKEN="$(echo "$out" | grep -oE 'TOKEN\|[A-Za-z0-9]+' | tail -1 | tr '|' '\n' | tail -1 || true)"
  if [[ -z "$API_TOKEN" ]]; then
    log "ERRO ao criar token. Saída artisan:"
    echo "$out"
    exit 1
  fi
  API_TOKEN="1|${API_TOKEN}"
}

detect_legacy_volumes() {
  local project
  project="$(docker volume ls --format '{{.Name}}' | grep -E '_radarzap-sessions$' | head -1 || true)"
  if [[ -z "$project" ]]; then
    project="$(docker volume ls --format '{{.Name}}' | grep -E 'radarzap-sessions' | head -1 || true)"
  fi
  VOL_SESSIONS="${project:-}"
  VOL_MONGO="$(docker volume ls --format '{{.Name}}' | grep -E 'mongodb-data' | head -1 || true)"
  VOL_REDIS="$(docker volume ls --format '{{.Name}}' | grep -E 'redis-data' | head -1 || true)"
  VOL_MEDIA="$(docker volume ls --format '{{.Name}}' | grep -E 'radarzap-media' | head -1 || true)"
  VOL_LOGS="$(docker volume ls --format '{{.Name}}' | grep -E 'radarzap-logs' | head -1 || true)"
  log "Volumes legado: sessions=${VOL_SESSIONS:-novo} mongo=${VOL_MONGO:-novo}"
}

build_compose_with_external_volumes() {
  local src="${DEPLOY_PATH}/docker-compose.coolify.yml"
  local out="/tmp/radarzap-coolify-compose.yml"
  if [[ -z "${VOL_SESSIONS:-}" ]]; then
    cp "$src" "$out"
    COMPOSE_FILE="$out"
    return 0
  fi
  # Substitui bloco volumes por externos (reutiliza dados do deploy GHCR)
  sed '/^volumes:/,$d' "$src" >"$out"
  {
    echo "volumes:"
    if [[ -n "${VOL_MONGO:-}" ]]; then
      echo "  mongodb-data:"
      echo "    external: true"
      echo "    name: ${VOL_MONGO}"
    else
      echo "  mongodb-data:"
    fi
    if [[ -n "${VOL_REDIS:-}" ]]; then
      echo "  redis-data:"
      echo "    external: true"
      echo "    name: ${VOL_REDIS}"
    else
      echo "  redis-data:"
    fi
    echo "  radarzap-sessions:"
    echo "    external: true"
    echo "    name: ${VOL_SESSIONS}"
    if [[ -n "${VOL_MEDIA:-}" ]]; then
      echo "  radarzap-media:"
      echo "    external: true"
      echo "    name: ${VOL_MEDIA}"
    else
      echo "  radarzap-media:"
    fi
    if [[ -n "${VOL_LOGS:-}" ]]; then
      echo "  radarzap-logs:"
      echo "    external: true"
      echo "    name: ${VOL_LOGS}"
    else
      echo "  radarzap-logs:"
    fi
  } >>"$out"
  COMPOSE_FILE="$out"
}

ensure_project_and_server() {
  local projects
  projects="$(api GET /api/v1/projects)"
  PROJECT_UUID="$(echo "$projects" | jq -r '.[] | select(.name=="RadarZap") | .uuid' | head -1)"
  if [[ -z "$PROJECT_UUID" || "$PROJECT_UUID" == "null" ]]; then
    log "Criando projeto RadarZap..."
    PROJECT_UUID="$(api POST /api/v1/projects -d '{"name":"RadarZap","description":"RadarZap v2 produção"}' | jq -r '.uuid')"
  fi
  SERVER_UUID="$(api GET /api/v1/servers | jq -r '.[0].uuid')"
  if [[ -z "$SERVER_UUID" || "$SERVER_UUID" == "null" ]]; then
    log "ERRO: nenhum servidor no Coolify"
    exit 1
  fi
  log "Project=$PROJECT_UUID Server=$SERVER_UUID"
}

ensure_service() {
  local existing
  existing="$(api GET /api/v1/services | jq -r '.[] | select(.name=="radarzap") | .uuid' | head -1)"
  if [[ -n "$existing" && "$existing" != "null" ]]; then
    SERVICE_UUID="$existing"
    log "Service radarzap já existe: $SERVICE_UUID"
    return 0
  fi

  local compose_b64
  compose_b64="$(base64 -w0 "$COMPOSE_FILE" 2>/dev/null || base64 "$COMPOSE_FILE" | tr -d '\n')"
  log "Criando service Docker Compose..."
  SERVICE_UUID="$(api POST /api/v1/services -d @- <<EOF | jq -r '.uuid'
{
  "name": "radarzap",
  "description": "RadarZap monolito + Mongo + Redis",
  "project_uuid": "${PROJECT_UUID}",
  "server_uuid": "${SERVER_UUID}",
  "environment_name": "production",
  "docker_compose_raw": "${compose_b64}",
  "instant_deploy": false,
  "force_domain_override": true,
  "urls": ["https://${PUBLIC_HOST}:3001:app"]
}
EOF
)"
  if [[ -z "$SERVICE_UUID" || "$SERVICE_UUID" == "null" ]]; then
    log "ERRO ao criar service"
    exit 1
  fi
  log "Service criado: $SERVICE_UUID"
}

sync_env_from_legacy() {
  local env_file="${DEPLOY_PATH}/.env"
  if [[ ! -f "$env_file" ]]; then
    log "AVISO: ${env_file} não encontrado — configure env manualmente no Coolify"
    return 0
  fi
  log "Sincronizando variáveis do .env legado..."
  # shellcheck disable=SC1091
  set -a
  source "$env_file"
  set +a

  local mongo_pw="${MONGO_PASSWORD:-${SERVICE_PASSWORD_MONGODB:-}}"
  [[ -z "$mongo_pw" ]] && mongo_pw="$(openssl rand -base64 24)"

  local payload='[]'
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    [[ "$line" != *"="* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(echo "$key" | xargs)"
    case "$key" in
      MONGODB_URL|MONGO_PASSWORD|RADARZAP_IMAGE|FRONTEND_URL|CORS_ORIGIN) continue ;;
    esac
    payload="$(echo "$payload" | jq --arg k "$key" --arg v "$val" '. + [{"key": $k, "value": $v, "is_preview": false, "is_build_time": false, "is_literal": true}]')"
  done <"$env_file"

  payload="$(echo "$payload" | jq --arg v "$mongo_pw" '. + [{"key":"SERVICE_PASSWORD_MONGODB","value":$v,"is_preview":false,"is_build_time":false,"is_literal":true}]')"

  api POST "/api/v1/services/${SERVICE_UUID}/envs/bulk" -d "{\"data\":${payload}}" >/dev/null || {
    log "AVISO: bulk env falhou — cole .env manualmente no painel"
  }
}

deploy_service() {
  log "Disparando deploy..."
  api POST "/api/v1/deploy?uuid=${SERVICE_UUID}" -d '{}' >/dev/null || api POST "/api/v1/services/${SERVICE_UUID}/start" >/dev/null || true
}

stop_legacy_stack() {
  if [[ ! -f "${DEPLOY_PATH}/docker-compose.deploy.yml" ]]; then
    return 0
  fi
  log "Parando stack legado GHCR (volumes preservados)..."
  (cd "$DEPLOY_PATH" && sudo docker compose -f docker-compose.deploy.yml down --remove-orphans) || true
}

# --- main ---
wait_coolify
ensure_root_user
enable_api_and_token

# Validar API
for i in $(seq 1 12); do
  raw="$(curl -sS -H "Authorization: Bearer ${API_TOKEN#*|}" -H "Accept: application/json" "${COOLIFY_URL}/api/v1/version" 2>/dev/null || true)"
  VER="$(echo "$raw" | jq -r '.version // empty' 2>/dev/null || true)"
  if [[ -n "$VER" ]]; then
    log "Coolify API OK — versão ${VER}"
    break
  fi
  log "Aguardando API (tentativa $i/12)..."
  [[ "$i" -eq 12 ]] && { log "ERRO: API Coolify indisponível. Última resposta: $raw"; exit 1; }
  sleep 5
done

detect_legacy_volumes
build_compose_with_external_volumes
ensure_project_and_server
ensure_service
sync_env_from_legacy

if [[ "$MIGRATE_LEGACY" == "1" ]]; then
  stop_legacy_stack
  deploy_service
  log "Deploy iniciado. Aguarde build (~10–20 min) em ${COOLIFY_URL}"
else
  log "MIGRATE_LEGACY=0 — service criado sem deploy. Migre manualmente depois."
fi

log "Painel: ${COOLIFY_URL}"
log "App (após deploy): ${PUBLIC_URL}"
log "Próximo: conectar GitHub no Coolify (Settings → Git) para auto-deploy em push main."
