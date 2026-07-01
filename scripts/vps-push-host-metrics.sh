#!/usr/bin/env bash
# Coleta métricas do host e envia ao Radar Chat (Admin Ops → aba Infra).
# Cron sugerido: */5 * * * * root /opt/radarchatv2/scripts/vps-push-host-metrics.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchatv2}"
COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
INGEST_URL="${OPS_HOST_METRICS_URL:-https://${PUBLIC_HOST}/api/admin/ops/host-metrics/ingest}"

if [[ -f "${DEPLOY_PATH}/.env" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${DEPLOY_PATH}/.env" 2>/dev/null || true
  set +a
fi

SECRET="${OPS_HOST_METRICS_SECRET:-}"
if [[ -z "$SECRET" ]]; then
  echo "[push-host-metrics] OPS_HOST_METRICS_SECRET ausente — abortando" >&2
  exit 1
fi

load_line="$(cat /proc/loadavg 2>/dev/null || echo '0 0 0')"
read -r load1 load5 load15 _ <<<"$load_line"

uptime_seconds=""
if [[ -r /proc/uptime ]]; then
  uptime_seconds="$(awk '{print int($1)}' /proc/uptime)"
fi

cpu_count="$(nproc 2>/dev/null || echo 2)"

mem_total_mb="" mem_used_mb="" mem_avail_mb="" swap_used_mb=""
if command -v free >/dev/null; then
  mem_total_mb="$(free -m | awk '/^Mem:/ {print $2}')"
  mem_used_mb="$(free -m | awk '/^Mem:/ {print $3}')"
  mem_avail_mb="$(free -m | awk '/^Mem:/ {print $7}')"
  swap_used_mb="$(free -m | awk '/^Swap:/ {print $3}')"
fi

issues=()
disk_pct="$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo 0)"
if [[ "$disk_pct" =~ ^[0-9]+$ ]] && (( disk_pct >= 82 )); then
  issues+=("Disco / em ${disk_pct}% — executando limpeza Docker automatica")
  if [[ -f "${DEPLOY_PATH}/scripts/vps-docker-prune-safe.sh" ]]; then
    sudo -E DEPLOY_PATH="$DEPLOY_PATH" bash "${DEPLOY_PATH}/scripts/vps-docker-prune-safe.sh" --cron --aggressive \
      >>/var/log/radarchat-docker-prune.log 2>&1 || true
    disk_pct="$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo "$disk_pct")"
    if (( disk_pct >= 88 )); then
      issues+=("Disco / ainda em ${disk_pct}% apos limpeza — risco de falha no deploy")
    fi
  fi
fi
while IFS= read -r line; do
  [[ -n "$line" ]] && issues+=("$line")
done < <(sudo docker ps -a --format '{{.Names}} {{.Status}}' 2>/dev/null \
  | grep -iE 'restart|unhealthy|exited' | grep -v 'coolify-sentinel' | head -n 10 || true)

containers_json="[]"
if command -v jq >/dev/null; then
  containers_json="$(sudo docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}' 2>/dev/null \
    | head -n 25 \
    | jq -R -s '
      split("\n")
      | map(select(length > 0))
      | map(split("|"))
      | map({
          name: .[0],
          cpuPercent: (.[1] | gsub("%"; "") | tonumber? // 0),
          memUsedMb: (.[2] | split("/")[0] | gsub("[^0-9.]"; "") | tonumber? // 0),
          memLimitMb: (.[2] | split("/")[1] | gsub("[^0-9.]"; "") | tonumber? // 0),
          memPercent: (.[3] | gsub("%"; "") | tonumber? // 0)
        })
    ')"
fi

payload_file="$(mktemp)"
issues_json='[]'
if [[ ${#issues[@]} -gt 0 ]] && command -v jq >/dev/null; then
  issues_json="$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)"
fi

if ! command -v jq >/dev/null; then
  echo "[push-host-metrics] jq obrigatório" >&2
  exit 1
fi

jq -n \
  --arg reportedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson uptimeSeconds "${uptime_seconds:-null}" \
  --argjson load1 "$load1" \
  --argjson load5 "$load5" \
  --argjson load15 "$load15" \
  --argjson cpuCount "$cpu_count" \
  --argjson memTotal "${mem_total_mb:-null}" \
  --argjson memUsed "${mem_used_mb:-null}" \
  --argjson memAvail "${mem_avail_mb:-null}" \
  --argjson swapUsed "${swap_used_mb:-null}" \
  --argjson containers "$containers_json" \
  --argjson issues "$issues_json" \
  '{
    reportedAt: $reportedAt,
    host: {
      uptimeSeconds: (if $uptimeSeconds == null then null else $uptimeSeconds end),
      load1: ($load1 | tonumber),
      load5: ($load5 | tonumber),
      load15: ($load15 | tonumber),
      cpuCount: ($cpuCount | tonumber),
      memoryTotalMb: (if $memTotal == null then null else ($memTotal | tonumber) end),
      memoryUsedMb: (if $memUsed == null then null else ($memUsed | tonumber) end),
      memoryAvailableMb: (if $memAvail == null then null else ($memAvail | tonumber) end),
      swapUsedMb: (if $swapUsed == null then null else ($swapUsed | tonumber) end)
    },
    containers: $containers,
    issues: (if ($issues | length) == 0 then null else $issues end)
  }' >"$payload_file"

http_code="$(curl -sS -o /tmp/rz-host-metrics-resp.json -w '%{http_code}' \
  -X POST "$INGEST_URL" \
  -H "Content-Type: application/json" \
  -H "X-Ops-Host-Secret: ${SECRET}" \
  --data-binary @"$payload_file" || echo "000")"

rm -f "$payload_file"

if [[ "$http_code" =~ ^2 ]]; then
  echo "[push-host-metrics] OK ${INGEST_URL} (${http_code})"
  exit 0
fi

echo "[push-host-metrics] FALHA HTTP ${http_code}: $(cat /tmp/rz-host-metrics-resp.json 2>/dev/null || true)" >&2
exit 1
