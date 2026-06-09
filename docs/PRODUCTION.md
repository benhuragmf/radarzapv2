# RadarZap v2 — local → produção

> Tudo que muda entre **desenvolvimento local** e **ambiente de produção**.  
> Atualizar ao implementar itens do `ROADMAP-COMPLETUDE.md`.

**Última revisão:** 2026-06-05 (Cloud API §7 expandido)

---

## Ambientes hoje

| | **Local (dev)** | **Produção (alvo)** |
|---|-----------------|---------------------|
| Backend | `npm run dev` → `src/index.ts` (ts-node-dev) | Processo Node compilado (`npm run build` + `node dist/index.js`) ou container |
| Painel | `npm run dashboard:frontend` → Vite `:5174` | Build estático (`npm run build` no frontend) servido por nginx ou pelo DashboardService |
| API painel | `start-dashboard.ts` → `:3001` (dev separado) | Mesmo processo ou reverse proxy `/api` |
| MongoDB | Docker `:27017` ou `npm run docker:infra` | MongoDB Atlas / VPS gerenciado, auth, backup |
| Redis | Docker `:6380` → container `:6379` | Redis gerenciado ou container com persistência |
| Sessões WA | Pasta `./sessions/` local | Volume persistente + `SESSION_ENCRYPTION_KEY` forte |
| OAuth | `FRONTEND_URL=http://localhost:5174` | HTTPS domínio real; redirects Google/Discord atualizados |
| Cookies | Same-site localhost | `Secure`, `SameSite`, domínio produção |

**Importante:** o `docker-compose.yml` raiz descreve **microserviços** (api-gateway, discord-bot, whatsapp-service…). O fluxo diário v2 usa **`npm run dev`** monolítico + infra Docker. Antes de produção, **unificar** qual topologia será oficial (monolito vs microserviços) e documentar aqui.

---

## Checklist mínimo para subir produção

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
| `SESSION_ENCRYPTION_KEY` | dev | **Obrigatório** — perda = sessões WA inválidas |
| `FRONTEND_URL` | `http://localhost:5174` | `https://app.seudominio.com` |
| `CORS_ORIGIN` | localhost | mesmo domínio HTTPS do painel |
| `DISCORD_*` / `GOOGLE_*` | dev apps | apps produção; redirects HTTPS |
| `LOG_LEVEL` | `info` / `pretty` | `info` / `json` |
| `WHATSAPP_HEADLESS` | `true` | `true` |
| `RATE_LIMIT_*` | relaxado | ajustar por plano/tráfego |
| `META_*` / `WHATSAPP_CLOUD_*` | vazio (só Baileys) | Enterprise — ver **§7** |

**Nunca** commitar `.env` ou `sessions/`.

### Build

```bash
npm run build
npm run build --prefix src/services/web-dashboard/frontend
```

Servir `frontend/dist` atrás do mesmo host ou CDN.

### Processo

- [ ] PM2, systemd ou container com `restart: unless-stopped`
- [ ] Health check: `GET /api/services/health`
- [ ] Logs centralizados (arquivo rotacionado ou serviço externo)
- [ ] **Não** rodar `auto-setup` do docker-compose em produção junto com dev (cria segundo bot)

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

### 2. Deploy + CI/CD — 🟡 parcial

| Local | Produção |
|-------|----------|
| CI: `.github/workflows/ci.yml` roda em push/PR | Adicionar deploy job (Railway/Fly/VM) quando `npm run build` backend passar |
| `npm run dev` + Vite | PM2/systemd ou container |
| Docker só infra (`npm run docker:infra`) | Compose prod sem expor Mongo/Redis |

**Pendente CI:** `npm run lint`, `npm run build` backend (corrigir TS InboxService).

---

### 3. Inbox SLA / inatividade

| Local | Produção |
|-------|----------|
| Cron manual / dev | Job scheduler (BullMQ repeatable ou cron container) |
| Timezone dev | `inboxSettings.timezone` = `America/Sao_Paulo` por tenant |

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

### 8. Backup tenant

| Local | Produção |
|-------|----------|
| Export manual | S3/R2 para arquivos de backup; retenção 30 dias |
| Restore local | Restore só por admin ou dono; audit log |

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

## Segurança produção

- Rotacionar todos os secrets do `.env.example` (nunca reutilizar v1)
- Rate limit ativo na API pública (`X-API-Key`)
- Webhooks clientes: só HTTPS
- RBAC: revisar `RADARZAP_SYSTEM_ADMIN_DISCORD_IDS`
- Backups Mongo antes de deploy com migration de schema

---

## Rollback

1. Manter imagem/tag anterior no registry
2. Restore Mongo snapshot se migration falhou
3. `sessions/` volume intacto ao rollback de código (compatível)

---

## Referências

- Dev local: `RADARZAP-V2-MIGRACAO.md`
- Roadmap features: `ROADMAP-COMPLETUDE.md`
- Cloud API Meta (produção): **§7 deste documento**
- Billing Stripe: `BILLING.md`
- Mapa rotas: `MENU-PAGES-REGISTRY.md`
