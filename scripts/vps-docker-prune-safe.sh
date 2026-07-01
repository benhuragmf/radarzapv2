#!/usr/bin/env bash
# Libera espaco em disco para deploy Docker — NUNCA remove volumes nomeados (sessions/mongo).
# Uso:
#   sudo -E bash scripts/vps-docker-prune-safe.sh           # deploy (falha se disco cheio)
#   sudo -E bash scripts/vps-docker-prune-safe.sh --aggressive
#   sudo -E bash scripts/vps-docker-prune-safe.sh --cron    # cron (só loga, nao aborta)
set -euo pipefail

DISK_WARN_PCT="${DISK_WARN_PCT:-75}"
DISK_CRITICAL_PCT="${DISK_CRITICAL_PCT:-88}"
AGGRESSIVE=0
CRON_MODE=0
for arg in "$@"; do
  case "$arg" in
    --aggressive) AGGRESSIVE=1 ;;
    --cron) CRON_MODE=1 ;;
  esac
done

RADARCHAT_IMAGE_REPO="${RADARCHAT_IMAGE_REPO:-ghcr.io/benhuragmf/radarchatv2}"

log() { echo "[docker-prune] $*"; }

if [[ "${EUID}" -eq 0 ]]; then
  docker_cmd() { docker "$@"; }
else
  docker_cmd() { sudo docker "$@"; }
fi

disk_use_pct() {
  df -P "${1:-/}" 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo 0
}

log_disk() {
  local root_pct
  root_pct="$(disk_use_pct /)"
  log "Disco /: $(df -h / | awk 'NR==2 {print $3 " / " $2 " (" $5 ")"}')"
  if [[ -d /var/lib/docker ]]; then
    log "Docker: $(df -h /var/lib/docker 2>/dev/null | awk 'NR==2 {print $3 " / " $2 " (" $5 ")"}' || echo 'n/a')"
  fi
  docker_cmd system df 2>/dev/null | while IFS= read -r line; do log "  $line"; done || true
  log "Uso /: ${root_pct}%"
}

prune_light() {
  log "Removendo imagens sem container ativo..."
  docker_cmd image prune -af 2>/dev/null || true
  log "Removendo containers parados..."
  docker_cmd container prune -f 2>/dev/null || true
  log "Removendo cache de build..."
  docker_cmd builder prune -af 2>/dev/null || true
  log "Removendo networks orfas..."
  docker_cmd network prune -f 2>/dev/null || true
}

prune_old_radarchat_images() {
  local dangling
  dangling="$(docker_cmd images "${RADARCHAT_IMAGE_REPO}" --filter "dangling=true" -q 2>/dev/null | tr '\n' ' ' || true)"
  if [[ -n "${dangling// }" ]]; then
    log "Removendo camadas dangling ${RADARCHAT_IMAGE_REPO}..."
    # shellcheck disable=SC2086
    docker_cmd rmi $dangling 2>/dev/null || true
  fi
}

prune_aggressive() {
  log "Prune agressivo (sem volumes — sessions/mongo preservados)..."
  prune_old_radarchat_images
  docker_cmd system prune -af 2>/dev/null || true
}

trim_journal_if_needed() {
  local pct="$1"
  if (( pct < DISK_WARN_PCT )); then
    return 0
  fi
  if command -v journalctl >/dev/null 2>&1; then
    log "Reduzindo journal do sistema (disco ${pct}%)..."
    journalctl --vacuum-size=200M 2>/dev/null || true
    journalctl --vacuum-time=7d 2>/dev/null || true
  fi
}

trim_radarchat_logs() {
  local log_file="/var/log/radarchat-host-metrics.log"
  if [[ -f "$log_file" ]] && [[ "$(wc -c <"$log_file" 2>/dev/null || echo 0)" -gt 5242880 ]]; then
    log "Truncando ${log_file} (>5MB)..."
    tail -n 2000 "$log_file" >"${log_file}.tmp" && mv "${log_file}.tmp" "$log_file"
  fi
  local prune_log="/var/log/radarchat-docker-prune.log"
  if [[ -f "$prune_log" ]] && [[ "$(wc -c <"$prune_log" 2>/dev/null || echo 0)" -gt 2097152 ]]; then
    tail -n 500 "$prune_log" >"${prune_log}.tmp" && mv "${prune_log}.tmp" "$prune_log"
  fi
}

log_disk
prune_light
trim_radarchat_logs

pct="$(disk_use_pct /)"
trim_journal_if_needed "$pct"

if (( pct >= DISK_WARN_PCT )) || (( AGGRESSIVE == 1 )); then
  prune_aggressive
  trim_journal_if_needed "$(disk_use_pct /)"
fi

log_disk
pct="$(disk_use_pct /)"
if (( pct >= DISK_CRITICAL_PCT )); then
  msg="ERRO: disco ainda em ${pct}% apos limpeza — verifique df -h e docker system df"
  if (( CRON_MODE == 1 )); then
    log "AVISO CRON: ${msg}"
    exit 0
  fi
  log "$msg"
  exit 1
fi

log "Espaco OK (${pct}% usado em /)"
