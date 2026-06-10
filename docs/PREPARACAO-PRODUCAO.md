# RadarZap v2 — preparação para produção

> **Documento de trabalho contínuo durante o desenvolvimento.**  
> Aqui ficam servidores, env, segurança, mudanças no código/config e checklists — tudo que **já dá para preparar antes** do go-live.

**Quando o sistema estiver 100% pronto:** executar o runbook enxuto em [`PRODUCTION.md`](./PRODUCTION.md) (gate §0 + comandos de deploy).

**Versão ref:** `2.7.1` · **Última revisão:** 2026-06-10

---

## Mapa de documentação

| Documento | Quando usar |
|-----------|-------------|
| **`PREPARACAO-PRODUCAO.md`** (este) | **Agora** — infra, env, segurança, validação local |
| **`PRODUCTION.md`** | **Só no go-live** — comandos de deploy no dedicado |
| `ROADMAP-COMPLETUDE.md` | Lacunas e prioridades antes do release |
| `SISTEMA-REGISTRO.md` | Versão e changelog |
| `TICKET-ATENDIMENTO.md`, `INBOX-ATENDIMENTO.md` | Comportamento do produto |
| `WEBHOOKS.md`, `BILLING.md` | Contratos de integração |

---

## Servidor dedicado — requisitos

| Item | Mínimo recomendado |
|------|-------------------|
| SO | Ubuntu 22.04 LTS |
| RAM | 4 GB+ (Baileys + filas BullMQ) |
| Disco | SSD; espaço para `sessions/`, `media/`, Mongo, Redis |
| Rede | IP fixo; portas **443** (HTTPS) públicas; **3001/27017/6379 só localhost/VPC** |
| Software | Docker + Compose **ou** Node 20 LTS + PM2 + nginx/Caddy |

### Diretórios persistentes (VPS)

```text
/opt/radarzap/
  app/              ← repo ou só compose + scripts
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

Arquivos de deploy:

| Arquivo | Função |
|---------|--------|
| `docker/Dockerfile.monolith` | Build app + frontend |
| `docker-compose.deploy.yml` | Stack: app + Mongo + Redis |
| `scripts/deploy-remote.sh` | Pull + compose + health |
| `.github/workflows/deploy.yml` | GHCR + SSH |
| `.github/workflows/ci.yml` | test + build |

**Dev local:** `npm run docker:infra` — **nunca** `auto-setup` em prod.

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

## Variáveis de ambiente

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
| `DISCORD_*` / `GOOGLE_*` | apps dev | apps prod + redirects HTTPS |
| `LOG_FORMAT` | `pretty` | `json` |
| `WHATSAPP_HEADLESS` | `true` | `true` |
| `STRIPE_*` | test | live em prod |
| `RESEND_API_KEY` / `SMTP_*` | log console | domínio verificado |
| `WEBHOOK_*` | defaults | ver `WEBHOOKS.md` |
| `META_*` / `WHATSAPP_CLOUD_*` | vazio | Enterprise — § Cloud API abaixo |

**GitHub Environment** (deploy): `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, `MONGO_PASSWORD`.

---

## Validação local (fazer agora, antes do go-live)

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
| Deploy GHCR + SSH | ✅ (executar só no go-live) |
| `npm run lint` no CI | 🟡 pendente |

---

## O que mudar / conferir no código e config

Itens já implementados no código — **configurar em prod**:

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

### Secrets e flags

- [ ] Rotacionar todos os secrets do `.env.example` (nunca reusar dev)
- [ ] `SESSION_ENCRYPTION_KEY` forte (≥ 32 caracteres)
- [ ] `BACKUP_ENCRYPT_EXPORT=true`
- [ ] `ALLOW_DEV_BILLING` e `ALLOW_DEV_API_KEY_BYPASS` **ausentes**

### Rede

- [ ] Node em `127.0.0.1:3001` — não expor na internet
- [ ] Mongo/Redis sem bind público
- [ ] HTTPS + `CORS_ORIGIN` = `FRONTEND_URL`
- [ ] Webhooks cliente: só HTTPS
- [ ] nginx não altera body de Stripe/Meta

### Redis com senha (recomendado)

```yaml
# trecho docker-compose — Redis interno
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

### Checklist rápido segurança

- [ ] Mongo/Redis/Node sem porta pública
- [ ] HTTPS ativo
- [ ] Smoke: criar webhook, export/import backup em org teste
- [ ] Backup Mongo antes de deploy com migration
- [ ] Scan secrets no repo (gitleaks / GitHub secret scanning)
- [ ] `npm audit --audit-level=high` limpo

Docs complementares (se existirem no repo): `SECURITY.md`, `SECURITY_AUDIT.md`, `SECURITY_CHECKLIST.md`.

---

## nginx (referência)

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

Rotas webhook (body raw): `POST /api/billing/webhook/stripe`, (futuro) Cloud API Meta.

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

`API_HOST=127.0.0.1` no `.env`. Sem `SERVICE_NAME`.

---

## OAuth (preparar nos consoles)

1. Discord → `https://app.seudominio.com/auth/discord/callback`
2. Google → `https://app.seudominio.com/auth/google/callback`
3. Staging: URLs separadas com domínio staging

---

## WhatsApp Baileys (canal padrão hoje)

- Volume persistente `sessions/` — perda = novo QR
- RAM suficiente; `WHATSAPP_HEADLESS=true`
- `SESSION_ENCRYPTION_KEY` estável após conectar
- Firewall: só 443 público
- Enterprise futuro: Cloud API — § abaixo

---

## Por feature → o que muda em produção

### Webhooks outbound — ✅ 2.2.0

Redis + fila `notifications`; URLs HTTPS clientes. Doc: `WEBHOOKS.md`.

### E-mail equipe — ✅ 2.2.2

`RESEND_API_KEY` ou SMTP prod; `MAIL_FROM` verificado.

### Billing — ✅ 2.4.0

Stripe Live; webhook `POST …/api/billing/webhook/stripe`. Doc: `BILLING.md`.

### Inbox SLA — ✅ 2.2.1

Cron/BullMQ no mesmo processo; `inboxSettings.timezone` por tenant.

### Tickets — ✅ 2.7.x

SLA equipe (`ticketTeamResponseHours`); menu bot; IA assist — sem env extra. Doc: `TICKET-ATENDIMENTO.md`.

### Backup tenant — ✅ 2.5.2

`BACKUP_ENCRYPT_EXPORT=true`; auditoria export/import.

### Testes — ✅ 2.5.1

CI bloqueia merge; E2E Playwright; validar staging manualmente.

### Admin observabilidade

`/admin/monitoring`; opcional: `ALERT_SLACK_WEBHOOK_URL`, `SENTRY_DSN`.

---

## WhatsApp Cloud API (Meta) — 🟡 futuro

Canal Enterprise; Baileys continua padrão até implementação.

**Pré-requisitos:** Business verificado, app Live, WABA, webhook HTTPS, token permanente.

**Env plataforma:** `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_CLOUD_VERIFY_TOKEN`, `WHATSAPP_CLOUD_API_VERSION`.

**Webhook:** `GET/POST …/api/integrations/whatsapp/cloud/webhook` — body raw + `X-Hub-Signature-256`.

**Por org (Mongo):** `wabaId`, `phoneNumberId`, `accessToken` criptografado.

Arquitetura alvo: `BaileysProvider` | `CloudApiProvider` → mesmo contrato Inbox/campanhas.

Checklist go-live Cloud API, migração Baileys→Cloud e dev com ngrok: detalhes em `INBOX-ATENDIMENTO.md` fase 5 e `ROADMAP-COMPLETUDE.md`.

---

## Infra — checklist preparatório (antes do go-live)

- [ ] VPS provisionado; Docker ou Node+PM2+nginx
- [ ] Domínio + SSL (Let's Encrypt / Cloudflare)
- [ ] Mongo com auth + backup automático
- [ ] Redis com persistência (`appendonly`) e senha
- [ ] Volumes `sessions/` e `media/` planejados
- [ ] `.env` prod preenchido (secrets únicos)
- [ ] OAuth redirects prod/staging cadastrados
- [ ] Stripe webhook prod registrado
- [ ] GitHub Environment secrets de deploy
- [ ] Gate §0 de `PRODUCTION.md` ✅

---

## Referências

- Go-live (executar depois): [`PRODUCTION.md`](./PRODUCTION.md)
- Roadmap: [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md)
- Dev local: [`RADARZAP-V2-MIGRACAO.md`](./RADARZAP-V2-MIGRACAO.md)
- Billing: [`BILLING.md`](./BILLING.md)
