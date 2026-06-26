#!/usr/bin/env bash
# Bootstrap inicial RadarZap v2 em VPS Ubuntu (Docker Compose deploy).
# Executar como ubuntu (sudo onde necessário). Não commitar .env gerado.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/radarzap}"
REPO_URL="${REPO_URL:-https://github.com/benhuragmf/radarzapv2.git}"
PUBLIC_URL="${PUBLIC_URL:-http://151.247.210.180:3001}"

echo "[bootstrap] RadarZap v2 — $DEPLOY_PATH"

# Swap recomendado em VPS 2GB (build Docker + Baileys)
if [[ ! -f /swapfile ]]; then
  echo "[bootstrap] Criando swap 2G..."
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

DOCKER="docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "[bootstrap] Instalando Docker..."
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    ca-certificates curl git ufw wget gnupg lsb-release
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "[bootstrap] Docker instalado — pode ser necessário relogar para grupo docker"
fi

if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

if ! $DOCKER compose version >/dev/null 2>&1; then
  echo "[bootstrap] docker compose plugin ausente — reinstale Docker CE recente"
  exit 1
fi

sudo ufw --force reset || true
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 3001/tcp comment 'RadarZap direct (temporario)'
sudo ufw --force enable

sudo mkdir -p "$DEPLOY_PATH"
sudo chown "$USER:$USER" "$DEPLOY_PATH"
cd "$DEPLOY_PATH"

if [[ ! -d .git ]]; then
  git clone "$REPO_URL" .
else
  git fetch origin main
  git reset --hard origin/main
fi

if [[ ! -f .env ]]; then
  echo "[bootstrap] Gerando .env de produção..."
  MONGO_PW="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 32)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  SESSION_ENC="$(openssl rand -hex 32)"
  cat > .env <<EOF
NODE_ENV=production
MONGO_PASSWORD=${MONGO_PW}
MONGODB_URL=mongodb://admin:${MONGO_PW}@mongodb:27017/discord-whatsapp?authSource=admin
REDIS_URL=redis://redis:6379
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
SESSION_SECRET=${SESSION_SECRET}
SESSION_ENCRYPTION_KEY=${SESSION_ENC}
BACKUP_ENCRYPT_EXPORT=true
API_PORT=3001
API_HOST=0.0.0.0
FRONTEND_URL=${PUBLIC_URL}
CORS_ORIGIN=${PUBLIC_URL}
COOKIE_SECURE=false
LOG_LEVEL=info
LOG_FORMAT=json
WHATSAPP_HEADLESS=true
WHATSAPP_SESSION_TIMEOUT=2592000000
QUEUE_CONCURRENCY=3
ALLOW_DEV_BILLING=false
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
MAIL_FROM=RadarZap <noreply@radarzap.local>
RADARZAP_SYSTEM_ADMIN_DISCORD_IDS=
EOF
  chmod 600 .env
  echo "[bootstrap] .env criado em ${DEPLOY_PATH}/.env (chmod 600)"
else
  echo "[bootstrap] .env já existe — preservado"
fi

export MONGO_PASSWORD="$(grep '^MONGO_PASSWORD=' .env | cut -d= -f2-)"

echo "[bootstrap] Build imagem monolito (pode levar vários minutos em 2GB RAM)..."
$DOCKER build -f docker/Dockerfile.monolith -t radarzap:production .

export RADARZAP_IMAGE=radarzap:production
export DOCKER_CMD="$DOCKER"
if [[ "$DOCKER" == "sudo docker" ]]; then
  sudo -E bash -c "export RADARZAP_IMAGE=$RADARZAP_IMAGE MONGO_PASSWORD='$MONGO_PASSWORD' DOCKER_CMD='sudo docker'; bash scripts/deploy-remote.sh '$RADARZAP_IMAGE'"
else
  bash scripts/deploy-remote.sh "$RADARZAP_IMAGE"
fi

echo ""
echo "=============================================="
echo " Bootstrap concluído"
echo " URL: ${PUBLIC_URL}"
echo " Health: curl -s ${PUBLIC_URL}/api/services/health"
echo " Próximo: preencher OAuth/Stripe/Discord no .env e reiniciar:"
echo "   cd ${DEPLOY_PATH} && docker compose -f docker-compose.deploy.yml up -d"
echo "=============================================="
