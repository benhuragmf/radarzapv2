# RadarZap v2 — local → produção

> Tudo que muda entre **desenvolvimento local** e **ambiente de produção**.  
> Atualizar ao implementar itens do `ROADMAP-COMPLETUDE.md`.

**Última revisão:** 2026-06-05

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
| Planos alterados manualmente no admin | Stripe/Asaas webhook → atualiza `Organization.plan` |
| Sem bloqueio | Middleware bloqueia envio se plano vencido |

**Novas env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (ou equivalente Asaas)

---

### 7. WhatsApp Cloud API

| Local | Produção |
|-------|----------|
| Baileys + QR | Meta Business, WABA ID, token permanente, webhook verify token |
| Sessão em `./sessions` | Credenciais Cloud em secrets; webhook público HTTPS |

**Novas env:** `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_CLOUD_VERIFY_TOKEN`, `WHATSAPP_CLOUD_API_VERSION`

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
- Mapa rotas: `MENU-PAGES-REGISTRY.md`
