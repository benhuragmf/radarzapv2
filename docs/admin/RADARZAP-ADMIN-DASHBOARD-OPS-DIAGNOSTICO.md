# RadarZap — Admin Dashboard Ops — Diagnóstico

**Etapa:** 1 — somente leitura (sem implementação)  
**Data:** 2026-06-27  
**Versão do código analisado:** `2.12.37` (`package.json`) — Etapa 2 implementada (`GET /api/admin/ops/summary`)  
**Status documental TOP 20:** `PRONTO PARA QA MANUAL` (congelamento em `2.12.6`) — **produção estável não declarada**

> **Nota de versão:** o brief desta auditoria cita `2.12.6` (TOP 20). O repositório local está em `2.12.36` (`develop`, commit `e870632`) com correções pós-congelamento (Inbox, fallback WebChat, assets estáticos). O diagnóstico reflete o **código atual**, não apenas o snapshot TOP 20.

---

## Resumo executivo

A rota `/admin/dashboard` existe e renderiza um painel **minimalista** (`AdminDashboard.tsx`) com 4 cards operacionais + saúde Mongo/Redis, alimentado por `GET /api/admin/monitoring`. A maior parte das métricas desejadas para **ops global** já existe **espalhada** em outras rotas admin (`/admin/integrations-overview`, `/admin/servers-summary`, `/admin/errors`, `/billing/admin/orders`, `/admin/ai-platform/usage`, `/users`) ou só no escopo **tenant** (`/platform/stats`, `/platform/health/atendimento`, supervisor Inbox). Não há endpoint dedicado `GET /admin/dashboard/ops` nem agregação billing/trial/atendimento global.

**Lacuna principal:** o dashboard admin não consolida empresas por status comercial, atendimento (fila/tickets/leads), IA créditos agregados, nem infra avançada (CPU/RAM/uptime versionado). **Risco principal:** divergência de capabilities (`dashboard:global` na rota vs `logs:global` na API de dados) e endpoints públicos/sem auth (`/api/services/health`) fora do escopo admin.

**Próximo passo recomendado:** Etapa 3 — evoluir UI `/admin/dashboard` para consumir `GET /api/admin/ops/summary`. Ver [`RADARZAP-ADMIN-DASHBOARD-OPS.md`](./RADARZAP-ADMIN-DASHBOARD-OPS.md).

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `develop` |
| HEAD | `e870632` — `fix: copiar assets webchat/leads para dist no build (v2.12.36)` |
| Untracked (não versionados) | `data/`, `docs/RADARZAP-PLANO-UPGRADES.md`, `docs/qa-results/`, `docs/referencias/`, `mocker/modelochat/` |
| Alterações staged | nenhuma relacionada a admin dashboard |

Últimos commits relevantes: `2.12.35` fallback WA, `2.12.33` Inbox timers/presença, `2.12.32` receipts — pós-TOP 20.

---

## Rota atual /admin/dashboard

| Aspecto | Detalhe |
|---------|---------|
| **URL painel** | `/admin/dashboard` |
| **Registro React** | `App.tsx` → `<Route path="admin/dashboard" … AdminDashboard />` |
| **Guard** | `ProtectedRoute` + `ROUTE_PERMISSIONS['/admin/dashboard']` = `dashboard:global` |
| **Menu** | `ADMIN_RADARZAP_NAV` e `MODERATOR_ADMIN_NAV` — item "Dashboard global" |
| **Layout** | Aba **Admin RadarZap** (`navConfig.ts` — `pathname.startsWith('/admin/')`) |
| **API consumida** | `GET /api/admin/monitoring` (não há rota `/admin/dashboard` no backend) |
| **Refetch** | 30 s (`useQuery` + `refetchInterval`) |

---

## Frontend atual

### Componente

- **Arquivo:** `src/services/web-dashboard/frontend/src/pages/admin/AdminDashboard.tsx`
- **Design system:** `RadarPageShell`, `PageHeader`, `MetricCard`, `LoadingState`, `Card`

### UI exibida

| Elemento | Conteúdo |
|----------|----------|
| Cards (grid 2×2 / lg 4 col) | `totalMessages`, `activeSessions`, `pendingJobs`, `failedJobs` |
| Infra | MongoDB / Redis boolean |
| Links | `/admin/monitoring`, `/admin/clients` |

### O que **não** tem

- Tabelas, filtros por empresa/período, gráficos (`messagesPerHour` existe na API mas não é renderizado)
- Cards de organizações, API keys, billing, Stripe, atendimento, IA
- **Error state** — falha na query não exibe mensagem (só loading ou dados vazios)
- **Empty state** dedicado (zeros são aceitos)
- Timestamp da API (`timestamp` retornado mas não exibido)

### Responsividade

- `grid-cols-2 lg:grid-cols-4` — responsivo básico

### Páginas admin relacionadas (não são o dashboard)

| Rota | Componente | API principal |
|------|------------|---------------|
| `/admin/monitoring` | `pages/menu/AdminMonitoring.tsx` | `GET /admin/monitoring` — lista **todas** chaves de `stats` |
| `/admin/clients` | `pages/admin/AdminClients.tsx` | `GET /users` |
| `/admin/api` | `pages/menu/AdminApiPage.tsx` | `GET /admin/integrations-overview` |
| `/admin/servers` | `AdminServers.tsx` | `GET /admin/servers-summary` |
| `/admin/payments` | `AdminPaymentsPage.tsx` | `GET /billing/admin/orders` |
| `/admin/errors` | `AdminErrors.tsx` | `GET /admin/errors` |
| `/admin/queue` | `Queue.tsx` | `GET /queue`, `/queue/failed` |
| `/admin/ai-platform` | — | `GET /admin/ai-platform/usage` |

---

## Backend atual

### Endpoint principal do dashboard

```http
GET /api/admin/monitoring
```

- **Capability:** `logs:global` (`Cap.LOGS_GLOBAL`)
- **Implementação:** `DashboardService.ts` → `buildStats()` + health Mongo/Redis
- **Resposta:**

```json
{
  "health": { "mongodb": true, "redis": true },
  "stats": {
    "totalMessages", "activeSessions", "pendingJobs", "failedJobs",
    "organizations", "apiKeysActive", "messagesPerHour"
  },
  "timestamp": "ISO-8601"
}
```

### `buildStats()` — origem dos números

| Campo | Fonte |
|-------|-------|
| `totalMessages` | Soma `User.usage.messagesUsed` (legado por usuário, não por org) |
| `activeSessions` | `WhatsAppSession.countDocuments({ status: 'active' })` |
| `pendingJobs` / `failedJobs` | `QueueManager.getQueueStats()` — soma BullMQ |
| `organizations` | `Organization.countDocuments()` |
| `apiKeysActive` | `ApiKey.countDocuments({ active: true })` |
| `messagesPerHour` | Agregação `SystemLog` últimas 24 h (`Message sent successfully`) |

### Health alternativo (sem auth admin)

```http
GET /api/services/health
```

Retorna `{ healthy: true, uptime: process.uptime() }` — **sem capability**, exposto ao router principal.

### Stats tenant (não admin global)

- `GET /api/stats` — `dashboard:view` — mesmo `buildStats()` (confuso para tenant)
- `GET /api/platform/stats` — stats por `clientId` autenticado
- `GET /api/platform/health/atendimento` — `inbox:view` — **por tenant** (`buildAttendanceHealth`)

---

## RBAC e segurança

### Papéis staff

| Papel | Enum | Capabilities |
|-------|------|--------------|
| Superadmin | `SystemRole.SYSTEM_ADMIN` | `ALL_CAPABILITIES` — `can()` retorna true para tudo |
| Moderador | `SystemRole.SYSTEM_MODERATOR` | `SYSTEM_MODERATOR_CAPS` — inclui `dashboard:global`, `logs:global`, `queue:global`, `system:users:view`, etc. |

Atribuição superadmin: env `RADARZAP_SYSTEM_ADMIN_DISCORD_IDS` (`GuildMembershipSync.ts`).

### Capabilities admin relevantes

| Capability | Uso |
|------------|-----|
| `dashboard:global` | Rota `/admin/dashboard` (frontend) |
| `logs:global` | `/admin/monitoring`, `/admin/errors`, `/admin/integrations-overview` |
| `system:users:view` | `/admin/clients` → `GET /users` |
| `system:servers:view` | `/admin/servers-summary` |
| `system:payments:view` | `/billing/admin/orders` |
| `system:plans:manage` | `/admin/plans`, `PATCH /admin/organizations/:id/plan` |
| `system:settings:manage` | IA plataforma, blueprint, settings |
| `system:audit:view` | `/admin/audit-logs` |
| `system:moderation:action` | `/admin/organizations`, moderação |

### Divergência de permissões (risco)

- **Página** `/admin/dashboard` exige `dashboard:global`
- **Dados** exigem `logs:global`
- Moderador tem **ambas** — funciona hoje
- Usuário com só `dashboard:global` (hipotético) veria página vazia/403 na API

### Cross-tenant

Rotas admin listadas consultam Mongo **sem filtro `clientId`** — correto para staff, desde que capability seja verificada. `GET /users` expõe e-mail e Discord ID — aceitável para ops interno, **não** para embed público.

### O que **não** expor (regra TOP 18)

`.env`, Stripe secret, webhook secret, keys OpenAI/Gemini, `SESSION_ENCRYPTION_KEY`, JWT, QR WhatsApp, cookies, tokens ticket, payload Stripe bruto. Helpers: `mask-secret.util.ts`, redact em `AuditLog`/`AttendanceEvent` na **escrita** — leitura de logs antigos pode ainda conter meta sensível se pré-TOP 18.

---

## APIs admin existentes

| Método | Rota | Capability | Descrição |
|--------|------|------------|-----------|
| GET | `/admin/monitoring` | `logs:global` | Stats + health (usado pelo dashboard) |
| GET | `/admin/integrations-overview` | `logs:global` | API keys, webhooks, orgs, pedidos pagos, `stripeMode` |
| GET | `/admin/errors` | `logs:global` | SystemLog `level:error` 24 h |
| GET | `/admin/organizations` | `system:moderation:action` | Lista orgs (limite 200) |
| PATCH | `/admin/organizations/:id/plan` | `system:plans:manage` | Override plano org |
| GET | `/admin/servers-summary` | `system:servers:view` | WA sessions, Discord guilds |
| GET | `/admin/audit-logs` | `system:audit:view` | AuditLog global |
| GET | `/billing/admin/orders` | `system:payments:view` | Pedidos billing |
| GET | `/users` | `system:users:view` | Usuários + plano |
| PUT | `/users/:id/plan` | `system:plans:manage` | Override plano usuário |
| GET/PATCH | `/admin/ai-platform/*` | `system:settings:manage` | Credenciais IA plataforma + usage |
| GET/PATCH | `/admin/ai-blueprint` | `system:settings:manage` | Modelo global IA |
| GET/PATCH | `/admin/whatsapp-send-policy` | `system:settings:manage` | Política envio WA sistema |
| POST | `/admin/destinations/:id/block` | `consent:manual-block` | Bloqueio manual destino |
| GET | `/queue` | `queue:view` **ou** `platform:reports:view` | Stats BullMQ por fila |
| GET | `/queue/failed` | `queue:view` | Jobs falhos (pode incluir `data` do job) |
| GET | `/services/health` | *(nenhuma)* | Uptime público |

---

## Modelos disponíveis

Campos úteis para métricas ops (sem expor segredos):

| Modelo | Campos / uso ops |
|--------|------------------|
| `Organization` | `plan`, `planExpiresAt`, `stripeSubscriptionStatus`, `stripePastDueAt`, `aiWallet`, `usage`, `createdAt` |
| `CompanyMember` | `organizationId`, `companyRole`, `isActive` — contagem membros/atendentes |
| `User` | `systemRole`, `plan`, `primaryOrganizationId`, `usage.messagesUsed` |
| `WhatsAppSession` | `clientId`, `status` (`active/inactive/expired`) — **não** expor `sessionData` |
| `WebChatWidget` | `clientId`, `active`, `publicKey` (mascarar) |
| `LeadForm` | `clientId`, `active` |
| `LeadCapture` | `clientId`, `createdAt`, `status` — leads por período |
| `InboxConversation` | `clientId`, `status`, `queueEnteredAt`, `csatPending` |
| `InboxTicket` | `clientId`, `status`, `unreadClientReply` |
| `WebChatConversation` | `clientId`, `queueStatus`, `whatsappBridgeActive` |
| `AiUsage` | `clientId`, `creditWeight`, `usageKind`, `createdAt` |
| `BillingOrder` | `organizationId`, `status`, `orderKind`, `planId`, `paidAt` |
| `AttendanceEvent` | `clientId`, `kind` — eventos críticos agregáveis |
| `AuditLog` | `action`, `actorUserId`, `createdAt` — sem vazar `details` sensíveis |
| `Destination` | `clientId`, `consent`, classificação comercial |
| `ApiKey` / `WebhookEndpoint` | contagens ativas |
| `SystemLog` | erros operacionais |
| `MessageQueue` | fila campanhas tenant |

---

## Métricas já disponíveis

Classificação conforme checklist:

| Métrica | Status | Onde |
|---------|--------|------|
| Sessões WA ativas | **Já existe** | `buildStats.activeSessions`, `servers-summary.connectedSessions` |
| Fila BullMQ pendente/falha | **Já existe** | `buildStats.pendingJobs/failedJobs`, `GET /queue` |
| Mongo ping | **Já existe** | `/admin/monitoring.health.mongodb` |
| Redis ping | **Já existe** | `/admin/monitoring.health.redis` |
| Total organizações (número) | **Existe parcial** | `buildStats.organizations`, `integrations-overview` — **não no UI dashboard** |
| Chaves API ativas | **Existe parcial** | `buildStats.apiKeysActive`, `/admin/api` |
| Pedidos pagos (count) | **Existe parcial** | `integrations-overview.billingOrdersPaid` |
| Stripe modo test/live | **Existe parcial** | `integrations-overview.stripeMode` (derivado do prefixo da key — sem expor key) |
| Erros sistema 24 h | **Existe parcial** | `/admin/errors` |
| Mensagens/hora 24 h | **Existe parcial** | `buildStats.messagesPerHour` — só em `/admin/monitoring` como lista de chaves |
| Uptime Node | **Existe parcial** | `/services/health` (público) |
| Discord guilds/canais | **Existe parcial** | `/admin/servers-summary` |

---

## Métricas faltantes

| Métrica | Status | Observação |
|---------|--------|------------|
| Total empresas (UI dashboard) | **Existe parcial** | API sim, UI não |
| Empresas trial | **Não existe** | `trial` só no catálogo (`plan-config`); `Organization.plan` não inclui `trial` — inferir via `stripeSubscriptionStatus=trialing` ou regra manual |
| Empresas pagas / free / expiradas / past_due | **Pode ser calculada** | `normalizeBillingStatus()` + agregação `Organization` |
| Usuários por empresa | **Pode ser calculada** | `CompanyMember.aggregate` |
| Atendentes online (global) | **Não existe** | Presença Redis por org (`inbox-agent-presence`) — supervisor é tenant-scoped |
| WA conectado vs desconectado (detalhe) | **Existe parcial** | Total vs `connectedSessions`; sem breakdown por org no dashboard |
| Widgets WebChat ativos | **Pode ser calculada** | `WebChatWidget.countDocuments({ active: true })` |
| Formulários leads ativos | **Pode ser calculada** | `LeadForm.countDocuments({ active: true })` |
| Leads hoje/mês | **Pode ser calculada** | `LeadCapture` por `createdAt` |
| Tickets abertos (global) | **Pode ser calculada** | `InboxTicket` por `status` |
| Conversas em fila (global) | **Pode ser calculada** | `InboxConversation` + `WebChatConversation` status fila |
| IA créditos consumidos (plataforma) | **Existe parcial** | `/admin/ai-platform/usage` — só uso de keys da plataforma |
| Empresas sem crédito IA | **Pode ser calculada** | `Organization.aiWallet` + limites catálogo — **Evitar por custo** se scan full collection |
| Stripe status agregado | **Não existe** | Só `stripeMode` + pedidos; sem contagem `past_due` global |
| CPU/RAM/disco | **Não existe** | `HealthMonitor` / `MonitoringController` no monolith — não exposto ao painel admin |
| Versão `package.json` | **Não existe** | Pode injetar em build (`process.env` ou import version) |
| `NODE_ENV` | **Não existe** | Omitir ou mostrar só `development/production` sem secrets |
| Últimos eventos críticos | **Existe parcial** | `AttendanceEvent` / alertas críticos tenant — sem feed global admin |
| `totalMessages` (card atual) | **Existe parcial** | Métrica legado por `User`, pode divergir de org/`Organization.usage` |

| Métrica | Evitar por custo |
|---------|------------------|
| Scan full `AiUsage` + wallet todas orgs em tempo real | Preferir agregação incremental ou cache Redis |
| Listar todas conversas ativas globalmente | Usar `$count` indexado por `status` |
| Jobs falhos com `data` completo | Mascarar payload no admin queue |

---

## Trial e billing atual

- **Catálogo:** `config/plans.json` + `plan-config.ts` — plano `trial` (100 créditos IA, não checkout Stripe).
- **Persistência org:** `Organization.plan` ∈ `free|starter|pro|enterprise` — **sem** valor `trial` no schema.
- **Stripe:** `stripeSubscriptionStatus`, `planExpiresAt`, `stripePastDueAt` — helper `normalizeBillingStatus()` / `billing-state.util.ts`.
- **Grace `past_due`:** 3 dias (`BILLING_GRACE_PERIOD_DAYS`).
- **Admin UI:** `/admin/payments` (pedidos), `/admin/plans` (override manual), `/admin/api` (pedidos pagos + stripe mode).
- **Doc:** `docs/BILLING.md`, TOP 17 — **sem** endpoint admin de KPIs trial/paid/past_due agregados.

---

## WhatsApp e sessões atuais

- **Modelo:** `WhatsAppSession` — `status`, `clientId`, `sessionData` criptografado (**nunca** expor).
- **Admin:** `/admin/sessions` (componente `Sessions.tsx`), `/admin/servers-summary`.
- **Métricas:** `activeSessions` (Mongo `status: active`) vs `connectedSessions` (mesmo filtro em servers-summary).
- **Runtime:** `WhatsAppService.isClientConnected(clientId)` — tenant only.
- **Política global:** `/admin/whatsapp-send-policy`.

---

## IA Créditos atual

- **Tenant:** `/platform/ai/balance`, `/platform/ai/usage` — `inbox:ai:*`.
- **Admin plataforma:** `/admin/ai-platform/usage` — consumo keys RadarZap (não agrega todas empresas).
- **Modelo:** `Organization.aiWallet`, `AiUsage.creditWeight`.
- **Doc:** `docs/IA-CREDITOS-E-CARTEIRA.md`.
- **Dashboard admin:** não exibe créditos.

---

## Inbox, tickets e leads atual

| Domínio | Escopo atual | Admin global |
|---------|--------------|--------------|
| Inbox fila/atendimento | Supervisor tenant `/inbox/supervisor/*` | **Não** |
| Tickets | Tenant APIs + painel plataforma | **Não** |
| Leads | Tenant `/leads/*`, stats por org | **Não** |
| WebChat | Tenant `/platform/webchat` | **Não** |
| Health atendimento | `GET /platform/health/atendimento` por `clientId` | **Não** |

Métricas de atendimento existem e estão maduras **por empresa**; falta camada agregadora cross-tenant para ops.

---

## Saúde servidor atual

| Sinal | Disponível | Auth |
|-------|------------|------|
| Mongo/Redis boolean | `/admin/monitoring` | `logs:global` |
| BullMQ por fila | `/queue` | `queue:view` |
| Uptime | `/services/health` | nenhuma |
| Heap/memory | `MonitoringController`, `HealthMonitor` (código) | não wired ao dashboard |
| CPU/disco host | **Não** | — |

---

## Mongo, Redis e filas atual

- **Mongo:** `DatabaseManager.getInstance().isConnected()` no monitoring.
- **Redis:** `RedisManager.getInstance().isConnected()` + presença Inbox + filas BullMQ via `QueueManager`.
- **Filas:** stats agregados em `buildStats`; detalhe em `/admin/queue` e `/admin/monitoring`.
- **Risco:** `GET /queue/failed` retorna `data` do job — revisar mascaramento na Etapa 2.

---

## Riscos identificados

1. **Capability mismatch** — rota `dashboard:global` vs API `logs:global`.
2. **`/services/health` público** — vaza uptime (baixo risco, fora do padrão admin).
3. **`totalMessages` enganoso** — soma usage por `User`, não reflete ops multi-tenant atual.
4. **Sem error UI** — falha silenciosa no dashboard admin.
5. **PII em `/users` e `/admin/clients`** — e-mail, Discord ID, `_id` — OK para staff, proibir export/copy em ops summary público.
6. **Jobs falhos** — payload BullMQ pode conter destinos/mensagens.
7. **AuditLog read** — redact na write; registros legados podem ter meta sensível.
8. **Agregações cross-tenant** — risco de performance se implementadas com full scan sem índices/cache.
9. **Versão doc desatualizada** — `SISTEMA-REGISTRO.md` em `2.12.19` vs código `2.12.36`.

---

## Proposta de implementação por etapas

### Etapa 2 — Backend agregador seguro

- Criar `GET /api/admin/ops/summary` com cap **`dashboard:global`** (e reutilizar queries existentes).
- Agregações: orgs por `normalizeBillingStatus`, WA sessions, widgets/leads ativos, fila inbox (`$count`), tickets abertos, BullMQ, health, versão app.
- Cache Redis TTL 30–60 s para queries pesadas.
- Mascarar: sem keys, QR, tokens, stripe payloads; `stripeMode` ok; contagem `past_due` ok.

### Etapa 3 — Frontend dashboard ops

- Evoluir `AdminDashboard.tsx`: seções Billing, Atendimento, IA, Infra.
- Reutilizar `MetricCard`; gráfico opcional `messagesPerHour`.
- Error/empty states; alinhar capability rota = API.
- Link cards → páginas admin existentes.

### Etapa 4 — Eventos críticos

- Feed top N `AttendanceEvent` kinds críticos + `SystemLog` error (24 h), meta redacted.
- Opcional: integrar alertas similares ao sino tenant (`panel-critical-alerts`) em visão global.

### Etapa 5 — Infra avançada (opcional pós-QA)

- Expor heap/uptime/version em `/admin/ops/summary` only (auth).
- CPU/disco via agente host ou Prometheus — **fora** do monolith se possível.

### Etapa 6 — QA e docs

- Testes agregação + RBAC cross-tenant denial.
- Atualizar `MENU-PAGES-REGISTRY.md`, `CHANGELOG`, versão patch.
- QA manual bloco admin no roteiro Fase 1.

---

## Arquivos analisados

### Frontend

- `src/services/web-dashboard/frontend/src/App.tsx`
- `src/services/web-dashboard/frontend/src/pages/admin/AdminDashboard.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/AdminMonitoring.tsx`
- `src/services/web-dashboard/frontend/src/pages/menu/AdminApiPage.tsx`
- `src/services/web-dashboard/frontend/src/pages/admin/AdminClients.tsx`
- `src/services/web-dashboard/frontend/src/lib/navConfig.ts`
- `src/services/web-dashboard/frontend/src/components/ProtectedRoute.tsx`
- `src/services/web-dashboard/frontend/src/lib/auth.ts`

### Backend

- `src/services/web-dashboard/DashboardService.ts` (`buildStats`, rotas `/admin/*`)
- `src/services/web-dashboard/routes/dashboardQueueRoutes.ts`
- `src/services/attendance/attendance-health.service.ts`
- `src/services/billing/billing-state.util.ts`
- `src/services/billing/plan-config.ts`
- `src/auth/rbac/capabilities.ts`, `can.ts`, `roles.ts`

### Modelos

- `Organization`, `User`, `CompanyMember`, `WhatsAppSession`, `WebChatWidget`, `LeadForm`, `LeadCapture`
- `InboxConversation`, `InboxTicket`, `WebChatConversation`, `AiUsage`, `BillingOrder`
- `AttendanceEvent`, `AuditLog`, `Destination`, `ApiKey`, `SystemLog`

### Documentação lida / referenciada

- `docs/RADARZAP-SISTEMA-COMPLETO.md` (estrutura geral)
- `docs/RADARZAP-RESULTADO-FINAL-TOP-01-20.md`
- `docs/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`
- `docs/SISTEMA-REGISTRO.md`
- `docs/INDICE-DOCUMENTACAO.md`
- `docs/BILLING.md`
- `docs/IA-CREDITOS-E-CARTEIRA.md`
- `docs/INBOX-ATENDIMENTO.md` (supervisor tenant)
- `docs/WEBCHAT.md`
- `docs/EQUIPE-RBAC.md`
- `docs/top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md` (mascaramento)

---

## Próximo passo recomendado

**Etapa 2:** implementar `GET /api/admin/ops/summary` (agregador RBAC-safe, cache, sem segredos) e alinhar capability do dashboard; depois evoluir UI em Etapa 3. Manter status **PRONTO PARA QA MANUAL** — não declarar produção até QA A–J + gate estabilização (`ROADMAP-COMPLETUDE.md`).
