#!/usr/bin/env bash
# Roteia HTTPS → app em :3001 via Traefik do Coolify (domínio oficial ou legado sslip.io).
set -euo pipefail
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
HOST_IP="${HOST_IP:-172.17.0.1}"

log() { echo "[traefik-legacy] $*"; }

host_slug() {
  echo "${1//./-}" | tr -cd 'a-zA-Z0-9-'
}

PROXY="$(sudo docker ps --format '{{.Names}}' | grep -E 'coolify-proxy|traefik' | head -1 || true)"
if [[ -z "$PROXY" ]]; then
  log "ERRO: container coolify-proxy não encontrado"
  exit 1
fi

RESOLVED_IP="172.17.0.1"
for try_ip in 172.17.0.1 host.docker.internal; do
  if sudo docker exec "$PROXY" wget -qO- --timeout=3 "http://${try_ip}:3001/api/services/health" 2>/dev/null | grep -q healthy; then
    RESOLVED_IP="$try_ip"
    log "Backend acessível em ${RESOLVED_IP}:3001 (via proxy)"
    break
  fi
done
HOST_IP="$RESOLVED_IP"

if ! curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
  log "ERRO: app não responde em :3001 no host"
  exit 1
fi

DYNAMIC_DIR="/traefik/dynamic"
if ! sudo docker exec "$PROXY" test -d "$DYNAMIC_DIR" 2>/dev/null; then
  DYNAMIC_DIR="/etc/traefik/dynamic"
fi

SLUG="$(host_slug "$PUBLIC_HOST")"
CFG="radarzap-${SLUG}.yaml"
log "Aplicando rota ${PUBLIC_HOST} → ${HOST_IP}:3001 no ${PROXY} (${DYNAMIC_DIR}/${CFG})"

sudo docker exec -i "$PROXY" sh -c "cat > ${DYNAMIC_DIR}/${CFG}" <<EOF
http:
  routers:
    radarzap-${SLUG}-https:
      entryPoints:
        - https
      rule: Host(\`${PUBLIC_HOST}\`)
      tls:
        certResolver: letsencrypt
      service: radarzap-${SLUG}-svc
    radarzap-${SLUG}-http:
      entryPoints:
        - http
      rule: Host(\`${PUBLIC_HOST}\`)
      middlewares:
        - redirect-to-https-${SLUG}
      service: radarzap-${SLUG}-svc
  middlewares:
    redirect-to-https-${SLUG}:
      redirectScheme:
        scheme: https
        permanent: true
  services:
    radarzap-${SLUG}-svc:
      loadBalancer:
        servers:
          - url: http://${HOST_IP}:3001
EOF

log "Aguardando certificado Let's Encrypt (até ~90s)..."
for i in $(seq 1 18); do
  if curl -sf -o /dev/null --max-time 12 "https://${PUBLIC_HOST}/api/services/health" 2>/dev/null; then
    log "OK: https://${PUBLIC_HOST} ativo"
    exit 0
  fi
  sleep 5
done
log "Rota aplicada — se HTTPS ainda falhar, verifique logs: docker logs ${PROXY} --tail 50"
