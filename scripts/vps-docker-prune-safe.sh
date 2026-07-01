#!/usr/bin/env bash
# Libera espaco em disco para deploy Docker — NUNCA remove volumes nomeados (sessions/mongo).
# Uso: sudo -E bash scripts/vps-docker-prune-safe.sh [--aggressive]
set -euo pipefail

DISK_WARN_PCT="${DISK_WARN_PCT:-82}"
DISK_CRITICAL_PCT="${DISK_CRITICAL_PCT:-90}"
AGGRESSIVE=0
[[ "${1:-}" == "--aggressive" ]] && AGGRESSIVE=1

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
}

prune_aggressive() {
  log "Prune agressivo (sem volumes — sessions/mongo preservados)..."
  docker_cmd system prune -af 2>/dev/null || true
}

log_disk
prune_light

pct="$(disk_use_pct /)"
if (( pct >= DISK_WARN_PCT )) || (( AGGRESSIVE == 1 )); then
  prune_aggressive
fi

log_disk
pct="$(disk_use_pct /)"
if (( pct >= DISK_CRITICAL_PCT )); then
  log "ERRO: disco ainda em ${pct}% — libere espaco manualmente (df -h; du -sh /var/lib/docker/*)"
  exit 1
fi

log "Espaco OK para pull/deploy (${pct}% usado em /)"
