#!/usr/bin/env bash
# Roteia https://sslip.io → app em :3001 via Traefik do Coolify (quando stack Coolify está Exited).
set -euo pipefail
PUBLIC_HOST="${PUBLIC_HOST:-151-247-210-180.sslip.io}"
HOST_IP="${HOST_IP:-172.17.0.1}"

log() { echo "[traefik-legacy] $*"; }

PROXY="$(sudo docker ps --format '{{.Names}}' | grep -E 'coolify-proxy|traefik' | head -1 || true)"
if [[ -z "$PROXY" ]]; then
  log "ERRO: container coolify-proxy não encontrado"
  exit 1
fi

if ! curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:3001/api/services/health" 2>/dev/null; then
  log "ERRO: app não responde em :3001 — suba o stack antes"
  exit 1
fi

DYNAMIC_DIR="/traefik/dynamic"
if ! sudo docker exec "$PROXY" test -d "$DYNAMIC_DIR" 2>/dev/null; then
  DYNAMIC_DIR="/etc/traefik/dynamic"
fi

CFG="radarzap-legacy-${PUBLIC_HOST//[^a-zA-Z0-9]/-}.yaml"
log "Aplicando rota ${PUBLIC_HOST} → ${HOST_IP}:3001 no ${PROXY} (${DYNAMIC_DIR}/${CFG})"

sudo docker exec -i "$PROXY" sh -c "cat > ${DYNAMIC_DIR}/${CFG}" <<EOF
http:
  routers:
    radarzap-legacy-https:
      entryPoints:
        - https
      rule: Host(\`${PUBLIC_HOST}\`)
      tls:
        certResolver: letsencrypt
      service: radarzap-legacy-svc
    radarzap-legacy-http:
      entryPoints:
        - http
      rule: Host(\`${PUBLIC_HOST}\`)
      middlewares:
        - redirect-to-https
      service: radarzap-legacy-svc
  middlewares:
    redirect-to-https:
      redirectScheme:
        scheme: https
        permanent: true
  services:
    radarzap-legacy-svc:
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
