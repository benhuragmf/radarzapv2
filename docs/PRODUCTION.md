# RadarZap v2 — local → produção

> Tudo que muda entre **desenvolvimento local** e **ambiente de produção**.  
> Atualizar ao implementar itens do `ROADMAP-COMPLETUDE.md`.

**Última revisão:** 2026-06-10 (§3.1 Tickets 2.7.x + §2 Deploy + §7 Cloud API + §8 Segurança)

---

## §2 Deploy: teste/staging → produção

> Guia oficial para sair do **dev local** ou **ambiente de teste** e ir para **produção**.  
> CI hoje: `.github/workflows/ci.yml` (test + build backend + vite). **Deploy automático ainda não existe** — seguir este runbook.

### Três ambientes

| | **Local (dev)** | **Staging / teste** | **Produção** |
|---|-----------------|---------------------|--------------|
| Objetivo | desenvolvimento | validar release antes do go-live | clientes reais |
| Backend | `npm run dev` (ts-node-dev) | `npm run build` + `node dist/index.js` | idem staging |
| Frontend | Vite `:5174` | build estático servido pelo Express | idem |
| Domínio | `localhost` | `https://staging.seudominio.com` | `https://app.seudominio.com` |
| MongoDB | Docker local | cluster **separado** (Atlas staging) | cluster **prod** dedicado |
| Redis | Docker `:6380` | instância staging | instância prod (BullMQ) |
| Stripe | test + `ALLOW_DEV_BILLING=true` | **test** keys, billing dev **off** | **Live** keys |
| OAuth | apps dev Google/Discord | redirects staging HTTPS | redirects prod HTTPS |
| Sessões WA | `./sessions/` local | volume staging (pode reusar QR de teste) | volume prod **persistente** |
| Logs | `LOG_FORMAT=pretty` | `json` recomendado | `json` + rotação/centralizado |

**Regra:** staging deve espelhar produção (mesmo build, mesmas env exceto secrets/domínio). Não testar só em `localhost` antes do go-live.

### Topologia oficial (decisão v2)

| Modo | Quando usar | Como subir |
|------|-------------|------------|
| **Monolito** ✅ recomendado | Operação atual v2 — Discord + WA + filas + painel | `npm run build` → `node dist/index.js` **sem** `SERVICE_NAME` |
| Microserviços | Legado `docker-compose.yml` (api-gateway, discord-bot…) | Só se já operar assim; **não** misturar com monolito no mesmo host |
| Painel isolado | Raro — só API REST sem bot | `SERVICE_NAME=web-dashboard` (não inclui Baileys/Discord) |

O fluxo diário documentado em `RADARZAP-V2-MIGRACAO.md` é **monolito + infra Docker** (`npm run docker:infra` para Mongo/Redis).

```
                    ┌─────────────────────────────────┐
  HTTPS :443        │  nginx / Caddy / Cloudflare     │
                    │  /     → static (React build)   │
                    │  /api  → Node :3001             │
                    │  WS    → Socket.IO (upgrade)    │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │  node dist/index.js (monolito)  │
                    │  Discord + WA + BullMQ + painel │
                    └──────────────┬──────────────────┘
              ┌────────────────────┼────────────────────┐
              │                    │                    │
         MongoDB              Redis              ./sessions/
         (Atlas/VPC)      (filas/cache)         ./media/
```

### Build de release (igual staging e prod)

```bash
# Na raiz do repo — mesmo commit/tag nos dois ambientes
npm ci
npm run build
npm run build --prefix src/services/web-dashboard/frontend
# Frontend compilado: src/services/web-dashboard/public/ (servido pelo DashboardService)
```

Validar localmente antes de deploy:

```bash
NODE_ENV=production node dist/index.js
# Health: GET http://localhost:3001/api/services/health
```

CI já executa `npm run build`, `vite build` e **E2E Playwright** (login + PWA) em cada push para `main`.

### Deploy automático (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`

| Gatilho | Comportamento |
|---------|---------------|
| `workflow_dispatch` | Build imagem → GHCR → SSH no servidor |
| Tag `v*` | Idem (release) |

**Secrets no GitHub Environment** (`staging` / `production`):

| Secret | Uso |
|--------|-----|
| `DEPLOY_HOST` | IP ou hostname do VPS |
| `DEPLOY_USER` | Usuário SSH |
| `DEPLOY_SSH_KEY` | Chave privada (PEM) |
| `DEPLOY_PATH` | Diretório no servidor (ex.: `/opt/radarzap`) |
| `MONGO_PASSWORD` | Senha root Mongo do `docker-compose.deploy.yml` |

No servidor: clonar repo, copiar `.env`, instalar Docker. O script `scripts/deploy-remote.sh` faz `docker pull` + `docker compose -f docker-compose.deploy.yml up -d`.

Imagem publicada em `ghcr.io/<owner>/radarzap:<sha>`.

### Opção A — VPS (PM2 + nginx)

**1. Servidor**

- Ubuntu 22.04+, 4 GB+ RAM (Baileys), disco para `sessions/` e `media/`
- Node 20 LTS, nginx, certbot ou Cloudflare SSL

**2. Diretórios persistentes**

```text
/opt/radarzap/
  app/          ← código deployado (git pull ou artefato CI)
  data/sessions/
  data/media/
  logs/
```

Montar ou symlink: `sessions` → `data/sessions`, `media` → `data/media`.

**3. PM2 (monolito)**

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
    env: {
      NODE_ENV: 'production',
      // demais vars vêm de .env ou secrets do host
    },
  }],
};
```

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

**Não** definir `SERVICE_NAME` no monolito — senão só um subsistema sobe.

**4. nginx (exemplo mínimo)**

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

O Express serve React em `/` e API em `/api` — um único upstream `:3001` basta.

**5. Webhooks com body raw**

Rotas que **não** podem passar por `express.json()` global antes do handler:

- `POST /api/billing/webhook/stripe`
- (futuro) `POST /api/integrations/whatsapp/cloud/webhook`

Garantir que nginx **não** altera o body; no Node já estão registradas antes do parser JSON.

### Opção B — Docker (monolito)

O `docker/web-dashboard.Dockerfile` existente define `SERVICE_NAME=web-dashboard` — **só painel**, não use para stack completa.

Para monolito em container:

1. Build multi-stage: copiar `dist/` + `node_modules` + frontend em `public/`
2. `CMD ["node", "dist/index.js"]` **sem** `SERVICE_NAME`
3. Volumes: `sessions`, `media`, `.env` via secrets
4. `docker-compose` prod: app + Mongo + Redis **internos** (portas 27017/6379 **não** expostas publicamente)

Infra local de dev: `npm run docker:infra` — **não** subir `auto-setup` em prod (cria segundo bot).

### Subir staging (primeira vez)

1. Provisionar MongoDB + Redis staging (clusters separados de prod)
2. Copiar `.env.example` → secrets staging; preencher com keys **de teste**
3. `FRONTEND_URL` / `CORS_ORIGIN` = URL staging HTTPS
4. OAuth: adicionar redirect staging nos apps Google/Discord
5. Deploy build (PM2 ou container); conferir health
6. Conectar 1 sessão WA de teste; validar Inbox, envio, campanha, convite e-mail
7. Stripe **test mode**: checkout em `/plans`; webhook apontando para staging
8. Checklist smoke (abaixo)

### Migrar staging → produção (go-live)

| Passo | Ação |
|-------|------|
| 1 | **Tag/git:** deploy em prod o **mesmo commit** validado em staging |
| 2 | **Secrets:** gerar **novos** `JWT_SECRET`, `SESSION_SECRET`, `SESSION_ENCRYPTION_KEY` prod — ou manter encryption key se **copiar** volume `sessions/` intacto |
| 3 | **Mongo:** export staging **não** vai direto para prod se houver dados de teste — preferir dump limpo ou migração seletiva (`scripts/migrate-v1-db-to-v2.ps1` só se aplicável) |
| 4 | **Redis:** instância vazia prod (filas BullMQ não migrar) |
| 5 | **Env prod:** `NODE_ENV=production`, `ALLOW_DEV_BILLING=false`, Stripe **Live**, `RESEND_API_KEY` / SMTP prod |
| 6 | **OAuth:** redirects prod nos consoles Google/Discord |
| 7 | **DNS:** `app.seudominio.com` → servidor prod; SSL ativo |
| 8 | **Webhooks externos:** registrar URLs **prod** — Stripe (`/api/billing/webhook/stripe`), webhooks clientes, (futuro) Meta Cloud |
| 9 | **Sessões WA:** copiar volume `sessions/` staging→prod **somente** se mesmo servidor e mesma `SESSION_ENCRYPTION_KEY`; senão **reescanear QR** em prod |
| 10 | **Smoke prod:** login, Inbox, envio, API key, billing live (valor mínimo), Discord bot online |
| 11 | **Monitorar** 24h: logs, reconexão WA, filas BullMQ |

### O que muda entre teste e produção (env)

| Variável | Staging | Produção |
|----------|---------|----------|
| `NODE_ENV` | `production` | `production` |
| `FRONTEND_URL` | `https://staging…` | `https://app…` |
| `MONGODB_URL` / `REDIS_URL` | cluster staging | cluster prod |
| `JWT_SECRET` / `SESSION_SECRET` | únicos staging | **únicos prod** (nunca reusar dev) |
| `SESSION_ENCRYPTION_KEY` | estável se copiar sessions | **não rotacionar** após WA conectado |
| `ALLOW_DEV_BILLING` | `false` | `false` |
| `STRIPE_*` | test keys | **live** keys + webhook live |
| `RESEND_API_KEY` / `SMTP_*` | pode ser teste | domínio verificado prod |
| `LOG_FORMAT` | `json` | `json` |
| `RADARZAP_SYSTEM_ADMIN_*` | IDs equipe | IDs equipe prod |

Ver também tabelas por feature: §4 e-mail, §6 billing, §7 Cloud API.

### Checklist smoke (staging e prod)

- [ ] `GET /api/services/health` → `{ healthy: true }`
- [ ] Login Google (dono) e Discord (admin sistema)
- [ ] Painel carrega sem erro; WebSocket conecta (notificações Inbox)
- [ ] Sessão WA conectada ou QR gera
- [ ] Enviar mensagem teste (Inbox ou Enviar agora)
- [ ] Convite equipe (e-mail chega)
- [ ] Checkout plano (Stripe test em staging / live em prod)
- [ ] Webhook outbound dispara (URL HTTPS de teste)

### CI/CD — hoje e próximo passo

| Item | Status |
|------|--------|
| `npm test` (subset estável) | ✅ CI job `test` |
| `npm run build` backend | ✅ CI job `backend-build` |
| `vite build` frontend | ✅ CI job `frontend-build` |
| `npm run lint` | 🟡 pendente no CI |
| `tsc -b` frontend estrito | 🟡 pendente (vite build não valida todos TS) |
| Deploy automático staging | 🟡 pendente — adicionar job (Railway / Fly / SSH+PM2) após builds |
| Imagem Docker monolito oficial | 🟡 pendente — hoje só Dockerfiles legados microserviço |

**Fluxo alvo:** push `main` → CI verde → deploy staging → smoke manual → promote tag → deploy prod.

### Rollback

1. `pm2 restart` com checkout do **commit/tag anterior** (ou redeploy imagem anterior)
2. **Não** rollback Mongo se migration irreversível — restore snapshot pré-deploy
3. Manter volume `sessions/` — rollback de código é compatível se mesma versão de schema
4. Stripe: webhook prod continua na URL prod; pedidos pendentes reconciliam via dashboard Stripe

Detalhes gerais: seção **Rollback** no final deste documento.

---

## Ambientes hoje

> Detalhes de deploy, staging e go-live: **§2 acima**.

| | **Local (dev)** | **Produção (alvo)** |
|---|-----------------|---------------------|
| Backend | `npm run dev` → `src/index.ts` (ts-node-dev) | Processo Node compilado (`npm run build` + `node dist/index.js`) ou container |
| Painel | `npm run dashboard:frontend` → Vite `:5174` | Build estático (`npm run build` no frontend) servido por nginx ou pelo DashboardService |
| API painel | `start-dashboard.ts` → `:3001` (dev separado) | Mesmo processo ou reverse proxy `/api` |
| MongoDB | Docker `:27017` ou `npm run docker:infra` | MongoDB Atlas / VPS gerenciado, auth, backup |
| Redis | Docker `:6380` → container `:6379` | Redis gerenciado ou container com persistência |
| Sessões WA | Pasta `./sessions/` local | Volume persistente + `SESSION_ENCRYPTION_KEY` forte |
| OAuth | `FRONTEND_URL=http://localhost:5174` | HTTPS domínio real; redirects Google/Discord atualizados |
| Cookies | Same-site localhost | Secure + domínio staging/prod |

**Topologia:** monolito recomendado — ver **§2 Deploy**.

---

## Checklist mínimo para subir produção

> Runbook completo: **§2 Deploy** (PM2, nginx, staging→prod, smoke tests).

### Infra

- [ ] MongoDB com usuário/senha, backup automático, índices criados
- [ ] Redis com `appendonly` e memória adequada (filas BullMQ)
- [ ] Volume persistente para `sessions/` e `media/` WhatsApp
- [ ] HTTPS (Let's Encrypt / Cloudflare) no domínio do painel
- [ ] Reverse proxy (nginx/Caddy): `/` → frontend, `/api` → backend, WebSocket Socket.IO

### Variáveis de ambiente (`.env.example` → secrets produção)

| Variável | Local | Produção |
|----------|-------|----------|
| `NODE_ENV` | `development` | `production` |
| `MONGODB_URL` | `localhost:27017` | URL interna/VPC, sem expor porta pública |
| `REDIS_URL` | `localhost:6380` | URL interna |
| `JWT_SECRET` / `SESSION_SECRET` | dev | **Rotacionar** — strings longas únicas |
| `SESSION_ENCRYPTION_KEY` | dev | **Obrigatório** — perda = sessões WA inválidas; ver **§8** |
| `BACKUP_ENCRYPT_EXPORT` | ausente / `false` | `true` — backup JSON criptografado |
| `ALLOW_DEV_BILLING` | `true` (dev) | **ausente ou `false`** — `validateConfig` bloqueia em prod |
| `ALLOW_DEV_API_KEY_BYPASS` | ausente | **nunca** em prod/staging |
| `FRONTEND_URL` | `http://localhost:5174` | `https://app.seudominio.com` |
| `CORS_ORIGIN` | localhost | mesmo domínio HTTPS do painel |
| `DISCORD_*` / `GOOGLE_*` | dev apps | apps produção; redirects HTTPS |
| `LOG_LEVEL` | `info` / `pretty` | `info` / `json` |
| `WHATSAPP_HEADLESS` | `true` | `true` |
| `RATE_LIMIT_*` | relaxado | ajustar por plano/tráfego |
| `META_*` / `WHATSAPP_CLOUD_*` | vazio (só Baileys) | Enterprise — ver **§7** |

**Nunca** commitar `.env` ou `sessions/`.

### Build e processo

Ver comandos e PM2 em **§2 Deploy**. Resumo:

```bash
npm run build
npm run build --prefix src/services/web-dashboard/frontend
NODE_ENV=production node dist/index.js
```

- [ ] PM2/systemd/container com `restart: unless-stopped`
- [ ] Health: `GET /api/services/health`
- [ ] Logs centralizados
- [ ] **Não** rodar `auto-setup` do docker-compose em prod

---

## Roadmap → o que muda em produção

Cada item do `ROADMAP-COMPLETUDE.md` exige config ou infra adicional:

### 1. Webhooks outbound — ✅ implementado (v2.2.0)

| Local | Produção |
|-------|----------|
| Fila BullMQ `notifications` no mesmo processo `npm run dev` | Worker dedicado ou mesmo container app; Redis gerenciado |
| URLs de teste (`webhook.site`) | URLs HTTPS dos clientes |
| Env defaults em `.env` | `WEBHOOK_TIMEOUT_MS`, `WEBHOOK_MAX_RETRIES`, `WEBHOOK_RETRY_DELAY_MS` |

Doc: `docs/WEBHOOKS.md`

---

### 2. Deploy + CI/CD — 🟡 spec em §2

| Local | Produção |
|-------|----------|
| CI: test + build backend + vite | Deploy job staging/prod **pendente** |
| `npm run dev` + Vite | Monolito `node dist/index.js` + PM2/nginx — **§2** |
| Docker só infra | Compose prod sem expor Mongo/Redis |

**Pendente CI:** lint, `tsc -b` frontend, imagem Docker monolito, deploy automático.

---

### 3. Inbox SLA / inatividade

| Local | Produção |
|-------|----------|
| Cron manual / dev | Job scheduler (BullMQ repeatable ou cron container) |
| Timezone dev | `inboxSettings.timezone` = `America/Sao_Paulo` por tenant |

---

### 3.1 Tickets — SLA equipe e assistente IA (2.7.x)

| Local | Produção |
|-------|----------|
| Menu bot *ticket* / *chamado* / `TK-…` | `TicketClientMenuService` — sem env extra |
| IA classifica intenção antes de gravar | `AiTicketAssistService` + `ticket-client-intent` — requer IA ativa; KB/skills opcionais |
| SLA resposta equipe | `InboxSettings.ticketTeamResponseHours` (default 24h); campos `teamSlaDueAt` / `teamSlaBreachedAt` |
| Status enriquecidos painel | `ticket-display-status.ts` — `displayStatus` derivado |
| Testes mínimos | `npm test -- --testPathPattern="ticket-client-intent|AiTicketAssist|ticket-display|inbound-routing"` |

Doc: `docs/TICKET-ATENDIMENTO.md` (§ Assistente inteligente, § SLA equipe).

---

### 4. E-mail convite equipe — ✅ implementado (2.2.2)

| Local | Produção |
|-------|----------|
| Dev sem env → log no console | `RESEND_API_KEY` **ou** SMTP |
| `POST /team/members` | Envia HTML + link `/auth/google` |
| Reenvio na UI | `POST /team/members/:id/resend-invite` |

**Env:** `RESEND_API_KEY`, `MAIL_FROM=noreply@seudominio.com`  
**Ou SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE=false`

---

### 5. Mobile

| Local | Produção |
|-------|----------|
| Teste no DevTools | Teste real iOS/Android; PWA opcional |

Sem mudança de infra — só frontend.

---

### 6. Billing

| Local | Produção |
|-------|----------|
| `ALLOW_DEV_BILLING=true` | `false` — só checkout Stripe real |
| Planos alterados manualmente no admin | Webhook Stripe → `Organization.plan` + `BillingOrder` |
| Sem bloqueio por vencimento | `canSendMessage()` bloqueia se `planExpiresAt` passou |

**Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `SUBSCRIPTION_SWEEP_MS`

**Webhook:** `POST https://<host>/api/billing/webhook/stripe` — eventos `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`

Ver `docs/BILLING.md`.

---

### 7. WhatsApp Cloud API (Meta) — 🟡 pendente implementação

> **Status hoje:** apenas **Baileys** (QR + `./sessions`). Cloud API é alvo para plano **Enterprise** — mesma API REST interna (`/api`, Inbox, campanhas), canal escolhido por organização.

| | **Local (dev)** | **Produção (Cloud API)** |
|---|-----------------|---------------------------|
| Conexão | Baileys + QR em `/sessions` | **Sem QR** — WABA + `phone_number_id` + token permanente |
| Credenciais | Arquivos em `./sessions/` | Secrets por org no Mongo (criptografados) |
| Webhook inbound | Baileys socket | **HTTPS público** — Meta envia mensagens/status |
| Envio fora janela 24h | Baileys livre | **Templates** aprovados pela Meta |
| Status / stories | Baileys | API separada ou indisponível no Cloud |
| Infra | RAM + volume `sessions/` | Só HTTP — sem Chromium/Baileys por sessão Cloud |

#### Pré-requisitos Meta (antes de produção)

1. [Meta Business Suite](https://business.facebook.com/) — conta verificada
2. App em [developers.facebook.com](https://developers.facebook.com/) com produto **WhatsApp** ativo
3. **WhatsApp Business Account (WABA)** vinculada ao app
4. Número de telefone registrado na WABA (ou número de teste Meta em dev)
5. **System User** + token permanente **ou** Embedded Signup (OAuth Meta por tenant Enterprise)
6. App em modo **Live** (não só Development) para clientes reais

#### Variáveis de ambiente (plataforma)

| Variável | Local | Produção |
|----------|-------|----------|
| `META_APP_ID` | app dev Meta | app **Live** |
| `META_APP_SECRET` | dev | secret produção — **nunca** no frontend |
| `WHATSAPP_CLOUD_VERIFY_TOKEN` | string qualquer dev | string longa única — usada no handshake GET do webhook |
| `WHATSAPP_CLOUD_API_VERSION` | `v21.0` (ou atual Meta) | fixar versão testada antes de deploy |
| `WHATSAPP_DEFAULT_CHANNEL` | `baileys` | `baileys` até org Enterprise migrar |

**Por organização (Mongo, não `.env`):** `wabaId`, `phoneNumberId`, `accessToken` (criptografado com `SESSION_ENCRYPTION_KEY`), `channel: 'baileys' | 'cloud'`.

#### Webhook Meta (obrigatório em produção)

| Método | URL alvo | Função |
|--------|----------|--------|
| `GET` | `https://<host>/api/integrations/whatsapp/cloud/webhook` | Verificação (`hub.mode`, `hub.verify_token`, `hub.challenge`) |
| `POST` | mesma URL | Mensagens inbound, status de entrega, erros |

**Configurar no Meta Developer → WhatsApp → Configuration:**

- **Callback URL:** `https://app.seudominio.com/api/integrations/whatsapp/cloud/webhook`
- **Verify token:** mesmo valor de `WHATSAPP_CLOUD_VERIFY_TOKEN`
- **Campos assinados:** `messages`, `message_template_status_update` (mínimo); incluir `message_echoes` se multi-device

**Infra (igual Stripe billing):**

- Rota webhook com **body raw** para validar `X-Hub-Signature-256` (HMAC SHA256 com `META_APP_SECRET`)
- Reverse proxy **não** deve reescrever nem consumir o body antes do Node
- Só **HTTPS** — Meta rejeita HTTP em produção

#### Arquitetura alvo no RadarZap

```
Organization.channel = baileys | cloud
        ↓
WhatsAppChannelProvider (interface)
   ├── BaileysProvider   ← hoje (WhatsAppService)
   └── CloudApiProvider  ← Enterprise (fetch graph.facebook.com)
        ↓
Inbox / campanhas / /api/integrations/*  (mesmo contrato)
```

Implementação prevista: fase 5 em `INBOX-ATENDIMENTO.md`. Até lá, **todas** as orgs usam Baileys.

#### Onboarding tenant Enterprise (fluxo produção)

1. Org com plano `enterprise` (manual ou contrato)
2. Admin abre **Sessões WhatsApp** → escolhe **Cloud API (Meta)**
3. Embedded Signup Meta **ou** cola `phone_number_id` + token permanente
4. RadarZap registra webhook na WABA e testa envio template `hello_world`
5. Inbox passa a receber via POST webhook (não via Baileys)
6. Baileys da mesma org **desativado** — um número = um canal

#### Envio e templates (regras Meta)

| Cenário | Baileys (hoje) | Cloud API (produção) |
|---------|----------------|----------------------|
| Resposta Inbox &lt; 24h | texto livre | texto livre |
| Campanha / reengajamento | texto livre | **template** aprovado + variáveis |
| Mídia | Baileys download/upload | `media_id` via Graph API |
| Opt-out LGPD | consentimento RadarZap | + políticas template Meta |

Catálogo de templates: criar no Meta Business Manager; IDs referenciados nas campanhas RadarZap.

#### Checklist go-live Cloud API

- [ ] Business verification Meta concluída
- [ ] App WhatsApp em modo Live
- [ ] Webhook GET verificado (Meta mostra ✓)
- [ ] POST de teste recebido e persistido no Inbox
- [ ] Token permanente ou refresh documentado; rotação planejada
- [ ] `SESSION_ENCRYPTION_KEY` definida antes de gravar tokens por org
- [ ] Rate limit Meta (tier messaging) monitorado em `/admin/monitoring`
- [ ] Plano Enterprise + `canSendMessage()` ativo para a org
- [ ] Runbook: token revogado → alerta + reconexão Embedded Signup

#### Migração Baileys → Cloud (mesmo número)

1. Backup Mongo + export contatos (`/settings/backup`)
2. Desconectar sessão Baileys (libera número na Meta se necessário)
3. Registrar número na WABA Cloud
4. Criar sessão `channel=cloud` no painel
5. Validar Inbox + campanha teste com template
6. Manter volume `./sessions/` até confirmar — depois arquivar pasta da org

#### Dev local com Cloud API (opcional)

- Usar **número de teste** Meta + app Development
- [ngrok](https://ngrok.com/) ou Cloudflare Tunnel → expor `localhost:3001` para webhook GET/POST
- `WHATSAPP_DEFAULT_CHANNEL=cloud` só em org de teste — demais orgs continuam Baileys
- **Não** commitar tokens Meta; usar `.env` local

#### Referências internas

- Roadmap feature: `ROADMAP-COMPLETUDE.md` §7
- Inbox / canal: `INBOX-ATENDIMENTO.md` fase 5
- Baileys hoje: seção **WhatsApp Baileys em produção** abaixo

---

### 8. Backup tenant — ✅ hardening v2.5.2

| Local | Produção |
|-------|----------|
| Export JSON em plain | `BACKUP_ENCRYPT_EXPORT=true` → arquivo `{ format: "radarzap-backup-encrypted", ciphertext }` |
| Import sem validação guild | Canais Discord de guild **não vinculada** à org são ignorados |
| Sem trilha | `tenant.backup.export` / `tenant.backup.import` em `auditLogs` |
| Export manual | S3/R2 para arquivos; retenção 30 dias |

Detalhes de criptografia e restore: **§8 Segurança**.

---

### 9. Testes

| Local | Produção |
|-------|----------|
| `npm test` manual | CI bloqueia merge se test falhar |
| Sem E2E | Playwright contra staging |

---

### 10. Admin observabilidade

| Local | Produção |
|-------|----------|
| `/admin/monitoring` básico | Prometheus/Grafana ou uptime externo |
| Alertas no log | Slack webhook / PagerDuty |

**Novas env:** `ALERT_SLACK_WEBHOOK_URL`, `SENTRY_DSN` (opcional)

---

## OAuth em produção

1. Discord Developer Portal → Redirects: `https://app.seudominio.com/auth/discord/callback`
2. Google Cloud Console → Redirect: `https://app.seudominio.com/auth/google/callback`
3. `FRONTEND_URL` e `CORS_ORIGIN` = mesmo domínio HTTPS
4. Cookie de sessão: `secure: true` em produção (ver config auth)

---

## WhatsApp Baileys em produção

> Canal **padrão hoje** (Starter / Pro). Enterprise pode migrar para Cloud API — ver §7 acima.

- Servidor com RAM suficiente (sessões Baileys + Chromium se headless pesado)
- Volume **persistente** para `sessions/` — recriar QR perde conexões
- `SESSION_ENCRYPTION_KEY` **nunca** trocar sem migração planejada
- Firewall: não expor portas internas; só 443 público
- Monitorar desconexão 401 → evento `session.disconnected` (futuro webhook)

---

## §8 Segurança em produção

> Hardening aplicado no código (v2.5.2+). Itens abaixo são **obrigatórios só em staging/prod** — dev local permanece permissivo.

### Secrets e flags

| Item | Dev local | Staging / produção |
|------|-----------|---------------------|
| `SESSION_ENCRYPTION_KEY` | string dev | **≥ 32 caracteres únicos** — sessões WA, webhook secrets no Mongo, backup criptografado |
| `BACKUP_ENCRYPT_EXPORT` | `false` / ausente | `true` |
| `ALLOW_DEV_BILLING` | pode ser `true` | **bloqueado** se `NODE_ENV=production` |
| `ALLOW_DEV_API_KEY_BYPASS` | só dev isolado | **nunca** definir |
| `JWT_SECRET` / `SESSION_SECRET` | dev | rotacionar; nunca reusar v1 |

Rotacionar todos os valores do `.env.example` antes do go-live.

### Rede e bind

- **Node** escuta em `127.0.0.1:3001` (ou socket Unix) — **não** expor `3001` na internet.
- **nginx / Caddy / Cloudflare** na frente: HTTPS `:443`, proxy `/api` e upgrade WebSocket Socket.IO.
- **MongoDB** e **Redis**: rede interna/VPC; portas `27017` / `6379` **sem** bind público.
- **CORS** em produção: rejeita requisições sem header `Origin` em rotas sensíveis; `CORS_ORIGIN` = `FRONTEND_URL`.
- Mutações do painel (`POST`/`PATCH`/`DELETE` em `/api`): `requireDashboardOrigin` bloqueia cross-origin (exceto webhooks Stripe/Meta).

Exemplo nginx (trecho):

```nginx
server {
  listen 443 ssl http2;
  server_name app.seudominio.com;

  location / {
    root /var/www/radarzap/public;
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

PM2 sem Docker: `API_HOST=127.0.0.1` (ou variável equivalente no `.env` de deploy).

### Redis com senha

```yaml
# docker-compose.prod.yml (trecho — Redis interno)
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass "${REDIS_PASSWORD}"
    volumes:
      - redis_data:/data
    networks:
      - internal
    # ports: NÃO publicar 6379

  app:
    build:
      dockerfile: docker/Dockerfile.monolith
    environment:
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      NODE_ENV: production
      BACKUP_ENCRYPT_EXPORT: "true"
    volumes:
      - wa_sessions:/app/sessions
      - wa_media:/app/media
    networks:
      - internal
    # ports: NÃO publicar 3001 — só proxy reverso na rede host
```

### Docker monolito (non-root)

`docker/Dockerfile.monolith` roda como usuário `radarzap` (UID 1001). Volumes `sessions/` e `media/` devem ser graváveis por esse UID no host ou via `user:` no compose.

### Criptografia de dados

| Dado | Comportamento |
|------|----------------|
| Webhook secret (Mongo) | AES-256-CBC com `SESSION_ENCRYPTION_KEY`; plain retornado **uma vez** no `POST /integrations/webhooks` |
| Export backup tenant | Com `BACKUP_ENCRYPT_EXPORT=true`, JSON com `ciphertext`; import descriptografa automaticamente |
| Sessões Baileys | Já criptografadas com a mesma chave |

**Não rotacionar** `SESSION_ENCRYPTION_KEY` após WA conectado sem plano de migração.

### API e painel (já no código)

- Helmet + headers de segurança + rate limit em `/auth` e `/api`
- Erros 5xx genéricos em produção (`productionSafeError`)
- Socket.IO: eventos de tenant só na room `tenant:{clientId}`
- IDOR: rotas `rules`, `channels`, `sessions/:id/groups` filtradas por `clientId`
- `GET /sessions/:id/connect` desabilitado em produção — usar `POST` (painel já compatível)
- Logs: redação de e-mail/telefone; secrets de webhook não aparecem em listagens

### Webhooks e integrações

- URLs de webhook cliente: **somente HTTPS**
- Assinatura HMAC com secret descriptografado no dispatcher
- CI: `npm audit --omit=dev --audit-level=high` bloqueia vulnerabilidades em dependências de runtime

### RBAC e auditoria

- Revisar `RADARZAP_SYSTEM_ADMIN_DISCORD_IDS` antes do go-live
- Export/import de backup gera entrada em `auditLogs`
- Backups Mongo **antes** de deploy com migration de schema

### Scan de secrets (recomendado no CI)

Adicionar job opcional com [gitleaks](https://github.com/gitleaks/gitleaks) ou GitHub secret scanning no repositório — não substitui revisão manual de `.env` e `sessions/`.

### Checklist rápido §8

- [ ] `SESSION_ENCRYPTION_KEY` forte e em secrets manager
- [ ] `BACKUP_ENCRYPT_EXPORT=true`
- [ ] Redis com `requirepass`; `REDIS_URL` com senha
- [ ] Mongo/Redis/Node sem porta pública
- [ ] HTTPS + `COOKIE_SECURE=true`
- [ ] `ALLOW_DEV_*` ausentes em prod
- [ ] Smoke: criar webhook, exportar backup, importar em org de teste

Documentação complementar: `SECURITY.md`, `SECURITY_AUDIT.md`, `SECURITY_CHECKLIST.md`.

---

## Rollback

1. Manter imagem/tag anterior no registry
2. Restore Mongo snapshot se migration falhou
3. `sessions/` volume intacto ao rollback de código (compatível)

---

## Referências

- Dev local: `RADARZAP-V2-MIGRACAO.md`
- Roadmap features: `ROADMAP-COMPLETUDE.md`
- **Deploy teste → produção: §2 deste documento**
- **Segurança: §8 deste documento**
- Cloud API Meta: **§7 deste documento**
- Billing Stripe: `BILLING.md`
- Mapa rotas: `MENU-PAGES-REGISTRY.md`
