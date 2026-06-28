# Entrega Admin Dashboard Ops — 2.12.37–2.12.38

**Versão produto:** `2.12.38` · **Data doc:** 2026-06-27  
**Escopo:** Etapas 1–3 — diagnóstico, backend agregador seguro, frontend dashboard operacional completo em `/admin/dashboard`.

Documento **técnico e operacional** para handoff (GPT Code / próxima etapa). Complementa [`RADARZAP-ADMIN-DASHBOARD-OPS.md`](./admin/RADARZAP-ADMIN-DASHBOARD-OPS.md) (doc de módulo arquivado).

**Status release:** `PRONTO PARA QA MANUAL` — produção estável **não** declarada · deploy **não** executado · Stripe live **não** ativar.

---

## Índice

1. [Mapa de versões e commits](#1-mapa-de-versões-e-commits)
2. [Etapa 1 — Diagnóstico](#2-etapa-1--diagnóstico)
3. [Etapa 2 — Backend `GET /api/admin/ops/summary`](#3-etapa-2--backend-get-apiadminopssummary)
4. [Etapa 3 — Frontend `/admin/dashboard`](#4-etapa-3--frontend-admindashboard)
5. [Contrato `AdminOpsSummary`](#5-contrato-adminopssummary)
6. [RBAC e segurança](#6-rbac-e-segurança)
7. [Alertas operacionais](#7-alertas-operacionais)
8. [Testes automatizados](#8-testes-automatizados)
9. [Arquivos alterados](#9-arquivos-alterados)
10. [O que NÃO foi feito](#10-o-que-não-foi-feito)
11. [Próxima etapa recomendada](#11-próxima-etapa-recomendada)
12. [QA manual sugerido](#12-qa-manual-sugerido)

---

## 1. Mapa de versões e commits

| Versão | Entrega | Commit |
|--------|---------|--------|
| **2.12.37** | Backend agregador `GET /api/admin/ops/summary` | `313c8f2` |
| **2.12.38** | Frontend dashboard ops completo | `7f712eb` |

| Etapa | Doc |
|-------|-----|
| 1 — Diagnóstico | [`RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md`](./admin/RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md) |
| 2–3 — Implementação | [`RADARZAP-ADMIN-DASHBOARD-OPS.md`](./admin/RADARZAP-ADMIN-DASHBOARD-OPS.md) |
| Changelog | [`CHANGELOG.md`](../CHANGELOG.md) § 2.12.37–2.12.38 |

---

## 2. Etapa 1 — Diagnóstico

### Problema

`/admin/dashboard` era minimalista e consumia `GET /api/admin/monitoring` (cap `logs:global`), enquanto a rota exigia `dashboard:global` — mismatch de capability.

### Achados

- Métricas ops espalhadas em várias rotas admin; sem agregador cross-tenant dedicado.
- Falta de error state no dashboard; falha silenciosa possível.
- Risco de expor segredos se agregador não sanitizar (QR, sessionData, keys Stripe, etc.).

### Saída

Relatório completo em `docs/concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md` com proposta de Etapas 2–6.

---

## 3. Etapa 2 — Backend `GET /api/admin/ops/summary`

### Endpoint

```http
GET /api/admin/ops/summary
GET /api/admin/ops/summary?refresh=1
```

| Item | Valor |
|------|-------|
| Capability | `dashboard:global` (`Cap.DASHBOARD_GLOBAL`) |
| Serviço | `src/services/web-dashboard/admin-ops-summary.service.ts` |
| Alertas | `src/services/web-dashboard/admin-ops-alerts.util.ts` |
| Rota | `DashboardService.ts` |
| Tipo | `src/types/admin-ops-summary.ts` |
| Cache | Redis TTL 30s (`radarzap:admin:ops:summary:v1`); `?refresh=1` ignora cache |

### Blocos retornados

| Bloco | Conteúdo |
|-------|----------|
| `system` | versão app, `NODE_ENV`, uptime, memória Node, load CPU |
| `services` | Mongo, Redis, filas BullMQ (waiting/active/failed/delayed/paused) |
| `tenants` | orgs por plano e status billing normalizado |
| `operations` | WhatsApp, WebChat, Inbox, tickets, leads |
| `ai` | créditos mês, calls premium/básica, orgs low/exhausted |
| `billing` | stripe mode, pedidos, past_due |
| `security` | contagens 24h (erros, ticket lookup, form block, billing limit) |
| `alerts` | alertas sanitizados (`buildAdminOpsAlerts`) |
| `links` | atalhos rotas admin existentes |

### Não exposto (por design)

Chaves Stripe/OpenAI/Gemini, webhook secret, JWT, encryption keys, `sessionData`, QR, tokens TK, cookies, Authorization, `job.data`, `meta` bruto de audit/eventos, hostname.

---

## 4. Etapa 3 — Frontend `/admin/dashboard`

### Migração de dados

| Antes | Depois |
|-------|--------|
| `GET /api/admin/monitoring` | `GET /api/admin/ops/summary` |
| UI minimalista | `AdminOpsDashboardView.tsx` — 8 abas |

### Painel

| Item | Detalhe |
|------|---------|
| Rota | `/admin/dashboard` |
| Query | `AdminDashboard.tsx` — React Query `refetchInterval: 30_000` |
| View | `AdminOpsDashboardView.tsx` |
| Refresh | Botão **Atualizar** → `?refresh=1` |
| Legado | Link **Monitoramento legado** → `/admin/monitoring` |

### Abas

1. **Visão geral** — cards principais, alertas, TOP20, links rápidos  
2. **Infra** — system, Mongo, Redis, filas  
3. **Empresas** — bloco `tenants`  
4. **Atendimento** — WA, WebChat, Inbox, tickets, leads  
5. **Billing** — stripe mode, pedidos, past_due (avisos off/live)  
6. **IA** — créditos e calls; fallback “Não calculado nesta etapa” se `undefined`  
7. **Segurança** — bloco `security` + lista `alerts`  
8. **Go-live** — checklist informativo TOP20 (somente leitura)

### Cards principais (visão geral)

Status geral (OK/Atenção/Crítico), Empresas, WhatsApp, Atendimento, Leads, IA Créditos + linha infra (Sistema, Memória, Mongo, Redis, Filas, Billing).

### UX

- Loading, error (“Não foi possível carregar o Dashboard Ops.” + **Tentar novamente**), empty fallback  
- `generatedAt` visível  
- Números PT-BR, uptime formatado, memória em MB  
- Badges versão / ambiente / status geral  
- Alertas ordenados: critical → warning → info  
- Sanitização UI: `src/types/admin-ops-summary.util.ts` (`sanitizeOpsDisplayText`)

### Estados React Query

```typescript
// AdminDashboard.tsx
queryKey: ['admin-ops-summary']
queryFn: () => api.get<AdminOpsSummary>('/admin/ops/summary')
refetchInterval: 30_000
```

---

## 5. Contrato `AdminOpsSummary`

Arquivo: `src/types/admin-ops-summary.ts`

Frontend importa via alias `@radarzap-types/admin-ops-summary`.

Campos principais:

```typescript
interface AdminOpsSummary {
  generatedAt: string;
  system: { version, nodeEnv, uptimeSeconds, nodeVersion, memoryMb, cpu? };
  services: { mongo, redis, queues };
  tenants: { totalOrganizations, freeOrganizations, starterOrganizations, proOrganizations, enterpriseOrganizations, paidOrganizations, expiredOrganizations, pastDueOrganizations, trialingOrganizations };
  operations: { whatsapp, webchat, inbox, tickets, leads };
  ai: { creditsConsumedThisMonth, organizationsWithLowCredits?, organizationsWithoutCredits?, premiumCallsThisMonth, basicLlmCallsThisMonth };
  billing: { stripeMode, pendingOrders, paidOrdersThisMonth, failedInvoicesThisMonth, pastDueOrganizations };
  security: { errorsLast24h, invalidTicketLookupsLast24h, formBlocksLast24h, billingLimitBlocksLast24h, webhookFailuresLast24h };
  alerts: AdminOpsAlert[];
  links: { monitoring, clients, payments, servers, errors, queue, aiPlatform };
}
```

---

## 6. RBAC e segurança

| Papel | Acesso summary |
|-------|----------------|
| `SYSTEM_ADMIN` | Sim |
| `SYSTEM_MODERATOR` | Sim (`dashboard:global`) |
| Owner/Admin/Manager/Atendente tenant | Não |
| Sem sessão | 401/403 |

**Correção vs diagnóstico:** endpoint alinhado à rota `/admin/dashboard` (`dashboard:global`). `/admin/monitoring` permanece com `logs:global`.

### Frontend — nunca renderizar

`.env`, `STRIPE_SECRET_KEY`, `whsec_`, `sk_test_`, `sk_live_`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `SESSION_ENCRYPTION_KEY`, `JWT_SECRET`, QR, `sessionData`, `Authorization`, `Cookie`, `publicAccessToken`, payload webhook bruto, `job.data`.

Teste E2E valida mock malicioso não aparece no DOM.

---

## 7. Alertas operacionais

Gerados por `buildAdminOpsAlerts()`:

1. Mongo down/degraded  
2. Redis down/degraded  
3. Filas `failed > 0`  
4. WA desconectado > conectado (quando há sessões)  
5. Organizações `past_due`  
6. Orgs sem crédito IA (`ai.credits.exhausted`)  
7. Stripe `off` em `NODE_ENV=production`  
8. Stripe `live` (info — revisar QA)  
9. Erros sistema 24h > 0  
10. QA manual TOP 20 pendente (fixo documental)

Status geral UI = maior severidade entre `alerts` (Crítico > Atenção > OK).

---

## 8. Testes automatizados

| Tipo | Arquivo | Escopo |
|------|---------|--------|
| Backend unit | `src/services/web-dashboard/__tests__/admin-ops-summary.service.test.ts` | Agregador |
| Backend unit | `src/services/web-dashboard/__tests__/admin-ops-alerts.util.test.ts` | Alertas |
| Util | `src/types/__tests__/admin-ops-summary.util.test.ts` | Formatadores + sanitização |
| E2E Playwright | `e2e/admin-dashboard.spec.ts` | UI completa mock auth |
| Fixture E2E | `e2e/fixtures/mock-admin-ops-api.ts` | Mock summary + malicioso |

### Cenários E2E (7 testes)

1. Admin abre `/admin/dashboard` — cards principais  
2. Abas Infra, Empresas, Atendimento, Billing, Segurança  
3. TOP20 + alertas na visão geral  
4. Botão Atualizar refetch  
5. API 500 → error state  
6. Strings sensíveis ausentes no DOM  
7. Usuário sem permissão bloqueado (guard existente)

### Gates executados (entrega)

```bash
npm run typecheck
npm run build
npm test -- admin-ops
npm run build --prefix src/services/web-dashboard/frontend
npx playwright test e2e/admin-dashboard.spec.ts
```

---

## 9. Arquivos alterados

### Backend

| Arquivo | Papel |
|---------|-------|
| `src/types/admin-ops-summary.ts` | Contrato TypeScript |
| `src/types/admin-ops-summary.util.ts` | Formatadores PT-BR + sanitização |
| `src/services/web-dashboard/admin-ops-summary.service.ts` | Agregador + cache |
| `src/services/web-dashboard/admin-ops-alerts.util.ts` | Alertas |
| `src/services/web-dashboard/DashboardService.ts` | Rota registrada |

### Frontend

| Arquivo | Papel |
|---------|-------|
| `frontend/src/pages/admin/AdminDashboard.tsx` | Query React |
| `frontend/src/pages/admin/AdminOpsDashboardView.tsx` | UI abas + cards |

### Testes

| Arquivo | Papel |
|---------|-------|
| `e2e/admin-dashboard.spec.ts` | E2E |
| `e2e/fixtures/mock-admin-ops-api.ts` | Fixtures |
| `src/types/__tests__/admin-ops-summary.util.test.ts` | Unit util |
| `src/services/web-dashboard/__tests__/admin-ops-*.test.ts` | Unit backend |

### Documentação

| Arquivo | Papel |
|---------|-------|
| `docs/concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md` | Etapa 1 |
| `docs/concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS.md` | Módulo arquivado |
| `docs/concluidos/ENTREGA-ADMIN-DASHBOARD-OPS-2.12.37-38.md` | Este doc (handoff) |
| `docs/CHANGELOG.md` | 2.12.37–2.12.38 |
| `docs/SISTEMA-REGISTRO.md` | Registro versão |

---

## 10. O que NÃO foi feito

- Listagem individual de empresas no dashboard  
- Ações trial/plano (liberar, estender, cancelar)  
- Ações administrativas mutáveis  
- Alteração de schema / billing real / Stripe live  
- Deploy / push (salvo autorização)  
- OpenAPI do summary  
- Gráficos históricos  
- Presença global de atendentes  
- `webhookFailuresLast24h` = 0 no backend (sem fonte global ainda)

---

## 11. Próxima etapa recomendada

**Etapa 4 — Listagem empresas + ações trial/plano**

- Tabela paginada de orgs no dashboard  
- Filtros por plano/status/trial  
- Ações staff (estender trial, etc.) com audit  
- Manter RBAC `dashboard:global` ou caps específicas por ação

Referência diagnóstico: [`RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md`](./admin/RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md) § Etapa 4.

---

## 12. QA manual sugerido

1. Login como `SYSTEM_ADMIN` ou `SYSTEM_MODERATOR`  
2. Abrir `/admin/dashboard` — verificar cards e abas  
3. Clicar **Atualizar** — `generatedAt` muda  
4. Desligar Mongo local — alerta crítico aparece (dev)  
5. Confirmar link **Monitoramento legado** abre `/admin/monitoring`  
6. Confirmar tenant comum **não** acessa `/admin/dashboard`  
7. Aba Go-live mostra `PRONTO PARA QA MANUAL` — sem botões de mudança de status  
8. Inspecionar DOM — ausência de keys/tokens/QR  

---

*Handoff Etapas 1–3 concluídas · branch `develop` · commits `313c8f2` + `7f712eb` · sem push automático.*
