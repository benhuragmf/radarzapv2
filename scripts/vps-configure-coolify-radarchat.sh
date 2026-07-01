#!/usr/bin/env bash
# Configura resource RadarChat no Coolify (API) e opcionalmente migra do compose legado.
# Uso: sudo -E bash scripts/vps-configure-coolify-radarchat.sh
# Env: DEPLOY_PATH, PUBLIC_HOST, MIGRATE_LEGACY (0|1), COOLIFY_ROOT_EMAIL, COOLIFY_ROOT_PASSWORD
set -euo pipefail

COOLIFY_URL="${COOLIFY_URL:-http://127.0.0.1:8000}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
PUBLIC_URL="https://${PUBLIC_HOST}"
MIGRATE_LEGACY="${MIGRATE_LEGACY:-1}"
COOLIFY_SERVERS_ONLY="${COOLIFY_SERVERS_ONLY:-0}"
RADARCHAT_SERVER_IP="${RADARCHAT_SERVER_IP:-151.247.210.180}"
RADARCHAT_LOCAL_HOST="${RADARCHAT_LOCAL_HOST:-${RADARCHAT_SERVER_IP}}"
RADARGAMER_SERVER_IP="${RADARGAMER_SERVER_IP:-151.247.210.179}"
COOLIFY_SSH_USER="${COOLIFY_SSH_USER:-ubuntu}"
COOLIFY_SSH_PRIVATE_KEY="${COOLIFY_SSH_PRIVATE_KEY:-${DEPLOY_SSH_KEY:-}}"
RADARGAMER_SSH_PRIVATE_KEY="${RADARGAMER_SSH_PRIVATE_KEY:-${COOLIFY_SSH_PRIVATE_KEY:-}}"
COOLIFY_COMPOSE_MODE="${COOLIFY_COMPOSE_MODE:-ghcr}"
RADARCHAT_IMAGE_DEFAULT="${RADARCHAT_IMAGE_DEFAULT:-ghcr.io/benhuragmf/radarchatv2:latest}"
ROOT_EMAIL="${COOLIFY_ROOT_EMAIL:-admin@${PUBLIC_HOST}}"
ROOT_PASSWORD="${COOLIFY_ROOT_PASSWORD:-}"

log() { echo "[coolify-config] $*" >&2; }

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
    -H "Authorization: Bearer ${API_TOKEN}" \
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
\$team = \\App\\Models\\Team::create(['name' => 'RadarChat', 'personal_team' => true]);
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

fix_coolify_user_ids() {
  local email uid
  email="$(psql_exec "SELECT email FROM users WHERE email IS NOT NULL AND email <> '' ORDER BY created_at DESC NULLS LAST LIMIT 1;")"
  uid="$(psql_exec "SELECT id FROM users WHERE email IS NOT NULL AND email <> '' ORDER BY created_at DESC NULLS LAST LIMIT 1;")"
  log "Coolify user: id=${uid:-?} email=${email:-ausente}"
  if [[ -z "$email" ]]; then
    log "ERRO: crie a conta em http://$(curl -4 -s ifconfig.me 2>/dev/null || echo 151.247.210.180):8000/register"
    exit 1
  fi
  if [[ "${uid:-0}" == "0" ]]; then
    log "Corrigindo user id=0 no PostgreSQL..."
    docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 -c "
      SELECT setval(pg_get_serial_sequence('users','id'), GREATEST(1, COALESCE((SELECT MAX(id) FROM users WHERE id > 0), 0)));
      UPDATE users SET id = nextval(pg_get_serial_sequence('users','id'))
        WHERE (id IS NULL OR id = 0) AND email IS NOT NULL AND email <> '';
    " || {
      log "ERRO: não foi possível corrigir id do usuário. Recrie a conta no painel :8000"
      exit 1
    }
    uid="$(psql_exec "SELECT id FROM users WHERE email = '${email}' LIMIT 1;")"
    log "User id corrigido para ${uid}"
  fi
}

fix_coolify_team_ids() {
  local out tid
  out="$(docker exec coolify php artisan tinker --execute='
$badId = 0;
$team = \App\Models\Team::where("id", ">", 0)->first();
if (!$team && \App\Models\Team::find($badId)) {
  $old = \App\Models\Team::find($badId);
  $team = \App\Models\Team::create([
    "name" => $old->name ?: "Radar Chat",
    "personal_team" => (bool) ($old->personal_team ?? true),
  ]);
  $newId = (int) $team->id;
  if ($newId < 1) { echo "ERROR:bad-new-team"; exit(1); }
  foreach (["shared_environment_variables", "team_user", "servers", "personal_access_tokens", "projects", "environments", "application_deployment_queues"] as $table) {
    if (\Illuminate\Support\Facades\Schema::hasTable($table) && \Illuminate\Support\Facades\Schema::hasColumn($table, "team_id")) {
      \DB::table($table)->where("team_id", $badId)->update(["team_id" => $newId]);
    }
  }
  try { $old->delete(); } catch (\Throwable $e) { /* FK restante — ignorar */ }
}
if (!$team) {
  $team = \App\Models\Team::create(["name" => "RadarChat", "personal_team" => true]);
}
$tid = (int) $team->id;
if ($tid < 1) { echo "ERROR:bad-team tid=$tid"; exit(1); }
echo "team=$tid";
' 2>&1)" || true
  if ! echo "$out" | grep -qE 'team=[1-9][0-9]*'; then
    log "ERRO ao corrigir team: $out"
    exit 1
  fi
  tid="$(echo "$out" | grep -oE 'team=[0-9]+' | tail -1 | cut -d= -f2)"
  log "Team OK id=${tid}"
  local uid
  uid="$(psql_exec "SELECT id FROM users WHERE email IS NOT NULL AND email <> '' AND id > 0 ORDER BY id LIMIT 1;")"
  if [[ -n "${tid:-}" && -n "${uid:-}" ]]; then
    docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 -c "
      INSERT INTO team_user (team_id, user_id, role, created_at, updated_at)
      SELECT ${tid}, ${uid}, 'owner', NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM team_user WHERE team_id = ${tid} AND user_id = ${uid}
      );
    " 2>/dev/null || true
  fi
}

ensure_team() {
  fix_coolify_user_ids
  fix_coolify_team_ids
  log "Garantindo team vinculado ao usuário..."
  local out
  out="$(docker exec coolify php artisan tinker --execute='
$uid = (int) \DB::table("users")->whereNotNull("email")->orderBy("id")->value("id");
if ($uid < 1) { echo "ERROR:bad-ids uid=$uid"; exit(1); }
$user = \App\Models\User::find($uid);
if (!$user) { echo "ERROR:no-user"; exit(1); }
$team = \App\Models\Team::query()->where("id", ">", 0)->orderBy("id")->first();
if (!$team) {
  $team = \App\Models\Team::create(["name" => "RadarChat", "personal_team" => true]);
}
$tid = (int) $team->id;
if ($tid < 1) { echo "ERROR:bad-team tid=$tid"; exit(1); }
if (!$user->teams()->where("teams.id", $tid)->exists()) {
  $user->teams()->attach($tid, ["role" => "owner"]);
}
\DB::table("servers")->whereNull("team_id")->update(["team_id" => $tid]);
echo "team=$tid user=$uid email=" . $user->email;
' 2>&1)" || true
  if ! echo "$out" | grep -q 'email='; then
    log "ERRO ao garantir team: $out"
    log "Complete o cadastro em ${COOLIFY_URL} e rode o workflow de novo."
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
$uid = (int) \DB::table("users")->where("id", ">", 0)->whereNotNull("email")->orderBy("id")->value("id");
$tid = (int) \DB::table("teams")->where("id", ">", 0)->orderBy("id")->value("id");
$user = \App\Models\User::find($uid);
if (!$user || $uid < 1 || $tid < 1) { echo "ERROR:no-user-team"; exit(1); }
$user->tokens()->where("name", "radarchat-automation")->delete();
$plain = \Illuminate\Support\Str::random(64);
$pat = $user->tokens()->create([
  "name" => "radarchat-automation",
  "token" => hash("sha256", $plain),
  "abilities" => ["*"],
  "team_id" => $tid,
]);
echo "TOKEN|" . $pat->id . "|" . $plain;
' 2>&1)" || true
  API_TOKEN="$(echo "$out" | grep -oE 'TOKEN\|[0-9]+\|[^[:space:]]+' | tail -1 | cut -d'|' -f2- || true)"
  if [[ -z "$API_TOKEN" ]]; then
    log "ERRO ao criar token. Saída artisan:"
    echo "$out"
    exit 1
  fi
  log "Token API gerado (prefixo ${API_TOKEN%%|*}|…)"
}

load_legacy_env() {
  local env_file="${DEPLOY_PATH}/.env"
  [[ -f "$env_file" ]] || return 0
  set -a
  # shellcheck disable=SC1091
  source "$env_file" 2>/dev/null || true
  set +a
}

ensure_ghcr_login() {
  if [[ -z "${GHCR_PAT:-}" ]]; then
    return 0
  fi
  local user="${GHCR_USER:-benhuragmf}"
  log "Login GHCR no host (pull da imagem)..."
  echo "$GHCR_PAT" | sudo docker login ghcr.io -u "$user" --password-stdin >/dev/null 2>&1 || {
    log "AVISO: login GHCR falhou — imagem precisa ser pública ou credencial no Coolify"
  }
}

resolve_compose_template() {
  load_legacy_env
  if [[ "$COOLIFY_COMPOSE_MODE" == "ghcr" ]]; then
    echo "${DEPLOY_PATH}/docker-compose.coolify-ghcr.yml"
  else
    echo "${DEPLOY_PATH}/docker-compose.coolify.yml"
  fi
}

update_service_compose() {
  local compose_b64 payload_file
  compose_b64="$(base64 -w0 "$COMPOSE_FILE" 2>/dev/null || base64 "$COMPOSE_FILE" | tr -d '\n')"
  payload_file="$(mktemp)"
  jq -n --arg docker_compose_raw "$compose_b64" '{docker_compose_raw: $docker_compose_raw}' >"$payload_file"
  log "Atualizando Docker Compose no service ${SERVICE_UUID}..."
  api PATCH "/api/v1/services/${SERVICE_UUID}" -d @"$payload_file" >/dev/null
  rm -f "$payload_file"
}

detect_legacy_volumes() {
  local project
  project="$(docker volume ls --format '{{.Name}}' | grep -E '_radarchat-sessions$' | head -1 || true)"
  if [[ -z "$project" ]]; then
    project="$(docker volume ls --format '{{.Name}}' | grep -E 'radarchat-sessions|radarzap-sessions' | head -1 || true)"
  fi
  VOL_SESSIONS="${project:-}"

  # Mongo/Redis: escolhe o volume com mais organizations (dados reais), não o primeiro da lista
  local lib="${DEPLOY_PATH:-/opt/radarchat}/scripts/vps-mongo-volume-lib.sh"
  local pw db="${MONGO_DB_NAME:-discord-whatsapp}"
  pw="${MONGO_PASSWORD:-${SERVICE_PASSWORD_MONGODB:-}}"
  [[ -z "$pw" ]] && pw="$(grep -E '^MONGO_PASSWORD=' "${DEPLOY_PATH:-/opt/radarchat}/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r"'"'" || true)"

  if [[ -f "$lib" ]]; then
    # shellcheck source=/dev/null
    source "$lib"
    if [[ -z "${docker_cmd+x}" ]]; then
      if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then docker_cmd() { docker "$@"; }; else docker_cmd() { sudo docker "$@"; }; fi
    fi
    local picked
    picked="$(vps_mongo_pick_richest_volume "$pw" "$db")"
    VOL_MONGO="${picked%%|*}"
    log "Volume Mongo (richest orgs): ${VOL_MONGO:-novo} (${picked#*|} organizations)"
  else
    VOL_MONGO="$(docker volume ls --format '{{.Name}}' | grep -E 'mongodb-data' | head -1 || true)"
    log "Volumes legado (fallback): sessions=${VOL_SESSIONS:-novo} mongo=${VOL_MONGO:-novo}"
  fi

  VOL_REDIS="$(docker volume ls --format '{{.Name}}' | grep -E 'redis-data' | head -1 || true)"
  VOL_MEDIA="$(docker volume ls --format '{{.Name}}' | grep -E 'radarchat-media|radarzap-media' | head -1 || true)"
  VOL_LOGS="$(docker volume ls --format '{{.Name}}' | grep -E 'radarchat-logs|radarzap-logs' | head -1 || true)"
  log "Volumes legado: sessions=${VOL_SESSIONS:-novo} mongo=${VOL_MONGO:-novo} redis=${VOL_REDIS:-novo}"
}

prepare_compose_from_template() {
  local src="$1" out="$2"
  load_legacy_env
  local image="${RADARCHAT_IMAGE:-$RADARCHAT_IMAGE_DEFAULT}"
  local mongo_pw="${MONGO_PASSWORD:-${SERVICE_PASSWORD_MONGODB:-}}"
  [[ -z "$mongo_pw" ]] && mongo_pw="$(openssl rand -base64 24)"
  sed -e "s|\${RADARCHAT_IMAGE:?defina RADARCHAT_IMAGE}|${image}|g" \
      -e "s|\${SERVICE_PASSWORD_MONGODB}|${mongo_pw}|g" \
      "$src" >"$out"
  log "Compose com imagem ${image} e senha Mongo do .env legado"
}

servers_json() {
  api GET /api/v1/servers 2>/dev/null || echo '[]'
}

server_uuid_by_name_or_ip() {
  local name="$1" ip="$2"
  servers_json | jq -r --arg n "$name" --arg ip "$ip" '
    if type == "array" then .[] else .data[]? end
    | select(.name == $n or .ip == $ip or (.name | test($n; "i")))
    | .uuid' | head -1
}

write_ssh_key_file() {
  local content="$1" dest="$2"
  umask 077
  printf '%s\n' "$content" >"$dest"
  chmod 600 "$dest"
}

test_ssh_to_host() {
  local key_file="$1" user="$2" host="$3"
  ssh -i "$key_file" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=12 "${user}@${host}" 'echo ok' 2>/dev/null | grep -q ok
}

pubkey_from_private() {
  local key_file="$1"
  ssh-keygen -y -f "$key_file" 2>/dev/null
}

install_pubkey_for_user() {
  local user="$1" pubkey="$2"
  local home auth
  [[ -n "$pubkey" ]] || return 1
  home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6)"
  [[ -n "$home" && -d "$home" ]] || return 1
  auth="${home}/.ssh/authorized_keys"
  mkdir -p "${home}/.ssh"
  chmod 700 "${home}/.ssh"
  chown "$user:$user" "${home}/.ssh"
  if ! grep -qxF "$pubkey" "$auth" 2>/dev/null; then
    echo "$pubkey" >>"$auth"
    chmod 600 "$auth"
    chown "$user:$user" "$auth"
    log "Chave deploy instalada em ${user}@${auth}"
  fi
}

sync_private_key_to_coolify_fs() {
  local key_uuid="$1" key_content="$2"
  local id host_path container_path
  [[ -n "$key_content" ]] || return 0
  id="$(psql_exec "SELECT id FROM private_keys WHERE uuid = '${key_uuid}' LIMIT 1;")"
  [[ -n "${id:-}" && "$id" != "0" ]] || return 0
  host_path="/data/coolify/ssh/keys/${id}"
  mkdir -p /data/coolify/ssh/keys
  chmod 700 /data/coolify/ssh/keys
  if [[ ! -f "$host_path" ]]; then
    umask 077
    printf '%s\n' "$key_content" >"$host_path"
    chmod 600 "$host_path"
    log "Chave privada espelhada em ${host_path}"
  fi
  for container_path in \
    "/var/www/html/storage/app/ssh/keys/${id}" \
    "/data/coolify/ssh/keys/${id}"; do
    if docker exec coolify test -f "$container_path" 2>/dev/null; then
      return 0
    fi
  done
}

ensure_deploy_key_on_localhost() {
  local key_content="${COOLIFY_SSH_PRIVATE_KEY:-${DEPLOY_SSH_KEY:-}}"
  [[ -n "$key_content" ]] || return 0
  local key_file pubkey
  key_file="$(mktemp)"
  umask 077
  printf '%s\n' "$key_content" >"$key_file"
  chmod 600 "$key_file"
  pubkey="$(pubkey_from_private "$key_file")"
  rm -f "$key_file"
  [[ -n "$pubkey" ]] || return 0
  install_pubkey_for_user "$COOLIFY_SSH_USER" "$pubkey"
}

coolify_private_key_path() {
  local key_uuid="$1"
  local id name path container_path
  id="$(psql_exec "SELECT id FROM private_keys WHERE uuid = '${key_uuid}' LIMIT 1;")"
  [[ -n "${id:-}" && "$id" != "0" ]] || return 1
  name="$(psql_exec "SELECT name FROM private_keys WHERE id = ${id} LIMIT 1;")"
  for path in \
    "/data/coolify/ssh/keys/${id}" \
    "/data/coolify/ssh/keys/${name}"; do
    if [[ -f "$path" ]]; then
      echo "$path"
      return 0
    fi
  done
  for container_path in \
    "/var/www/html/storage/app/ssh/keys/${id}" \
    "/data/coolify/ssh/keys/${id}"; do
    if docker exec coolify test -f "$container_path" 2>/dev/null; then
      echo "$container_path"
      return 0
    fi
  done
  return 1
}

test_ssh_from_coolify_container() {
  local key_path="$1" user="$2" host="$3"
  docker exec coolify ssh -i "$key_path" \
    -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=10 "${user}@${host}" 'echo ok' 2>/dev/null | grep -q ok
}

pick_coolify_ssh_target() {
  local key_uuid="$1" key_path host key_file key_content
  key_content="${COOLIFY_SSH_PRIVATE_KEY:-${DEPLOY_SSH_KEY:-}}"
  [[ -n "$key_content" ]] || return 1
  key_file="$(mktemp)"
  umask 077
  printf '%s\n' "$key_content" >"$key_file"
  chmod 600 "$key_file"
  for host in 172.17.0.1 127.0.0.1 "${RADARCHAT_SERVER_IP}" "${RADARCHAT_LOCAL_HOST}"; do
    [[ -n "$host" ]] || continue
    if test_ssh_to_host "$key_file" "$COOLIFY_SSH_USER" "$host"; then
      log "SSH host → ${COOLIFY_SSH_USER}@${host} OK"
      rm -f "$key_file"
      echo "$host"
      return 0
    fi
  done
  key_path="$(coolify_private_key_path "$key_uuid")" || { rm -f "$key_file"; return 1; }
  for host in 172.17.0.1 127.0.0.1 "${RADARCHAT_SERVER_IP}"; do
    if test_ssh_from_coolify_container "$key_path" "$COOLIFY_SSH_USER" "$host"; then
      log "SSH container Coolify → ${COOLIFY_SSH_USER}@${host} OK (key=${key_path})"
      rm -f "$key_file"
      echo "$host"
      return 0
    fi
  done
  rm -f "$key_file"
  return 1
}

mark_server_reachable_db() {
  local server_uuid="$1" ssh_host="$2" key_uuid="$3"
  fix_server_private_key_db "$server_uuid" "$key_uuid" "$COOLIFY_SSH_USER"
  docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 -c "
    UPDATE servers SET
      ip = '${ssh_host}',
      \"user\" = '${COOLIFY_SSH_USER}',
      is_localhost = true,
      updated_at = NOW()
    WHERE uuid = '${server_uuid}';
  " >/dev/null 2>&1 || true
  docker exec coolify php artisan tinker --execute="
\$s = \\App\\Models\\Server::where('uuid', '${server_uuid}')->first();
if (\$s) {
  \$s->ip = '${ssh_host}';
  \$s->user = '${COOLIFY_SSH_USER}';
  \$s->is_localhost = true;
  try { \$s->is_reachable = true; } catch (\\Throwable \$e) {}
  \$s->save();
  echo 'reachable';
}
" >/dev/null 2>&1 || true
}

ensure_coolify_can_ssh_localhost() {
  local server_uuid="$1" key_uuid="$2" ssh_host
  local key_content="${COOLIFY_SSH_PRIVATE_KEY:-${DEPLOY_SSH_KEY:-}}"
  ensure_deploy_key_on_localhost
  sync_private_key_to_coolify_fs "$key_uuid" "$key_content"
  ssh_host="$(pick_coolify_ssh_target "$key_uuid")" || {
    log "AVISO: Coolify ainda não alcança o host via SSH — deploy API pode falhar"
    return 1
  }
  RADARCHAT_LOCAL_HOST="$ssh_host"
  mark_server_reachable_db "$server_uuid" "$ssh_host" "$key_uuid"
  validate_server "$server_uuid" "Radar Chat"
  return 0
}

restart_coolify_workers() {
  log "Reiniciando workers Coolify (fila de deploy)..."
  for c in coolify-sentinel coolify; do
    docker restart "$c" >/dev/null 2>&1 || true
  done
  sleep 8
}

ensure_private_key_in_coolify() {
  local key_content="$1" key_name="${2:-radarchat-deploy}"
  local keys uuid
  for path in /api/v1/security/keys /api/v1/security/private-keys; do
    keys="$(curl -sS -H "Authorization: Bearer ${API_TOKEN}" -H "Accept: application/json" \
      "${COOLIFY_URL}${path}" 2>/dev/null || true)"
    uuid="$(echo "$keys" | jq -r --arg n "$key_name" '
      if type == "array" then .[] else .data[]? end
      | select(.name == $n) | .uuid' | head -1)"
    if [[ -n "$uuid" && "$uuid" != "null" ]]; then
      echo "$uuid"
      return 0
    fi
    if [[ -z "$uuid" || "$uuid" == "null" ]]; then
      uuid="$(echo "$keys" | jq -r 'if type == "array" then .[0].uuid else .data[0].uuid // empty end')"
      if [[ -n "$uuid" && "$uuid" != "null" ]]; then
        echo "$uuid"
        return 0
      fi
    fi
  done

  if [[ -z "$key_content" ]]; then
    log "ERRO: nenhuma chave SSH no Coolify e COOLIFY_SSH_PRIVATE_KEY ausente"
    return 1
  fi

  local body payload_file
  payload_file="$(mktemp)"
  jq -n --arg name "$key_name" --arg key "$key_content" '{name: $name, private_key: $key}' >"$payload_file"
  for path in /api/v1/security/keys /api/v1/security/private-keys; do
    if resp="$(curl -sS -o /tmp/coolify-key.json -w "%{http_code}" -X POST \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Accept: application/json" \
      -H "Content-Type: application/json" \
      "${COOLIFY_URL}${path}" -d @"$payload_file" 2>/dev/null)"; then
      if [[ "$resp" -ge 200 && "$resp" -lt 300 ]]; then
        uuid="$(jq -r '.uuid // empty' /tmp/coolify-key.json)"
        rm -f "$payload_file" /tmp/coolify-key.json
        if [[ -n "$uuid" ]]; then
          log "Chave SSH cadastrada no Coolify: $key_name ($uuid)"
          echo "$uuid"
          return 0
        fi
      fi
    fi
  done
  rm -f "$payload_file" /tmp/coolify-key.json
  log "ERRO: não foi possível cadastrar chave SSH no Coolify"
  return 1
}

patch_server_meta() {
  local uuid="$1" name="$2" description="$3"
  local body
  body="$(jq -n --arg name "$name" --arg description "$description" '{name: $name, description: $description}')"
  api PATCH "/api/v1/servers/${uuid}" -d "$body" >/dev/null 2>&1 || true
}

patch_server_connection() {
  local uuid="$1" key_uuid="$2" ip="$3" user="$4" localhost="${5:-false}"
  local body payload_file
  payload_file="$(mktemp)"
  jq -n \
    --arg user "$user" \
    --arg ip "$ip" \
    --arg key_uuid "$key_uuid" \
    --argjson localhost "$localhost" \
    '{
      user: $user,
      ip: $ip,
      port: 22,
      private_key_uuid: $key_uuid,
      is_localhost: $localhost
    }' >"$payload_file"
  if api PATCH "/api/v1/servers/${uuid}" -d @"$payload_file" >/dev/null 2>&1; then
    rm -f "$payload_file"
    return 0
  fi
  rm -f "$payload_file"
  log "AVISO: PATCH conexão falhou — corrigindo private_key_id via PostgreSQL"
  return 1
}

fix_server_private_key_db() {
  local server_uuid="$1" key_uuid="$2" user="$3"
  [[ -n "$server_uuid" && -n "$key_uuid" ]] || return 0
  docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 -c "
    UPDATE servers SET
      private_key_id = pk.id,
      \"user\" = '${user}',
      updated_at = NOW()
    FROM private_keys pk
    WHERE servers.uuid = '${server_uuid}'
      AND pk.uuid = '${key_uuid}'
      AND (servers.private_key_id IS NULL OR servers.private_key_id = 0 OR servers.\"user\" IS DISTINCT FROM '${user}');
  " >/dev/null 2>&1 || true
  log "private_key_id / user sincronizados no DB para ${server_uuid}"
}

validate_server() {
  local uuid="$1" label="$2"
  log "Validando servidor ${label} (${uuid})..."
  api GET "/api/v1/servers/${uuid}/validate" >/dev/null 2>&1 || \
    api POST "/api/v1/servers/${uuid}/validate" -d '{}' >/dev/null 2>&1 || true
  local i status
  for i in $(seq 1 12); do
    status="$(api GET "/api/v1/servers/${uuid}" 2>/dev/null | jq -r '.status // .server_status // empty' || true)"
    if [[ "$status" == "reachable" || "$status" == "validated" ]]; then
      log "Servidor ${label}: ${status}"
      return 0
    fi
    sleep 5
  done
  log "AVISO: validação de ${label} ainda em andamento (status=${status:-desconhecido})"
  return 0
}

ensure_remote_server() {
  local name="$1" ip="$2" description="$3" key_content="$4"
  local uuid key_uuid key_file tmp_key
  uuid="$(server_uuid_by_name_or_ip "$name" "$ip")"
  if [[ -n "$uuid" && "$uuid" != "null" ]]; then
    log "Servidor ${name} já existe: ${uuid}"
    patch_server_meta "$uuid" "$name" "$description"
    key_uuid="$(ensure_private_key_in_coolify "$key_content" "radarchat-deploy")" || return 1
    patch_server_connection "$uuid" "$key_uuid" "$ip" "$COOLIFY_SSH_USER" false || true
    fix_server_private_key_db "$uuid" "$key_uuid" "$COOLIFY_SSH_USER"
    validate_server "$uuid" "$name"
    echo "$uuid"
    return 0
  fi

  if [[ -z "$key_content" ]]; then
    log "ERRO: chave SSH ausente para cadastrar ${name} (${ip})"
    return 1
  fi
  tmp_key="$(mktemp)"
  write_ssh_key_file "$key_content" "$tmp_key"
  if ! test_ssh_to_host "$tmp_key" "$COOLIFY_SSH_USER" "$ip"; then
    rm -f "$tmp_key"
    log "ERRO: SSH ${COOLIFY_SSH_USER}@${ip} falhou — adicione a chave pública no VPS Gamer (radargamer.com.br)"
    log "  Painel Platon → Gamer → chave SSH, ou: ssh-copy-id -i sua_chave.pub ubuntu@${ip}"
    return 1
  fi
  rm -f "$tmp_key"

  key_uuid="$(ensure_private_key_in_coolify "$key_content" "radarchat-deploy")" || return 1

  local body payload_file resp
  payload_file="$(mktemp)"
  jq -n \
    --arg name "$name" \
    --arg description "$description" \
    --arg ip "$ip" \
    --arg user "$COOLIFY_SSH_USER" \
    --arg key_uuid "$key_uuid" \
    '{
      name: $name,
      description: $description,
      ip: $ip,
      port: 22,
      user: $user,
      private_key_uuid: $key_uuid,
      instant_validate: true
    }' >"$payload_file"
  log "Criando servidor remoto ${name} (${ip})..."
  resp="$(api POST /api/v1/servers -d @"$payload_file")" || {
    rm -f "$payload_file"
    return 1
  }
  rm -f "$payload_file"
  uuid="$(echo "$resp" | jq -r '.uuid // empty')"
  if [[ -z "$uuid" || "$uuid" == "null" ]]; then
    log "ERRO ao criar servidor ${name}: $resp"
    return 1
  fi
  validate_server "$uuid" "$name"
  echo "$uuid"
}

ensure_local_radarchat_server() {
  local uuid key_uuid
  uuid="$(servers_json | jq -r --arg ip "$RADARCHAT_SERVER_IP" '
    if type == "array" then .[] else .data[]? end
    | select(.ip == $ip or .name == "localhost" or .name == "RadarChat" or .name == "Radar Chat" or .is_localhost == true)
    | .uuid' | head -1)"
  if [[ -z "$uuid" || "$uuid" == "null" ]]; then
    uuid="$(servers_json | jq -r 'if type == "array" then .[0].uuid else .data[0].uuid // empty end')"
  fi
  if [[ -z "$uuid" || "$uuid" == "null" ]]; then
    log "ERRO: servidor local RadarChat não encontrado no Coolify"
    return 1
  fi
  key_uuid="$(ensure_private_key_in_coolify "${COOLIFY_SSH_PRIVATE_KEY:-${DEPLOY_SSH_KEY:-}}" "radarchat-deploy")" || return 1
  log "Corrigindo RadarChat local: user=${COOLIFY_SSH_USER} ip=${RADARCHAT_LOCAL_HOST} key=${key_uuid}"
  patch_server_connection "$uuid" "$key_uuid" "$RADARCHAT_LOCAL_HOST" "$COOLIFY_SSH_USER" true || true
  fix_server_private_key_db "$uuid" "$key_uuid" "$COOLIFY_SSH_USER"
  ensure_coolify_can_ssh_localhost "$uuid" "$key_uuid" || true
  patch_server_meta "$uuid" "RadarChat" "RadarChat + Coolify — ${RADARCHAT_SERVER_IP}"
  validate_server "$uuid" "RadarChat"
  log "Servidor local RadarChat: ${uuid}"
  echo "$uuid"
}

fix_servers_team_visibility() {
  local tid
  tid="$(psql_exec 'SELECT id FROM teams WHERE id > 0 ORDER BY id LIMIT 1;')"
  if [[ -z "${tid:-}" ]]; then
    return 0
  fi
  docker exec coolify-db psql -U coolify -d coolify -v ON_ERROR_STOP=1 -c \
    "UPDATE servers SET team_id = ${tid} WHERE team_id IS NULL OR team_id = 0;" >/dev/null 2>&1 || true
  log "servers.team_id sincronizado com team ${tid}"
}

ensure_coolify_servers() {
  log "Cadastrando servidores Coolify (RadarChat ${RADARCHAT_SERVER_IP} + RadarGamer ${RADARGAMER_SERVER_IP})..."
  fix_servers_team_visibility
  local local_uuid gamer_uuid
  local_uuid="$(ensure_local_radarchat_server)" || return 1
  if [[ -n "${RADARGAMER_SSH_PRIVATE_KEY:-}" ]]; then
    gamer_uuid="$(ensure_remote_server "RadarGamer" "$RADARGAMER_SERVER_IP" \
      "radargamer.com.br — ${RADARGAMER_SERVER_IP}" "$RADARGAMER_SSH_PRIVATE_KEY")" || {
      log "AVISO: RadarGamer não cadastrado — configure RADARGAMER_SSH_KEY no GitHub e autorize no VPS .179"
    }
  else
    log "AVISO: RADARGAMER_SSH_PRIVATE_KEY ausente — apenas servidor local Radar Chat"
  fi
  fix_servers_team_visibility
  log "Servidores no Coolify:"
  servers_json | jq -r 'if type == "array" then .[] else .data[]? end | "- \(.name) (\(.ip // "local")) status=\(.status // .server_status // "?") uuid=\(.uuid)"' 2>/dev/null || true
  [[ -n "${local_uuid:-}" ]] && SERVER_UUID="$local_uuid" || true
  [[ -n "${gamer_uuid:-}" ]] && RADARGAMER_SERVER_UUID="$gamer_uuid" || true
  return 0
}

build_compose_with_external_volumes() {
  local src resolved
  src="$(resolve_compose_template)"
  resolved="/tmp/radarchat-coolify-resolved.yml"
  prepare_compose_from_template "$src" "$resolved"
  local out="/tmp/radarchat-coolify-compose.yml"
  if [[ -z "${VOL_SESSIONS:-}" ]]; then
    cp "$resolved" "$out"
    COMPOSE_FILE="$out"
    return 0
  fi
  # Substitui bloco volumes por externos (reutiliza dados do deploy GHCR)
  sed '/^volumes:/,$d' "$resolved" >"$out"
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
    echo "  radarchat-sessions:"
    echo "    external: true"
    echo "    name: ${VOL_SESSIONS}"
    if [[ -n "${VOL_MEDIA:-}" ]]; then
      echo "  radarchat-media:"
      echo "    external: true"
      echo "    name: ${VOL_MEDIA}"
    else
      echo "  radarchat-media:"
    fi
    if [[ -n "${VOL_LOGS:-}" ]]; then
      echo "  radarchat-logs:"
      echo "    external: true"
      echo "    name: ${VOL_LOGS}"
    else
      echo "  radarchat-logs:"
    fi
  } >>"$out"
  COMPOSE_FILE="$out"
}

ensure_project_and_server() {
  local projects
  projects="$(api GET /api/v1/projects)"
  PROJECT_UUID="$(echo "$projects" | jq -r 'if type=="array" then .[] else .data[]? end | select(.name=="RadarChat") | .uuid' | head -1)"
  if [[ -z "$PROJECT_UUID" || "$PROJECT_UUID" == "null" ]]; then
    PROJECT_UUID="$(echo "$projects" | jq -r 'if type=="array" then .[] else .data[]? end | select(.name=="Radar Chat") | .uuid' | head -1)"
    if [[ -n "$PROJECT_UUID" && "$PROJECT_UUID" != "null" ]]; then
      log "Renomeando projeto legado Radar Chat → RadarChat..."
      api PATCH "/api/v1/projects/${PROJECT_UUID}" -d '{"name":"RadarChat","description":"RadarChat v2 produção"}' >/dev/null 2>&1 || true
    fi
  fi
  if [[ -z "$PROJECT_UUID" || "$PROJECT_UUID" == "null" ]]; then
    log "Criando projeto RadarChat..."
    PROJECT_UUID="$(api POST /api/v1/projects -d '{"name":"RadarChat","description":"RadarChat v2 produção"}' | jq -r '.uuid')"
  fi
  if [[ -z "${SERVER_UUID:-}" ]]; then
    SERVER_UUID="$(server_uuid_by_name_or_ip "RadarChat" "$RADARCHAT_SERVER_IP")"
  fi
  if [[ -z "$SERVER_UUID" || "$SERVER_UUID" == "null" ]]; then
    SERVER_UUID="$(server_uuid_by_name_or_ip "Radar Chat" "$RADARCHAT_SERVER_IP")"
  fi
  if [[ -z "$SERVER_UUID" || "$SERVER_UUID" == "null" ]]; then
    SERVER_UUID="$(servers_json | jq -r 'if type=="array" then .[0].uuid else .data[0].uuid // empty end')"
  fi
  if [[ -z "$SERVER_UUID" || "$SERVER_UUID" == "null" ]]; then
    log "ERRO: nenhum servidor no Coolify"
    exit 1
  fi
  local server_json
  server_json="$(api GET "/api/v1/servers/${SERVER_UUID}")"
  DESTINATION_UUID="$(echo "$server_json" | jq -r '.destinations[0].uuid // .destination.uuid // empty' 2>/dev/null || true)"
  log "Project=$PROJECT_UUID Server=$SERVER_UUID Destination=${DESTINATION_UUID:-auto}"
}

set_service_domain() {
  [[ -n "${SERVICE_UUID:-}" ]] || return 0
  log "Configurando domínio https://${PUBLIC_HOST} no serviço app..."
  local body
  body="$(jq -n \
    --arg url "https://${PUBLIC_HOST}" \
    '{urls: [{name: "app", url: $url}], force_domain_override: true}')"
  api PATCH "/api/v1/services/${SERVICE_UUID}" -d "$body" >/dev/null || {
    log "AVISO: domínio não aplicado via API — configure manualmente em Domains → app"
  }
}

ensure_service() {
  local canonical="${SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
  local canonical_dir="/data/coolify/services/${canonical}"
  local existing dup_count

  SERVICE_UUID="$canonical"

  dup_count="$(api GET /api/v1/services | jq -r '[if type=="array" then .[] else .data[]? end | select(.name=="RadarChat" or .name=="radarchat" or .name=="Radar Chat" or .uuid=="'"$canonical"'")] | length')"
  if [[ "${dup_count:-0}" -gt 1 ]]; then
    log "AVISO: ${dup_count} services Radar* no Coolify — dedupe via sync-panel antes de continuar"
    sudo -E bash "${DEPLOY_PATH}/scripts/vps-coolify-sync-panel.sh" 2>/dev/null || true
  fi

  existing="$(api GET /api/v1/services | jq -r 'if type=="array" then .[] else .data[]? end | select(.uuid=="'"$canonical"'") | .uuid' | head -1)"
  if [[ -z "$existing" || "$existing" == "null" ]]; then
    existing="$(api GET /api/v1/services | jq -r 'if type=="array" then .[] else .data[]? end | select(.name=="RadarChat") | .uuid' | head -1)"
  fi

  if [[ -n "$existing" && "$existing" != "null" ]]; then
    SERVICE_UUID="$existing"
    log "Service RadarChat já existe: $SERVICE_UUID"
    update_service_compose
    set_service_domain
    return 0
  fi

  if [[ -f "${canonical_dir}/docker-compose.yaml" ]]; then
    log "ERRO: stack canônica em ${canonical_dir} sem registro no painel."
    log "Não criar duplicata — rode: sudo -E bash ${DEPLOY_PATH}/scripts/vps-coolify-reconcile.sh"
    exit 1
  fi

  local compose_b64 payload_file resp
  compose_b64="$(base64 -w0 "$COMPOSE_FILE" 2>/dev/null || base64 "$COMPOSE_FILE" | tr -d '\n')"
  payload_file="$(mktemp)"
  jq -n \
    --arg name "RadarChat" \
    --arg description "RadarChat monolito + Mongo + Redis" \
    --arg project_uuid "$PROJECT_UUID" \
    --arg server_uuid "$SERVER_UUID" \
    --arg environment_name "production" \
    --arg docker_compose_raw "$compose_b64" \
    --arg destination_uuid "${DESTINATION_UUID:-}" \
    '{
      name: $name,
      description: $description,
      project_uuid: $project_uuid,
      server_uuid: $server_uuid,
      environment_name: $environment_name,
      docker_compose_raw: $docker_compose_raw,
      instant_deploy: false
    }
    + (if ($destination_uuid | length) > 0 then {destination_uuid: $destination_uuid} else {} end)' \
    >"$payload_file"
  log "Criando service Docker Compose..."
  resp="$(api POST /api/v1/services -d @"$payload_file")" || {
    rm -f "$payload_file"
    exit 1
  }
  rm -f "$payload_file"
  SERVICE_UUID="$(echo "$resp" | jq -r '.uuid // empty')"
  if [[ -z "$SERVICE_UUID" || "$SERVICE_UUID" == "null" ]]; then
    log "ERRO ao criar service. Resposta: $resp"
    exit 1
  fi
  log "Service criado: $SERVICE_UUID"
  set_service_domain
}

sync_env_from_legacy() {
  local env_file="${DEPLOY_PATH}/.env"
  if [[ ! -f "$env_file" ]]; then
    log "AVISO: ${env_file} não encontrado — configure env manualmente no Coolify"
    return 0
  fi
  log "Sincronizando variáveis do .env legado..."
  load_legacy_env

  local mongo_pw="${MONGO_PASSWORD:-${SERVICE_PASSWORD_MONGODB:-}}"
  [[ -z "$mongo_pw" ]] && mongo_pw="$(openssl rand -base64 24)"
  local radar_image="${RADARCHAT_IMAGE:-$RADARCHAT_IMAGE_DEFAULT}"

  local payload='[]'
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    [[ "$line" != *"="* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(echo "$key" | xargs)"
    case "$key" in
      MONGODB_URL|MONGO_PASSWORD|FRONTEND_URL|CORS_ORIGIN) continue ;;
    esac
    payload="$(echo "$payload" | jq --arg k "$key" --arg v "$val" '. + [{"key": $k, "value": $v, "is_preview": false, "is_build_time": false, "is_literal": true}]')"
  done <"$env_file"

  payload="$(echo "$payload" | jq \
    --arg mongo "$mongo_pw" \
    --arg image "$radar_image" \
    --arg service_url "https://${PUBLIC_HOST}" \
    --arg fqdn "${PUBLIC_HOST}" \
    '. + [
      {"key":"SERVICE_PASSWORD_MONGODB","value":$mongo,"is_preview":false,"is_build_time":false,"is_literal":true},
      {"key":"RADARCHAT_IMAGE","value":$image,"is_preview":false,"is_build_time":false,"is_literal":true},
      {"key":"SERVICE_URL_APP","value":$service_url,"is_preview":false,"is_build_time":false,"is_literal":true},
      {"key":"SERVICE_FQDN_APP","value":$fqdn,"is_preview":false,"is_build_time":false,"is_literal":true}
    ]')"

  if api PATCH "/api/v1/services/${SERVICE_UUID}/envs/bulk" -d "{\"data\":${payload}}" >/dev/null 2>&1; then
    log "Env sincronizado (bulk PATCH OK)"
    return 0
  fi

  log "Bulk PATCH falhou — enviando variáveis críticas individualmente..."
  echo "$payload" | jq -c '.[]' | while read -r item; do
    api POST "/api/v1/services/${SERVICE_UUID}/envs" -d "$item" >/dev/null 2>&1 || \
    api PATCH "/api/v1/services/${SERVICE_UUID}/envs" -d "$item" >/dev/null 2>&1 || true
  done
}

deploy_service() {
  log "Disparando deploy Coolify (${SERVICE_UUID})..."
  api POST "/api/v1/deploy?uuid=${SERVICE_UUID}" -d '{}' >/dev/null 2>&1 || true
  api POST "/api/v1/services/${SERVICE_UUID}/start" -d '{}' >/dev/null 2>&1 || true
  api POST "/api/v1/services/${SERVICE_UUID}/restart" -d '{}' >/dev/null 2>&1 || true
}

patch_legacy_env_urls() {
  local env_file="${DEPLOY_PATH}/.env"
  local url="https://${PUBLIC_HOST}"
  [[ -f "$env_file" ]] || return 0
  log "Atualizando URLs públicas no ${env_file} → ${url}"
  for key in FRONTEND_URL CORS_ORIGIN SERVICE_URL_APP; do
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
      sudo sed -i "s|^${key}=.*|${key}=${url}|" "$env_file" 2>/dev/null || true
    else
      echo "${key}=${url}" | sudo tee -a "$env_file" >/dev/null
    fi
  done
  if grep -q "^SERVICE_FQDN_APP=" "$env_file" 2>/dev/null; then
    sudo sed -i "s|^SERVICE_FQDN_APP=.*|SERVICE_FQDN_APP=${PUBLIC_HOST}|" "$env_file" 2>/dev/null || true
  else
    echo "SERVICE_FQDN_APP=${PUBLIC_HOST}" | sudo tee -a "$env_file" >/dev/null
  fi
}

write_service_env_file() {
  local out="$1"
  patch_legacy_env_urls
  load_legacy_env
  local mongo_pw="${MONGO_PASSWORD:-${SERVICE_PASSWORD_MONGODB:-}}"
  [[ -z "$mongo_pw" ]] && mongo_pw="$(openssl rand -base64 24)"
  local radar_image="${RADARCHAT_IMAGE:-$RADARCHAT_IMAGE_DEFAULT}"
  {
    echo "RADARCHAT_IMAGE=${radar_image}"
    echo "SERVICE_PASSWORD_MONGODB=${mongo_pw}"
    echo "MONGO_PASSWORD=${mongo_pw}"
    echo "MONGODB_URL=mongodb://admin:${mongo_pw}@mongodb:27017/discord-whatsapp?authSource=admin"
    echo "REDIS_URL=redis://redis:6379"
    echo "SERVICE_URL_APP=https://${PUBLIC_HOST}"
    echo "SERVICE_FQDN_APP=${PUBLIC_HOST}"
    echo "FRONTEND_URL=https://${PUBLIC_HOST}"
    echo "CORS_ORIGIN=https://${PUBLIC_HOST}"
    echo "COOKIE_SECURE=true"
    echo "NODE_ENV=production"
  } >"$out"
  local env_file="${DEPLOY_PATH}/.env"
  if [[ -f "$env_file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      [[ "$line" != *"="* ]] && continue
      local key="${line%%=*}"
      key="$(echo "$key" | xargs)"
      case "$key" in
        MONGODB_URL|MONGO_PASSWORD|FRONTEND_URL|CORS_ORIGIN|REDIS_URL|NODE_ENV|COOKIE_SECURE|RADARCHAT_IMAGE|SERVICE_PASSWORD_MONGODB|SERVICE_URL_APP|SERVICE_FQDN_APP) continue ;;
      esac
      echo "$line" >>"$out"
    done <"$env_file"
  fi
}

add_host_port_to_compose() {
  local file="$1"
  python3 - "$file" <<'PY'
import sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    lines = f.readlines()
if any("3001:3001" in line for line in lines):
    sys.exit(0)
out = []
i = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    if line.strip() == "expose:":
        j = i + 1
        while j < len(lines) and lines[j].startswith("      "):
            out.append(lines[j])
            j += 1
        out.append("    ports:\n")
        out.append("      - '3001:3001'\n")
        i = j
        continue
    i += 1
with open(path, "w", encoding="utf-8") as f:
    f.writelines(out)
PY
}

deploy_service_direct() {
  local dir="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${SERVICE_UUID}}"
  local env_tmp merged
  [[ -n "${SERVICE_UUID:-}" && -f "${COMPOSE_FILE:-}" ]] || return 1
  log "Deploy direto no host (fallback) → ${dir}"
  sudo mkdir -p "$dir"
  sudo chmod 755 /data/coolify/services 2>/dev/null || true
  sudo chmod 755 "$dir" 2>/dev/null || true
  merged="$(mktemp)"
  cp "$COMPOSE_FILE" "$merged"
  if ! grep -qE '3001:3001' "$merged"; then
    log "Adicionando bind :3001 no serviço app..."
    add_host_port_to_compose "$merged"
  fi
  env_tmp="$(mktemp)"
  write_service_env_file "$env_tmp"
  sudo cp "$merged" "${dir}/docker-compose.yaml"
  sudo cp "$env_tmp" "${dir}/.env"
  rm -f "$merged" "$env_tmp"
  if ! (cd "$dir" && sudo docker compose --env-file .env -f docker-compose.yaml config >/dev/null 2>&1); then
    log "ERRO: compose inválido em ${dir}"
    (cd "$dir" && sudo docker compose --env-file .env -f docker-compose.yaml config 2>&1 | tail -8 >&2) || true
    return 1
  fi
  (cd "$dir" && sudo docker compose --env-file .env \
    -f docker-compose.yaml -p "${SERVICE_UUID}" pull app) 2>/dev/null || true
  if sudo docker ps --format '{{.Names}}' 2>/dev/null | grep -qF "${SERVICE_UUID}-mongodb-1"; then
    log "Recriando somente serviço app (mongo/redis preservados)..."
    (cd "$dir" && sudo docker compose --env-file .env \
      -f docker-compose.yaml -p "${SERVICE_UUID}" up -d --no-deps --force-recreate app) || return 1
  else
    log "Primeiro deploy — subindo stack completa..."
    (cd "$dir" && sudo docker compose --env-file .env \
      -f docker-compose.yaml -p "${SERVICE_UUID}" up -d --force-recreate --remove-orphans) || return 1
  fi
  docker exec coolify php artisan tinker --execute="
\$s = \\App\\Models\\Service::where('uuid', '${SERVICE_UUID}')->first();
if (\$s) { \$s->status = 'running'; \$s->save(); echo 'running'; }
" >/dev/null 2>&1 || true
  log "Stack iniciada via compose direto (project=${SERVICE_UUID}, :3001 publicado)"
  COOLIFY_DEPLOY_VIA=direct
  return 0
}

remove_legacy_traefik_route() {
  local proxy cfg
  proxy="$(sudo docker ps --format '{{.Names}}' | grep -E 'coolify-proxy|traefik' | head -1 || true)"
  [[ -n "$proxy" ]] || return 0
  cfg="radarchat-legacy-${PUBLIC_HOST//[^a-zA-Z0-9]/-}.yaml"
  for dir in /traefik/dynamic /etc/traefik/dynamic; do
    sudo docker exec "$proxy" rm -f "${dir}/${cfg}" 2>/dev/null || true
  done
  log "Rota Traefik legado removida (Coolify assume o domínio)"
}

coolify_stack_healthy() {
  local sid="${SERVICE_UUID:-}"
  [[ -n "$sid" ]] || return 1
  if sudo docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -F "$sid" | grep -iE 'app|web' | grep -qiE 'up|healthy'; then
    return 0
  fi
  # Fallback: prefixo curto do service UUID (Coolify nomeia containers assim)
  local short="${sid:0:12}"
  if sudo docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -F "$short" | grep -iE 'app|web' | grep -qiE 'up|healthy'; then
    return 0
  fi
  return 1
}

wait_coolify_stack_up() {
  local max="${1:-45}"
  local i
  for i in $(seq 1 "$max"); do
    if coolify_stack_healthy; then
      log "Stack Coolify Up (tentativa $i/$max)"
      return 0
    fi
    log "Aguardando containers Coolify ($i/$max)..."
    sleep 10
  done
  return 1
}

stop_legacy_stack() {
  if [[ ! -f "${DEPLOY_PATH}/docker-compose.deploy.yml" ]]; then
    return 0
  fi
  log "Parando stack legado GHCR (volumes preservados)..."
  load_legacy_env
  export RADARCHAT_IMAGE="${RADARCHAT_IMAGE:-$RADARCHAT_IMAGE_DEFAULT}"
  export MONGO_PASSWORD="${MONGO_PASSWORD:-${SERVICE_PASSWORD_MONGODB:-}}"
  if [[ -f "${DEPLOY_PATH}/.env" ]]; then
    (cd "$DEPLOY_PATH" && sudo -E docker compose -f docker-compose.deploy.yml --env-file .env down --remove-orphans) || true
  else
    (cd "$DEPLOY_PATH" && sudo -E docker compose -f docker-compose.deploy.yml down --remove-orphans) || true
  fi
  sudo docker ps -q --filter 'name=^radarchat-' 2>/dev/null | xargs -r sudo docker stop 2>/dev/null || true
}

restore_legacy_stack() {
  local env_file="${DEPLOY_PATH}/.env"
  [[ -f "$env_file" ]] || return 0
  load_legacy_env
  [[ -n "${RADARCHAT_IMAGE:-}" ]] || return 0
  log "Restaurando stack legado GHCR (fallback)..."
  (cd "$DEPLOY_PATH" && export USE_SUDO_DOCKER=1 ENV_FILE=.env && bash scripts/deploy-remote.sh "$RADARCHAT_IMAGE") || true
}

wait_coolify_app_health() {
  local i
  for i in $(seq 1 24); do
    if curl -sf -o /dev/null --max-time 8 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
      return 0
    fi
    if curl -sf -o /dev/null --max-time 10 "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null; then
      return 0
    fi
    if sudo docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -iE 'app.*healthy|radarchat-app' | grep -qi healthy; then
      return 0
    fi
    sleep 10
  done
  return 1
}

# --- main ---
wait_coolify
ensure_root_user
enable_api_and_token

# Validar API
for i in $(seq 1 12); do
  raw="$(curl -sS -H "Authorization: Bearer ${API_TOKEN}" -H "Accept: application/json" "${COOLIFY_URL}/api/v1/version" 2>/dev/null || true)"
  VER="$(echo "$raw" | jq -r '.version // empty' 2>/dev/null || true)"
  if [[ -z "$VER" && "$raw" =~ ^[0-9]+\.[0-9]+ ]]; then
    VER="$(echo "$raw" | tr -d '[:space:]"')"
  fi
  if [[ -n "$VER" ]]; then
    log "Coolify API OK — versão ${VER}"
    break
  fi
  log "Aguardando API (tentativa $i/12)..."
  [[ "$i" -eq 12 ]] && {
    log "ERRO: API Coolify indisponível. Última resposta: $raw"
    docker logs coolify --tail 40 2>/dev/null || true
    exit 1
  }
  sleep 5
done

ensure_coolify_servers

if [[ "$COOLIFY_SERVERS_ONLY" == "1" ]]; then
  log "COOLIFY_SERVERS_ONLY=1 — servidores configurados. Painel: ${COOLIFY_URL}"
  exit 0
fi

detect_legacy_volumes
build_compose_with_external_volumes
ensure_ghcr_login
ensure_project_and_server
ensure_service
sync_env_from_legacy

if [[ "${COOLIFY_REPUBLISH_DIRECT:-0}" == "1" ]]; then
  log "COOLIFY_REPUBLISH_DIRECT=1 — republicando stack com :3001 no host..."
  deploy_service_direct || exit 1
  wait_coolify_app_health || exit 1
  sudo bash "${DEPLOY_PATH}/scripts/vps-coolify-traefik-route-legacy.sh" || true
  log "Republish OK"
  exit 0
fi

COOLIFY_DEPLOY_VIA="${COOLIFY_DEPLOY_VIA:-api}"

if [[ "$MIGRATE_LEGACY" == "1" ]]; then
  log "Migração legado → Coolify: parando GHCR para liberar volumes Mongo/Redis..."
  stop_legacy_stack
  sleep 8
  restart_coolify_workers
  COOLIFY_DEPLOY_VIA=api
  deploy_service
  if ! wait_coolify_stack_up 24; then
    log "Redeploy após aguardar fila Coolify..."
    sleep 15
    deploy_service
    wait_coolify_stack_up 18 || true
  fi
  if ! coolify_stack_healthy; then
    log "Deploy API não subiu containers — tentando compose direto em /data/coolify/services/..."
    deploy_service_direct || true
    wait_coolify_stack_up 36 || true
  fi
  if coolify_stack_healthy; then
    log "Aguardando app em :3001 antes de configurar HTTPS..."
    wait_coolify_app_health || {
      log "AVISO: health :3001 demorou — tentando mais 3 min"
      wait_coolify_stack_up 18 || true
    }
    if [[ "$COOLIFY_DEPLOY_VIA" == "api" ]]; then
      remove_legacy_traefik_route
    else
      sudo bash "${DEPLOY_PATH}/scripts/vps-coolify-traefik-route-legacy.sh" || true
    fi
    log "Coolify stack OK (via ${COOLIFY_DEPLOY_VIA})"
    for i in $(seq 1 18); do
      if curl -sf -o /dev/null --max-time 10 "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null; then
        log "HTTPS OK"
        break
      fi
      sleep 5
    done
  else
    log "AVISO: deploy Coolify incompleto — restaurando stack legado GHCR"
    restore_legacy_stack
    sudo bash "${DEPLOY_PATH}/scripts/vps-coolify-traefik-route-legacy.sh" || true
  fi
  log "SSL: https://${PUBLIC_HOST}"
else
  log "MIGRATE_LEGACY=0 — service criado sem deploy. Migre manualmente depois."
fi

log "Painel: ${COOLIFY_URL}"
log "App (após deploy): ${PUBLIC_URL}"
log "Próximo: conectar GitHub no Coolify (Settings → Git) para auto-deploy em push main."
