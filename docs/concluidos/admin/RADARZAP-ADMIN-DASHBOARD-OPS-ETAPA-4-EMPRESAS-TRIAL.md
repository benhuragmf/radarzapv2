# RadarZap — Admin Dashboard Ops — Etapa 4 — Empresas, Trial e Plano

**Data:** 2026-06-27  
**Versão após Etapa 4:** `2.12.39`  
**Branch:** `develop`  
**Status:** ✅ Concluída (código local; **sem push**)

---

## Resumo executivo

A **Etapa 4** adicionou **listagem paginada de organizações** e **ações staff de trial/plano manual** na aba **Empresas** do `/admin/dashboard`, integradas ao summary global (`GET /api/admin/ops/summary`).

**Entregue:** API paginada com filtros, mutações com audit, invalidação de cache do summary, UI com tabela/modais/filtros, permissão read-only para moderator, sanitização de nomes sensíveis.

**Não entregue:** checkout Stripe, chamadas Stripe real, feed global de eventos críticos (Etapa 5), gráficos históricos.

**Status release:** `PRONTO PARA QA MANUAL` — produção estável **não** declarada.

**Gates (entrega):** typecheck, build backend/frontend, `npm test -- admin-ops` (25), E2E `admin-dashboard.spec.ts` (24/24) — verdes.

---

## Herança das etapas anteriores

### Etapa 1 — Diagnóstico

- Doc: [`RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md)

### Etapa 2 — Backend summary

- `GET /api/admin/ops/summary` — `2.12.37`

### Etapa 3 — Frontend dashboard

- 8 abas, cards, alertas — [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-3-FRONTEND-DASHBOARD.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-3-FRONTEND-DASHBOARD.md) — `2.12.38`

### Esta etapa fecha

- Listagem paginada de orgs na aba Empresas
- Filtros plano / status / busca por nome
- Ações: estender trial, alterar plano, cancelar trial
- AuditLog + invalidação cache summary
- Testes unit + E2E

### Esta etapa não faz

- Deploy / push / Stripe live
- Expor `stripeSubscriptionId`, e-mail owner, sessionData, QR
- Alterar schema Mongo

---

## Estado Git

| Item | Valor |
|------|-------|
| Branch | `develop` |
| Versão | `2.12.39` (`package.json`) |
| Arquivo doc | `docs/admin/RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md` |
| Commit | pendente (aguardando autorização) |

---

## Endpoints backend

| Método | Rota | Capability |
|--------|------|------------|
| GET | `/api/admin/ops/organizations` | `dashboard:global` |
| PATCH | `/api/admin/ops/organizations/:id/plan` | `system:plans:manage` |
| POST | `/api/admin/ops/organizations/:id/trial/extend` | `system:plans:manage` |
| POST | `/api/admin/ops/organizations/:id/trial/cancel` | `system:plans:manage` |

### Query params (listagem)

| Param | Regra |
|-------|-------|
| `page` | default 1 |
| `limit` | default 25, max 100 |
| `plan` | free \| starter \| pro \| enterprise |
| `status` | billing status normalizado |
| `search` | nome org, max 80 chars |
| `sort` | createdAt \| name \| planExpiresAt |

### Row pública (`AdminOpsOrganizationRow`)

`id`, `name`, `plan`, `billingStatus`, `planExpiresAt`, `createdAt`, `stripeModeHint`, `waConnected`, `membersCount`

**Omitido:** owner, e-mail, Discord, `stripeSubscriptionId`, sessionData, tokens, wallet IA.

### Mutações — regras

| Ação | Regras principais |
|------|-------------------|
| **PATCH plan** | `reason` 5–300 chars; free limpa expiração; audit `admin.plan.changed` |
| **POST trial/extend** | `days` 1–90; free → starter default; `planExpiresAt` += days; audit `admin.trial.extended` |
| **POST trial/cancel** | downgrade free; preserva dados; audit `admin.trial.cancelled` |

Toda mutação chama `invalidateAdminOpsSummaryCache()` (Redis `radarzap:admin:ops:summary:v1`).

Endpoint legado `PATCH /api/admin/organizations/:id/plan` **mantido**.

---

## Frontend

| Item | Detalhe |
|------|---------|
| **Componente** | `AdminOpsTenantsPanel.tsx` |
| **Integração** | aba **Empresas** em `AdminOpsDashboardView.tsx` |
| **Cards agregados** | mantidos (`summary.tenants`) |
| **Tabela** | Empresa, Plano, Status, Expira, Criada, WA, Ações |
| **Filtros** | busca debounce 300ms, plano, status, paginação |
| **Modais** | estender trial (+7/+14/+30), alterar plano, cancelar trial |
| **Permissão UI** | sem `system:plans:manage` → somente leitura |
| **Sanitização** | `sanitizeOpsDisplayText` em nomes de org |
| **Pós-ação** | toast + invalidate summary + lista |

---

## RBAC

| Papel | Listagem | Mutações |
|-------|----------|----------|
| `SYSTEM_ADMIN` | Sim | Sim |
| `SYSTEM_MODERATOR` | Sim | Não (read-only) |
| Tenant comum | 403 | 403 |

---

## Testes

| Arquivo | Cenários |
|---------|----------|
| `admin-ops-organizations.service.test.ts` | paginação, filtros, plan/trial/cancel, audit, motivo |
| `admin-ops-summary.rbac.test.ts` | dashboard:global |
| `e2e/admin-dashboard.spec.ts` | tabela, filtros, modal, moderator read-only, 500, secrets |

**Total admin-ops:** 25 testes · **E2E:** 24/24

---

## Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test -- admin-ops` | Verde (25) |
| `npm run build --prefix …/frontend` | Verde |
| `npx playwright test e2e/admin-dashboard.spec.ts` | Verde (24) |

---

## Arquivos alterados

### Backend

| Arquivo | Papel |
|---------|-------|
| `src/types/admin-ops-organizations.ts` | Contrato |
| `src/services/web-dashboard/admin-ops-organizations.service.ts` | Listagem + mutações |
| `src/services/web-dashboard/admin-ops-summary.service.ts` | `invalidateAdminOpsSummaryCache` |
| `src/services/web-dashboard/DashboardService.ts` | Rotas |

### Frontend

| Arquivo | Papel |
|---------|-------|
| `frontend/.../AdminOpsTenantsPanel.tsx` | UI tabela + modais |
| `frontend/.../AdminOpsDashboardView.tsx` | Aba Empresas |

### Testes / E2E

| Arquivo | Papel |
|---------|-------|
| `__tests__/admin-ops-organizations.service.test.ts` | Unit |
| `e2e/admin-dashboard.spec.ts` | Playwright |
| `e2e/fixtures/mock-admin-ops-api.ts` | Mock orgs |

### Documentação

| Arquivo | Papel |
|---------|-------|
| `docs/admin/RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md` | **Este doc** |
| `docs/concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS.md` | Módulo arquivado |
| `docs/CHANGELOG.md` | § 2.12.39 |
| `docs/SISTEMA-REGISTRO.md` | Registro |

---

## Riscos restantes

- Override manual de plano pode divergir de assinatura Stripe real.
- Filtro `status` usa scan em memória quando informado (monitorar escala).
- Moderator não executa mutações (by design).

---

## Decisões registradas

1. Trial manual em org `free` → promove para **starter** por default.
2. Moderator: listagem sim, mutações não (`system:plans:manage` só admin).
3. Endpoint legado `/admin/organizations` mantido.

---

## Próximo passo recomendado

**Etapa 5** — Feed global eventos críticos (`AttendanceEvent` + `SystemLog` 24h) na aba Segurança — opcional.

---

*Doc de entrega Etapa 4 · padrão TOP (mesma série que Etapa 3) · enviar ao GPT Code como contexto da implementação concluída.*
