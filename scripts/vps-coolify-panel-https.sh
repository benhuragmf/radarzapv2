#!/usr/bin/env bash
# HTTPS para o painel Coolify (sai de http://IP:8000 → https://coolify-IP.sslip.io).
set -euo pipefail

VPS_IP="${VPS_IP:-151.247.210.180}"
PUBLIC_HOST="${PUBLIC_HOST:-151-247-210-180.sslip.io}"
COOLIFY_PANEL_HOST="${COOLIFY_PANEL_HOST:-coolify-${PUBLIC_HOST}}"

log() { echo "[coolify-panel-https] $*"; }

if ! docker ps --format '{{.Names}}' | grep -q '^coolify$'; then
  log "ERRO: container coolify não está rodando"
  exit 1
fi

PANEL_URL="https://${COOLIFY_PANEL_HOST}"
log "Configurando painel Coolify em ${PANEL_URL} ..."

docker exec coolify php artisan tinker --execute="
\$s = \App\Models\InstanceSettings::first();
if (!\$s) { \$s = new \App\Models\InstanceSettings(); }
\$s->fqdn = '${PANEL_URL}';
if (property_exists(\$s, 'public_ipv4') || \Illuminate\Support\Facades\Schema::hasColumn('instance_settings', 'public_ipv4')) {
  \$s->public_ipv4 = '${VPS_IP}';
}
\$s->save();
echo 'fqdn=' . \$s->fqdn;
" 2>&1 | tail -3

docker exec coolify php artisan config:clear >/dev/null 2>&1 || true

PROXY="$(docker ps --format '{{.Names}}' | grep -E 'coolify-proxy' | head -1 || true)"
if [[ -n "$PROXY" ]]; then
  DYNAMIC_DIR="/traefik/dynamic"
  docker exec "$PROXY" test -d "$DYNAMIC_DIR" 2>/dev/null || DYNAMIC_DIR="/etc/traefik/dynamic"
  CFG="coolify-panel-${COOLIFY_PANEL_HOST//[^a-zA-Z0-9]/-}.yaml"
  log "Rota Traefik painel → container coolify:8080"
  docker exec -i "$PROXY" sh -c "cat > ${DYNAMIC_DIR}/${CFG}" <<EOF
http:
  routers:
    coolify-panel-https:
      entryPoints:
        - https
      rule: Host(\`${COOLIFY_PANEL_HOST}\`)
      tls:
        certResolver: letsencrypt
      service: coolify-panel-svc
    coolify-panel-http:
      entryPoints:
        - http
      rule: Host(\`${COOLIFY_PANEL_HOST}\`)
      middlewares:
        - coolify-panel-redirect-https
      service: coolify-panel-svc
  middlewares:
    coolify-panel-redirect-https:
      redirectScheme:
        scheme: https
        permanent: true
  services:
    coolify-panel-svc:
      loadBalancer:
        servers:
          - url: http://coolify:8080
EOF
fi

log "Aguardando certificado (até ~2 min)..."
for i in $(seq 1 24); do
  if curl -sf -o /dev/null --max-time 12 "${PANEL_URL}/login" 2>/dev/null; then
    log "OK: painel em ${PANEL_URL}"
    log "Use este URL em vez de http://${VPS_IP}:8000"
    exit 0
  fi
  sleep 5
done
log "Domínio configurado — se ainda não abrir, aguarde DNS/ACME e tente: ${PANEL_URL}"
log "http://${VPS_IP}:8000 continua HTTP (normal até migrar bookmarks)"
