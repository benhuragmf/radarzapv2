#!/usr/bin/env bash
# Instala Coolify v4 na VPS (coexiste com Radar Chat legado até migração do compose).
# Uso: sudo bash scripts/vps-install-coolify.sh
# GitHub Actions: workflow install-coolify.yml
set -euo pipefail

PUBLIC_HOST="${PUBLIC_HOST:-151-247-210-180.sslip.io}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarchat}"

log() { echo "[coolify-install] $*"; }

if [[ "$(id -u)" -ne 0 ]] && ! sudo -n true 2>/dev/null; then
  log "Execute com sudo ou como root."
  exit 1
fi

run_root() {
  if [[ "$(id -u)" -eq 0 ]]; then "$@"; else sudo "$@"; fi
}

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^coolify$'; then
  log "Coolify já instalado (container coolify). Pulando install."
  docker ps --filter name=coolify --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  if [[ -d "$DEPLOY_PATH/scripts" ]]; then
    run_root env COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}" \
      bash "$DEPLOY_PATH/scripts/vps-coolify-fix-permissions.sh" || true
  fi
  exit 0
fi

if [[ -f /data/coolify/source/upgrade.sh ]] && ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^coolify$'; then
  log "Instalação anterior incompleta — retomando upgrade.sh..."
  run_root bash /data/coolify/source/upgrade.sh latest latest ghcr.io true
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^coolify$'; then
    log "Coolify ativo após resume."
    docker ps --filter name=coolify --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    IPV4="$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
    log "Painel Coolify: http://${IPV4}:8000"
    exit 0
  fi
fi

log "Pré-check: Docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "Docker não encontrado — o instalador Coolify tentará instalar."
fi

log "Parando Caddy do host (Coolify usa proxy próprio em 80/443)..."
if systemctl is-active --quiet caddy 2>/dev/null; then
  run_root systemctl stop caddy
  run_root systemctl disable caddy || true
  log "Caddy parado. HTTPS ${PUBLIC_HOST} volta após configurar domínio no Coolify."
else
  log "Caddy não estava ativo."
fi

log "Radar Chat legado (GHCR compose) permanece em execução até migração manual."
if [[ -d "$DEPLOY_PATH" ]]; then
  (cd "$DEPLOY_PATH" && docker compose -f docker-compose.deploy.yml ps 2>/dev/null) || true
fi

log "Baixando instalador Coolify v4..."
INSTALL_DIR="$(mktemp -d)"
trap 'rm -rf "$INSTALL_DIR"' EXIT
curl -fsSL https://cdn.coollabs.io/coolify/install.sh -o "$INSTALL_DIR/install.sh"
chmod +x "$INSTALL_DIR/install.sh"

export DO_NOT_TRACK=1
# Coolify v4: 1º arg posicional = versão (não usar -f/-n — viram tag de imagem).
run_root env DO_NOT_TRACK=1 \
  ROOT_USERNAME="${ROOT_USERNAME:-}" \
  ROOT_USER_EMAIL="${ROOT_USER_EMAIL:-}" \
  ROOT_USER_PASSWORD="${ROOT_USER_PASSWORD:-}" \
  bash "$INSTALL_DIR/install.sh"

log "Pós-install:"
docker ps --filter name=coolify --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true

# Permissões /data/coolify/services — evita erro 500 "Permission denied" no painel
if [[ -d "$DEPLOY_PATH/scripts" ]]; then
  log "Aplicando permissões padrão Coolify (uid 9999) em /data/coolify/services..."
  run_root env COOLIFY_SERVICE_UUID="${COOLIFY_SERVICE_UUID:-h143brhw5f8tgfj9trj0f3bd}" \
    bash "$DEPLOY_PATH/scripts/vps-coolify-fix-permissions.sh" || true
fi

IPV4="$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
log "Painel Coolify: http://${IPV4}:8000 (crie usuário root no 1º acesso se não definiu ROOT_USER_*)."
log "Próximo passo: COOLIFY-DEPLOY.md — resource Docker Compose → main → docker-compose.coolify.yml"
log "ATENÇÃO: sslip.io pode ficar offline até domínio no Coolify; app legado ainda em :3001 interno."
