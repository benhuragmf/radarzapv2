#!/usr/bin/env bash
# Diagnóstico rápido: CPU, memória, load e top containers/processos no VPS.
set -euo pipefail

COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}"
APP_CNAME="${COOLIFY_SERVICE_UUID}-app-1"

log() { echo "[host-metrics] $*"; }

log "=== Host (load / CPU / RAM) ==="
uptime || true
if command -v free >/dev/null; then free -h; fi
if [[ -r /proc/loadavg ]]; then log "loadavg: $(cat /proc/loadavg)"; fi

log ""
log "=== Top processos (CPU) ==="
ps aux --sort=-%cpu 2>/dev/null | head -n 12 || top -b -n1 | head -n 20

log ""
log "=== Docker stats (no-stream) ==="
sudo docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>/dev/null \
  | head -n 25 || log "docker stats indisponível"

log ""
log "=== Containers restarting? ==="
sudo docker ps -a --format '{{.Names}} {{.Status}}' 2>/dev/null \
  | grep -iE 'restart|starting|unhealthy|exited' || log "(nenhum container em restart/unhealthy/exited visível)"

log ""
log "=== App logs (erros recentes, ${APP_CNAME}) ==="
if sudo docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qF "$APP_CNAME"; then
  sudo docker logs "$APP_CNAME" --tail 120 2>&1 \
    | grep -iE 'error|fatal|exception|ENOMEM|OOM|ECONNRESET|crash|uncaught|reconnect|loop' \
    | tail -n 25 || log "(sem linhas de erro nas últimas 120)"
else
  log "container app ausente"
fi

log ""
log "=== Fim host-metrics ==="
