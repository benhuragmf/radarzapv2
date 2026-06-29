# RadarZap v2 — preparação para produção

> **Referência de servidor e deploy** — infra, env, segurança, staging, go-live, smoke e rollback.  
> **Versão ref:** `2.12.69` · **Última revisão:** 2026-06-28  
> **Tracker de execução (vivo):** [`PREPARACAO-PRODUCAO-EXECUCAO.md`](./PREPARACAO-PRODUCAO-EXECUCAO.md) — marcar progresso infra **em paralelo** ao QA Fase 1.  
> **Branch de release (produto + UI v3):** `layout-v3` — ver [`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md).  
> **Go-live comercial** ainda exige gate § Estabilização + smoke completo — ver [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md).

---

## Mapa de documentação

| Documento | Quando usar |
|-----------|-------------|
| **`ROADMAP-COMPLETUDE.md`** | **Agora** — fase atual, estabilização, QA, lacunas |
| **`PREPARACAO-PRODUCAO.md`** (este) | Servidor, deploy, env, segurança |
| **`COOLIFY-DEPLOY.md`** | Deploy Docker Compose no Coolify (branch `layout-v3`) |
| **`PREPARACAO-PRODUCAO-EXECUCAO.md`** | Tracker vivo — checklist infra |
| **`PRODUCTION.md`** | Go-live — atalho após staging |
| `SISTEMA-REGISTRO.md` | Versão e changelog |
| `TICKET-ATENDIMENTO.md`, `INBOX-ATENDIMENTO.md` | Comportamento do produto |
| `WEBHOOKS.md`, `BILLING.md` | Contratos de integração |
| `SECURITY_CHECKLIST.md` | Resumo de segurança (detalhes aqui § Checkup) |

---

## WhatsApp Cloud API (Meta) — Fase 2 produto (não bloqueia estabilização Baileys)

Canal Enterprise; Baileys continua padrão até implementação completa.

**Pré-requisitos:** Business verificado, app Live, WABA, webhook HTTPS, token permanente.

**Env plataforma:** `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_CLOUD_VERIFY_TOKEN`, `WHATSAPP_CLOUD_API_VERSION`.

**Webhook:** `GET/POST …/api/integrations/whatsapp/cloud/webhook` — body raw + `X-Hub-Signature-256`.

**Por org (Mongo):** `wabaId`, `phoneNumberId`, `accessToken` criptografado.

Arquitetura alvo: `BaileysProvider` | `CloudApiProvider` → mesmo contrato Inbox/campanhas.

**Estado atual (2.8.11):** stub de verificação GET; POST retorna 503 — ingestão pendente.

Checklist Cloud API, migração Baileys→Cloud e dev com ngrok: `INBOX-ATENDIMENTO.md` fase 5 e `ROADMAP-COMPLETUDE.md`.

---

## Gate — antes de qualquer deploy no servidor (Fase 3)

**Pré-requisito go-live comercial:** [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) § Gate § Estabilização (QA manual).

**Prep infra em paralelo (2026-06-28):** inventário VPS, segurança, staging e smoke podem avançar via [`PREPARACAO-PRODUCAO-EXECUCAO.md`](./PREPARACAO-PRODUCAO-EXECUCAO.md) **sem** substituir QA de atendimento.

**Isolamento `layout-v3`:** branch alvo de produto + UI; Coolify e prep infra usam esta branch até merge em `main`.

Só subir staging/prod quando **todos** estiverem ok:

- [ ] **`npm test`** + **`npm run build`** (backend e frontend) sem erro
- [ ] **CI verde** em `main` (`test`, `backend-build`, `frontend-build`, E2E)
- [ ] **Smoke manual local** (login, Inbox, WA, ticket, billing teste)
- [ ] Checklist **§ Infra preparatório** e **§ Checkup de segurança** abaixo
- [ ] Roadmap sem bloqueador crítico para o release
- [ ] **Tag semver** (`v2.x.x`) + changelog `SISTEMA-REGISTRO.md` alinhados ao commit (recomendado em prod)

**Ordem:** dev estável → **staging** → smoke staging → **produção**.

---

## Servidor dedicado — requisitos

| Item | Mínimo recomendado |
|------|-------------------|
| SO | Ubuntu 22.04 LTS |
| RAM | 4 GB+ (Baileys + filas BullMQ) |
| Disco | SSD; espaço para `sessions/`, `media/`, Mongo, Redis |
| Rede | IP fixo; porta **443** (HTTPS) pública; **3001/27017/6379 só localhost/VPC** |
| Software | Docker + Compose **ou** Node 20 LTS + PM2 + nginx/Caddy |

### Onde **não** hospedar

| Opção | Motivo |
|-------|--------|
| Cloudflare Workers/Pages sozinhos | Sem processo Node 24/7, sem Mongo/Redis, sem Baileys |
| Free tier que “dorme” | WhatsApp e filas BullMQ exigem processo contínuo |

Cloudflare **grátis** serve como **DNS + SSL + Tunnel** na frente de um VPS/PC — não substitui o servidor.

### Diretórios persistentes (VPS)

```text
/opt/radarzap/
  app/              ← repo ou compose + scripts
  data/sessions/    ← volume WA (crítico)
  data/media/
  logs/
```

Docker: volumes `radarzap-sessions`, `radarzap-media`, `mongodb-data`, `redis-data` (`docker-compose.deploy.yml`).

---

## Topologia oficial (v2)

| Modo | Uso |
|------|-----|
| **Monolito** ✅ | Discord + WA + filas + painel — `node dist/index.js` **sem** `SERVICE_NAME` |
| Microserviços | Legado `docker-compose.yml` — não misturar com monolito no mesmo host |
| Painel isolado | `SERVICE_NAME=web-dashboard` — só API, sem Baileys |

```
                    ┌─────────────────────────────────┐
  HTTPS :443        │  nginx / Caddy / Cloudflare     │
                    └──────────────┬──────────────────┘
                                   │ :3001 (localhost)
                    ┌──────────────▼──────────────────┐
                    │  monolito (Docker ou PM2)         │
                    └──────────────┬──────────────────┘
              ┌────────────────────┼────────────────────┐
         MongoDB              Redis              sessions/ + media/
```

### Arquivos de deploy

| Arquivo | Função |
|---------|--------|
| `docker/Dockerfile.monolith` | Build app + frontend |
| `docker-compose.coolify.yml` | **Coolify** — build no servidor, magic env, proxy Coolify |
| `docker-compose.deploy.yml` | Stack GHCR: imagem pré-buildada + Mongo + Redis |
| `docker-compose.prod.yml` | Build local compose (sem Coolify/GHCR) |
| `.env.coolify.example` | Variáveis para colar no painel Coolify |
| `scripts/deploy-remote.sh` | Pull imagem GHCR + compose + health |
| `.github/workflows/deploy.yml` | GHCR + SSH (legado `main`) |
| `.github/workflows/ci.yml` | test + build + E2E |
| **`docs/COOLIFY-DEPLOY.md`** | Passo a passo Coolify |

**Dev local:** `npm run docker:infra` — **nunca** `auto-setup` em prod.

---

## Deploy — Coolify (recomendado para layout-v3)

Stack oficial para **UI v3 + monolito** na branch `layout-v3`:

1. Instalar Coolify no VPS ([`COOLIFY-DEPLOY.md`](./COOLIFY-DEPLOY.md)).
2. Resource **Docker Compose** → repo → branch **`layout-v3`** → arquivo **`docker-compose.coolify.yml`**.
3. Domínio no serviço **`app`**, porta **3001**.
4. Env: `.env.coolify.example` + magic vars (`SERVICE_URL_APP`, `SERVICE_PASSWORD_MONGODB`).
5. Volumes `radarzap-sessions` / `mongodb-data` persistentes.

Coolify gerencia SSL (Traefik/Caddy). **Não** expor `3001`/`27017`/`6379` na internet.

Coexiste com deploy GHCR legado até migração completa — **não** duas instâncias no mesmo WA.

---

## Ambientes

| | **Local** | **Staging** | **Produção** |
|---|-----------|-------------|--------------|
| Backend | `npm run dev` | build / Docker | idem staging |
| Frontend | Vite `:5174` | build estático no Express | idem |
| Domínio | `localhost` | `https://staging…` | `https://app…` |
| Mongo/Redis | Docker local | clusters **separados** | clusters prod |
| Stripe | test + `ALLOW_DEV_BILLING=true` | test keys | **Live** |
| OAuth | apps dev | redirects staging HTTPS | redirects prod |
| Sessões WA | `./sessions/` | volume staging | volume **persistente** |
| Logs | `pretty` | `json` | `json` + rotação |

Staging deve espelhar produção (mesmo build, env diferente).

---

## Variáveis de ambiente (servidor)

Copiar `.env.example` → `.env` no servidor. **Nunca commitar.**

| Variável | Local | Staging / Produção |
|----------|-------|-------------------|
| `NODE_ENV` | `development` | `production` |
| `MONGODB_URL` | `localhost:27017` | URL interna/VPC |
| `REDIS_URL` | `localhost:6380` | URL interna (+ senha recomendada) |
| `JWT_SECRET` / `SESSION_SECRET` | dev | strings longas **únicas por ambiente** |
| `SESSION_ENCRYPTION_KEY` | dev | **≥ 32 chars** — WA, webhooks, backup; **não rotacionar** com WA conectado |
| `BACKUP_ENCRYPT_EXPORT` | `false` | `true` em prod |
| `ALLOW_DEV_BILLING` | `true` (dev) | **ausente / `false`** |
| `ALLOW_DEV_API_KEY_BYPASS` | — | **nunca** |
| `FRONTEND_URL` | `http://localhost:5174` | HTTPS domínio real |
| `CORS_ORIGIN` | localhost | = `FRONTEND_URL` |
| `COOKIE_SECURE` | `false` | `true` em prod |
| `API_HOST` | `0.0.0.0` (dev) | `127.0.0.1` se nginx na frente |
| `DISCORD_*` / `GOOGLE_*` | apps dev | apps prod + redirects HTTPS |
| `LOG_FORMAT` | `pretty` | `json` |
| `WHATSAPP_HEADLESS` | `true` | `true` |
| `STRIPE_*` | test | live em prod |
| `RESEND_API_KEY` / `SMTP_*` | log console | domínio verificado |
| `WEBHOOK_*` | defaults | ver `WEBHOOKS.md` |
| `META_*` / `WHATSAPP_CLOUD_*` | vazio | § WhatsApp Cloud API (início deste doc) |
| `ALERT_SLACK_WEBHOOK_URL` / `SENTRY_DSN` | opcional | opcional |

**GitHub Environment** (deploy CI): `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, `MONGO_PASSWORD`.

---

## Validação local (antes de subir ao servidor)

```bash
npm ci
npm test
npm run build
npm run build --prefix src/services/web-dashboard/frontend
NODE_ENV=production node dist/index.js
# GET http://localhost:3001/api/services/health
```

| Item CI | Status |
|---------|--------|
| `npm test` | ✅ |
| `npm run build` backend | ✅ |
| `vite build` frontend | ✅ |
| E2E Playwright | ✅ |
| Imagem Docker monolito | ✅ |
| Deploy GHCR + SSH | ✅ (executar no servidor) |
| `npm run lint` no CI | 🟡 pendente |

---

## Deploy — primeira vez no VPS (Docker)

```bash
ssh root@SEU_IP

apt update && apt install -y docker.io docker-compose-plugin git
systemctl enable --now docker

mkdir -p /opt/radarzap && cd /opt/radarzap
git clone https://github.com/benhuragmf/radarzapv2.git .

cp .env.example .env
nano .env                    # secrets — ver § Variáveis acima
export MONGO_PASSWORD='…'

# Firewall: só 443 (e 22 SSH); bloquear 3001/27017/6379 publicamente
ufw allow 22
ufw allow 443
ufw enable

echo $GITHUB_PAT | docker login ghcr.io -u SEU_USER --password-stdin

export RADARZAP_IMAGE=ghcr.io/benhuragmf/radarzap:latest
bash scripts/deploy-remote.sh "$RADARZAP_IMAGE"
```

Configurar **nginx + SSL** (§ abaixo) apontando para `127.0.0.1:3001`.

**Não** rodar `npm run docker:infra` nem `auto-setup` em prod.

O script `scripts/deploy-remote.sh` faz: `docker pull` → `docker compose -f docker-compose.deploy.yml up -d` → health em `http://127.0.0.1:3001/api/services/health`.

---

## Deploy — CI (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`

| Gatilho | Ambiente |
|---------|----------|
| `workflow_dispatch` | escolher **staging** ou **production** |
| Push tag `v*` | **production** (environment GitHub) |

Fluxo: build `docker/Dockerfile.monolith` → push **GHCR** → SSH no servidor → `deploy-remote.sh` com imagem `ghcr.io/<repo>:<sha>`.

Secrets no **GitHub Environment** (staging ≠ production): `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, `MONGO_PASSWORD`.

---

## Deploy — staging

1. Mesmo procedimento **§ primeira vez no VPS** em host **staging** (Mongo/Redis **separados** de prod)
2. `.env` com keys **de teste** (Stripe test, OAuth staging)
3. `FRONTEND_URL` / `CORS_ORIGIN` = URL staging HTTPS
4. GitHub Actions → workflow **Deploy** → `workflow_dispatch` → **staging**
5. Conectar 1 sessão WA de teste
6. **Smoke § pós-deploy** completo em staging
7. Só avançar para produção se staging ok

---

## Deploy — produção (go-live)

| Passo | Ação |
|-------|------|
| 1 | Deploy **mesmo commit/tag** validado em staging |
| 2 | Secrets prod **únicos** (`JWT_SECRET`, `SESSION_SECRET`); manter `SESSION_ENCRYPTION_KEY` se copiar volume `sessions/` |
| 3 | Mongo prod **limpo** ou migração seletiva — não copiar lixo de staging |
| 4 | Redis prod **vazio** (filas BullMQ não migram) |
| 5 | `.env`: `NODE_ENV=production`, Stripe **Live**, e-mail prod |
| 6 | DNS + SSL prod ativos |
| 7 | Webhooks externos URLs **prod** (Stripe, clientes, futuro Meta) |
| 8 | Sessões WA: copiar volume staging→prod **só** com mesma encryption key; senão **novo QR** |
| 9 | Workflow Deploy → **production** ou tag `v*` |
| 10 | **Smoke § pós-deploy** em prod |
| 11 | Monitorar 24h: logs, WA, filas BullMQ |

---

## nginx + SSL

Express serve React + `/api` na `:3001` — um upstream basta:

```nginx
server {
  listen 443 ssl http2;
  server_name app.seudominio.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Certificado: Let's Encrypt (`certbot`) ou **Cloudflare** (proxy SSL na frente do VPS).

Rotas webhook (body **raw**, nginx não pode alterar body):  
`POST /api/billing/webhook/stripe`, `POST /api/integrations/whatsapp/cloud/webhook`.

### Cloudflare Tunnel (opcional — PC em casa ou VPS sem IP fixo)

1. Instalar `cloudflared` no servidor
2. Tunnel → `http://127.0.0.1:3001`
3. DNS no painel Cloudflare apontando para o tunnel  
Baileys e Mongo/Redis continuam **no servidor local/VPS**, não na Cloudflare.

---

## PM2 (alternativa ao Docker)

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'radarzap',
    cwd: '/opt/radarzap/app',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '2G',
    env: { NODE_ENV: 'production' },
  }],
};
```

Requisitos: Mongo e Redis instalados separadamente; `API_HOST=127.0.0.1` no `.env`; sem `SERVICE_NAME`.

---

## OAuth (cadastrar antes do go-live)

1. Discord → `https://app.seudominio.com/auth/discord/callback`
2. Google → `https://app.seudominio.com/auth/google/callback`
3. Staging: URLs separadas com domínio staging

---

## WhatsApp Baileys no servidor

- Volume persistente `sessions/` — perda = novo QR
- RAM suficiente; `WHATSAPP_HEADLESS=true`
- `SESSION_ENCRYPTION_KEY` estável após conectar
- Firewall: só **443** público (3001 só localhost)
- Futuro Enterprise: § WhatsApp Cloud API

---

## Configuração em produção (código já implementado)

| Área | O que conferir |
|------|----------------|
| Auth | Cookies `secure: true`; `FRONTEND_URL` HTTPS |
| API | Helmet, rate limit `/auth` e `/api`; `requireDashboardOrigin` em mutações |
| Erros | `productionSafeError` — sem stack trace ao cliente |
| Socket.IO | Rooms por `tenant:{clientId}` |
| IDOR | Rotas filtradas por `clientId` |
| Sessões WA | `GET /sessions/:id/connect` desabilitado em prod — usar `POST` |
| Webhooks Stripe/Meta | Body **raw** antes de `express.json()` |
| Backup | `BACKUP_ENCRYPT_EXPORT=true` |
| Billing | `validateConfig` bloqueia `ALLOW_DEV_BILLING` em prod |
| RBAC | `RADARZAP_SYSTEM_ADMIN_*` revisados |

**Não definir** `SERVICE_NAME` no monolito de produção.

---

## Checkup de segurança

### Secrets e repositório

- [ ] `.env` **não** commitado (`git check-ignore .env`)
- [ ] `sessions/` e `**/creds.json` ignorados
- [ ] Rotacionar todos os secrets do `.env.example` (nunca reusar dev)
- [ ] `JWT_SECRET`, `SESSION_SECRET`, `SESSION_ENCRYPTION_KEY` únicos (≥ 32 chars)
- [ ] `STRIPE_*` live só em prod; test só em staging
- [ ] `ALLOW_DEV_BILLING` e `ALLOW_DEV_API_KEY_BYPASS` **ausentes** em staging/prod
- [ ] `RADARZAP_SYSTEM_ADMIN_DISCORD_IDS` só com IDs da equipe

### Rede e TLS

- [ ] Node em `127.0.0.1:3001` — não expor na internet
- [ ] Mongo/Redis sem bind público
- [ ] `FRONTEND_URL` HTTPS; `COOKIE_SECURE=true`
- [ ] `CORS_ORIGIN` = `FRONTEND_URL`
- [ ] Webhooks cliente: só HTTPS
- [ ] nginx não altera body de Stripe/Meta

### Redis com senha (recomendado)

```yaml
redis:
  command: redis-server --appendonly yes --requirepass "${REDIS_PASSWORD}"
  # ports: NÃO publicar 6379
app:
  environment:
    REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
```

### Criptografia de dados

| Dado | Mecanismo |
|------|-----------|
| Webhook secret (Mongo) | AES-256-CBC + `SESSION_ENCRYPTION_KEY` |
| Export backup | `ciphertext` se `BACKUP_ENCRYPT_EXPORT=true` |
| Sessões Baileys | mesma chave |

### Docker

- [ ] Imagem roda como usuário não-root (quando aplicável)
- [ ] Volumes `sessions/`, `media/` persistentes e permissão restrita
- [ ] **Não** montar `docker.sock` em prod
- [ ] Compose sem expor 27017/6379 publicamente

### CI/CD

- [ ] Secrets no GitHub Environment (não no código)
- [ ] Branch `main` protegida
- [ ] Deploy production com aprovação manual ou tag `v*`

### LGPD

- [ ] Fluxo de consentimento testado
- [ ] Export/backup tratado como dado sensível

### Auditoria

- [ ] `npm audit --audit-level=high` revisado
- [ ] Scan secrets no repo (gitleaks / GitHub secret scanning)
- [ ] Backup Mongo antes de deploy com migration

Docs: `SECURITY.md`, `SECURITY_AUDIT.md`, `SECURITY_CHECKLIST.md`.

---

## Smoke — pós-deploy (staging e produção)

- [ ] `GET /api/services/health` → healthy
- [ ] Login Google + Discord
- [ ] Painel + WebSocket Inbox
- [ ] Sessão WA conectada ou QR ok
- [ ] Enviar mensagem teste
- [ ] Convite equipe (e-mail)
- [ ] Checkout plano (Stripe test em staging / live em prod)
- [ ] Webhook outbound HTTPS (criar endpoint + evento teste)
- [ ] Export/import backup em org teste
- [ ] Ticket menu WhatsApp + SLA painel
- [ ] IA (se ativa): status ticket não grava complemento indevido
- [ ] Usuário tenant A **não** acessa dados de tenant B (IDOR manual)
- [ ] QR WhatsApp visível só para o tenant correto

---

## Rollback

1. Redeploy imagem/tag **anterior** (`RADARZAP_IMAGE=ghcr.io/.../radarzap:<sha-anterior>`)
2. **Não** rollback Mongo se migration irreversível — restore snapshot pré-deploy
3. Manter volume `sessions/` — rollback de código compatível se schema igual
4. Stripe: reconciliar pedidos pendentes no dashboard Stripe

---

## Por feature → o que muda em produção

| Feature | Produção |
|---------|----------|
| Webhooks outbound (2.2.0) | Redis + fila `notifications`; URLs HTTPS — `WEBHOOKS.md` |
| E-mail equipe (2.2.2) | `RESEND_API_KEY` ou SMTP; `MAIL_FROM` verificado |
| Billing (2.4.0) | Stripe Live; `POST …/api/billing/webhook/stripe` — `BILLING.md` |
| Inbox SLA (2.2.1) | Cron/BullMQ; `inboxSettings.timezone` por tenant |
| Tickets (2.7.x) | SLA equipe; menu bot; IA assist — `TICKET-ATENDIMENTO.md` |
| Backup tenant (2.5.2) | `BACKUP_ENCRYPT_EXPORT=true` |
| Testes (2.5.1) | CI + E2E; validar staging manualmente |
| Admin observabilidade | `/admin/monitoring`; opcional Slack/Sentry |

---

## Infra — checklist preparatório (resumo)

- [ ] VPS provisionado; Docker ou Node+PM2+nginx
- [ ] Domínio + SSL (Let's Encrypt / Cloudflare)
- [ ] Mongo com auth + backup automático
- [ ] Redis com persistência (`appendonly`) e senha
- [ ] Volumes `sessions/` e `media/` planejados
- [ ] `.env` prod preenchido (secrets únicos)
- [ ] OAuth redirects prod/staging cadastrados
- [ ] Stripe webhook prod registrado
- [ ] GitHub Environment secrets de deploy
- [ ] Gate § início deste doc ✅
- [ ] Staging validado antes de produção

---

## Referências

- Atalho go-live: [`PRODUCTION.md`](./PRODUCTION.md)
- Roadmap produto: [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md)
- Dev local: [`RADARZAP-V2-MIGRACAO.md`](./RADARZAP-V2-MIGRACAO.md)
- Billing: [`BILLING.md`](./BILLING.md)
