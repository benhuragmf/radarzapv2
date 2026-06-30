#!/usr/bin/env bash
# Instala cron de métricas VPS + secret + env no stack Coolify (idempotente).
# Uso: sudo -E bash scripts/vps-install-host-metrics-cron.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzapv2}"
DEPLOY_PATH="${DEPLOY_PATH//$'\r'/}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID//$'\r'/}"
COOLIFY_SERVICE_DIR="${COOLIFY_SERVICE_DIR:-/data/coolify/services/${COOLIFY_SERVICE_UUID}}"
COOLIFY_URL="${COOLIFY_URL:-http://127.0.0.1:8000}"
CRON_FILE="/etc/cron.d/radarzap-host-metrics"
ENV_FILE="${DEPLOY_PATH}/.env"
SERVICE_ENV="${COOLIFY_SERVICE_DIR}/.env"
APP_COOLIFY_URL="${APP_COOLIFY_URL:-http://172.17.0.1:8000}"

log() { echo "[host-metrics-install] $*"; }

if [[ "${EUID}" -ne 0 ]]; then
  log "Execute com sudo"
  exit 1
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { log "ERRO: '$1' ausente"; exit 1; }
}

need_cmd openssl
need_cmd curl
need_cmd jq

set_env_kv() {
  local file="$1" key="$2" val="$3"
  [[ -f "$file" ]] || touch "$file"
  local tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$file" >"$tmp" 2>/dev/null || true
  printf '%s=%s\n' "$key" "$val" >>"$tmp"
  mv "$tmp" "$file"
}

load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f" 2>/dev/null || true
  set +a
}

ensure_ops_secret() {
  load_env_file "$ENV_FILE"
  if [[ -n "${OPS_HOST_METRICS_SECRET:-}" ]]; then
    log "OPS_HOST_METRICS_SECRET já definido no ${ENV_FILE}"
    return 0
  fi
  OPS_HOST_METRICS_SECRET="$(openssl rand -hex 32)"
  set_env_kv "$ENV_FILE" "OPS_HOST_METRICS_SECRET" "$OPS_HOST_METRICS_SECRET"
  log "Secret gerado e salvo em ${ENV_FILE}"
}

ensure_coolify_api_token() {
  if [[ -f "$ENV_FILE" ]] && grep -q '^COOLIFY_API_TOKEN=' "$ENV_FILE" 2>/dev/null; then
    load_env_file "$ENV_FILE"
    return 0
  fi
  if ! docker ps --format '{{.Names}}' | grep -q '^coolify$'; then
    log "AVISO: container coolify ausente — COOLIFY_API_TOKEN não gerado"
    return 0
  fi
  log "Gerando COOLIFY_API_TOKEN (automação)..."
  local out token
  out="$(docker exec coolify php artisan tinker --execute='
$uid = (int) \DB::table("users")->where("id", ">", 0)->whereNotNull("email")->orderBy("id")->value("id");
$tid = (int) \DB::table("teams")->where("id", ">", 0)->orderBy("id")->value("id");
$user = \App\Models\User::find($uid);
if (!$user || $uid < 1 || $tid < 1) { echo "ERROR"; exit(1); }
$user->tokens()->where("name", "radarzap-host-metrics")->delete();
$plain = \Illuminate\Support\Str::random(64);
$pat = $user->tokens()->create([
  "name" => "radarzap-host-metrics",
  "token" => hash("sha256", $plain),
  "abilities" => ["*"],
  "team_id" => $tid,
]);
echo "TOKEN|" . $pat->id . "|" . $plain;
' 2>&1)" || true
  token="$(echo "$out" | grep -oE 'TOKEN\|[0-9]+\|[^[:space:]]+' | tail -1 | cut -d'|' -f2- || true)"
  if [[ -z "$token" ]]; then
    log "AVISO: não foi possível gerar COOLIFY_API_TOKEN"
    return 0
  fi
  COOLIFY_API_TOKEN="$token"
  set_env_kv "$ENV_FILE" "COOLIFY_API_TOKEN" "$COOLIFY_API_TOKEN"
  log "COOLIFY_API_TOKEN salvo em ${ENV_FILE}"
}

get_env_kv() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- || true
}

needs_service_env_sync() {
  local current
  current="$(get_env_kv "$SERVICE_ENV" "OPS_HOST_METRICS_SECRET")"
  [[ "$current" != "${OPS_HOST_METRICS_SECRET:-}" ]] && return 0
  current="$(get_env_kv "$SERVICE_ENV" "COOLIFY_URL")"
  [[ "$current" != "$APP_COOLIFY_URL" ]] && return 0
  current="$(get_env_kv "$SERVICE_ENV" "COOLIFY_SERVICE_UUID")"
  [[ "$current" != "$COOLIFY_SERVICE_UUID" ]] && return 0
  if [[ -n "${COOLIFY_API_TOKEN:-}" ]]; then
    current="$(get_env_kv "$SERVICE_ENV" "COOLIFY_API_TOKEN")"
    [[ "$current" != "$COOLIFY_API_TOKEN" ]] && return 0
  fi
  return 1
}

wait_app_health() {
  local i code
  for i in $(seq 1 24); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null || echo 000)"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
    sleep 5
  done
  return 1
}

sync_service_env() {
  load_env_file "$ENV_FILE"
  [[ -n "${OPS_HOST_METRICS_SECRET:-}" ]] || { log "ERRO: secret ausente"; exit 1; }

  if [[ ! -d "$COOLIFY_SERVICE_DIR" ]]; then
    log "AVISO: stack Coolify ausente em ${COOLIFY_SERVICE_DIR} — só cron no host"
    return 0
  fi

  if ! needs_service_env_sync; then
    log "Env do app já sincronizado — skip recreate"
    return 0
  fi

  log "Sincronizando env do app em ${SERVICE_ENV}..."
  set_env_kv "$SERVICE_ENV" "OPS_HOST_METRICS_SECRET" "$OPS_HOST_METRICS_SECRET"
  set_env_kv "$SERVICE_ENV" "COOLIFY_URL" "$APP_COOLIFY_URL"
  set_env_kv "$SERVICE_ENV" "COOLIFY_SERVICE_UUID" "$COOLIFY_SERVICE_UUID"
  if [[ -n "${COOLIFY_API_TOKEN:-}" ]]; then
    set_env_kv "$SERVICE_ENV" "COOLIFY_API_TOKEN" "$COOLIFY_API_TOKEN"
  fi

  if [[ -f "${COOLIFY_SERVICE_DIR}/docker-compose.yaml" ]]; then
    log "Recriando container app para aplicar env..."
    (cd "$COOLIFY_SERVICE_DIR" && docker compose --env-file .env \
      -f docker-compose.yaml -p "${COOLIFY_SERVICE_UUID}" \
      up -d --no-deps --force-recreate app) 2>/dev/null || true
    wait_app_health || log "AVISO: health ainda não OK após recreate"
  fi
}

install_cron() {
  load_env_file "$ENV_FILE"
  local script="${DEPLOY_PATH}/scripts/vps-push-host-metrics.sh"
  if [[ ! -f "$script" ]]; then
    log "ERRO: ${script} não encontrado — git pull no DEPLOY_PATH"
    exit 1
  fi
  chmod +x "$script"

  cat >"$CRON_FILE" <<EOF
# RadarZap — métricas VPS → Admin Ops (a cada 5 min)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
*/5 * * * * root DEPLOY_PATH=${DEPLOY_PATH} PUBLIC_HOST=${PUBLIC_HOST} COOLIFY_SERVICE_UUID=${COOLIFY_SERVICE_UUID} ${script} >> /var/log/radarzap-host-metrics.log 2>&1
EOF
  chmod 644 "$CRON_FILE"
  log "Cron instalado: ${CRON_FILE}"
}

run_first_push() {
  load_env_file "$ENV_FILE"
  export DEPLOY_PATH PUBLIC_HOST COOLIFY_SERVICE_UUID OPS_HOST_METRICS_SECRET
  wait_app_health || true
  log "Enviando primeiro reporte..."
  if bash "${DEPLOY_PATH}/scripts/vps-push-host-metrics.sh"; then
    log "Primeiro reporte OK"
  else
    log "AVISO: primeiro reporte falhou (app pode ainda estar subindo)"
  fi
}

main() {
  log "DEPLOY_PATH=${DEPLOY_PATH} service=${COOLIFY_SERVICE_UUID}"
  ensure_ops_secret
  ensure_coolify_api_token
  sync_service_env
  install_cron
  run_first_push
  log "Concluído — veja Admin Ops → Infra → VPS / Host"
}

main "$@"
