# RadarZap — Admin Dashboard Ops — Etapa 3 — Frontend Dashboard Operacional

**Data:** 2026-06-27  
**Versão após Etapa 3:** `2.12.38`  
**Branch:** `develop`  
**Commit:** `7f712eb` — `feat(admin): dashboard ops frontend with global summary (v2.12.38)`

---

## Resumo executivo

A **Etapa 3** transformou `/admin/dashboard` de painel minimalista (4 cards + Mongo/Redis via `/admin/monitoring`) em **dashboard operacional completo** consumindo `GET /api/admin/ops/summary` (Etapa 2, `2.12.37`).

**Entregue:** 8 abas, cards principais + infra, alertas ordenados, status TOP20 informativo, links rápidos, loading/error/empty, refetch 30s, botão Atualizar com `?refresh=1`, sanitização anti-segredo, E2E Playwright (7 cenários).

**Não entregue nesta etapa:** listagem individual de empresas, ações trial/plano, gráficos históricos, feed global de eventos críticos.

**Status release:** `PRONTO PARA QA MANUAL` — produção estável **não** declarada.

**Gates (entrega):** typecheck, build backend, build frontend, `npm test -- admin-ops`, E2E `admin-dashboard.spec.ts` — verdes.

---

## Herança das etapas anteriores

### Etapa 1 — Diagnóstico

- Doc: [`RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md)
- Achado: dashboard minimalista; mismatch capability rota vs API legada; métricas espalhadas.

### Etapa 2 — Backend summary

- Versão: `2.12.37` · commit `313c8f2`
- `GET /api/admin/ops/summary` + cache Redis 30s
- Cap `dashboard:global`
- Blocos: `system`, `services`, `tenants`, `operations`, `ai`, `billing`, `security`, `alerts`, `links`

### Esta etapa fecha

- Migração frontend para novo endpoint
- UI completa com abas e cards
- Estados UX (loading, error, empty)
- Sanitização de alertas no DOM
- Testes E2E admin dashboard
- Link legado para `/admin/monitoring`

### Esta etapa não faz

- Listagem/ações trial por empresa → **Etapa 4** — [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md)
- Ações administrativas mutáveis (liberar plano, etc.)
- Deploy / push / Stripe live
- Alteração de schema ou billing real

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `develop` |
| Commit base (Etapa 2) | `313c8f2` — ops summary backend (v2.12.37) |
| Commit entrega Etapa 3 | `7f712eb` — dashboard ops frontend (v2.12.38) |
| Untracked (não commitar) | `data/`, `mocker/modelochat/` |
| Risco | Baixo — só frontend + util compartilhado |

---

## Escopo autorizado

Frontend `/admin/dashboard`, tipos/util compartilhados, testes unit util + E2E, documentação.

**Proibido:** fallback silencioso para `/admin/monitoring`; expor secrets; declarar produção pronta.

---

## Diagnóstico — antes vs depois

| Aspecto | Antes (Etapa 1) | Depois (Etapa 3) |
|---------|-----------------|------------------|
| API consumida | `GET /admin/monitoring` | `GET /admin/ops/summary` |
| Componente UI | `AdminDashboard.tsx` inline | `AdminDashboard.tsx` + `AdminOpsDashboardView.tsx` |
| Abas | Nenhuma | 8 abas |
| Cards | 4 (messages, sessions, jobs) | 6 principais + 6 infra |
| Error state | Ausente | `ErrorState` + retry |
| Refetch | 30s | 30s + botão `?refresh=1` |
| Alertas | Não | Lista ordenada por severidade |
| TOP20 / go-live | Não | Seções informativas |
| Segurança UI | N/A | `sanitizeOpsDisplayText` |
| E2E dedicado | Não | `e2e/admin-dashboard.spec.ts` |

---

## Migração de fonte de dados

### AdminDashboard.tsx

| Item | Valor |
|------|-------|
| Query key | `['admin-ops-summary']` |
| Endpoint | `api.get('/admin/ops/summary')` |
| Refetch | `refetchInterval: 30_000` |
| Refresh manual | `GET /admin/ops/summary?refresh=1` → `setQueryData` |
| Fallback erro refresh | `refetch()` |

**Removido:** consumo de `/admin/monitoring` como fonte principal (sem fallback silencioso em erro).

---

## Layout e abas implementadas

### Topo

| Elemento | Detalhe |
|----------|---------|
| Título | Admin Dashboard |
| Subtítulo | Saúde do sistema, empresas, trial, billing e operação RadarZap |
| Badges | versão, `nodeEnv`, status geral (OK/Atenção/Crítico) |
| Timestamp | `generatedAt` formatado PT-BR |
| Botão | **Atualizar** (`data-testid="admin-ops-refresh"`) |

Status geral derivado de `deriveOverallStatus(alerts)` — maior severidade entre alertas.

### Abas (`role="tablist"`)

| Aba | Conteúdo |
|-----|----------|
| **Visão geral** | Cards principais + infra; alertas; TOP20; links rápidos |
| **Infra** | Cards infra + painel detalhado sistema/serviços |
| **Empresas** | Agregados `tenants` (sem listagem individual) |
| **Atendimento** | WA, WebChat, Inbox, tickets, leads |
| **Billing** | Stripe mode, pedidos, past_due; avisos off/live |
| **IA** | Créditos, orgs low/exhausted, calls premium/básica |
| **Segurança** | Contagens 24h + alertas |
| **Go-live** | Checklist informativo TOP20 (somente leitura) |

### Linha 1 — Cards principais (`admin-ops-main-cards`)

1. Status geral + count críticos  
2. Empresas (total, pagas, trialing)  
3. WhatsApp (conectadas, off/exp)  
4. Atendimento (abertas, fila, tickets)  
5. Leads (hoje, mês, forms)  
6. IA Créditos (consumo mês, orgs sem crédito)

### Linha 2 — Infra (`admin-ops-infra-cards`)

Sistema, Memória, Mongo, Redis, Filas, Billing.

Visível nas abas **Visão geral** e **Infra**.

### Links rápidos (`summary.links`)

Monitoramento legado, Clientes, Pagamentos, Servidores, Erros, Filas, IA Plataforma.

---

## UX e estados

| Estado | Implementação |
|--------|---------------|
| Loading | `LoadingState` + `data-testid="admin-ops-loading"` |
| Error | “Não foi possível carregar o Dashboard Ops.” + **Tentar novamente** |
| Empty | `EmptyState` se payload ausente |
| Formatação | PT-BR — `formatOpsNumber`, `formatOpsUptime`, `formatOpsDate` |
| Memória | MB (heap, RSS) |
| Responsivo | Grid 2→3→6 colunas; `maxWidth="wide"` |

---

## Segurança frontend

Util: `src/types/admin-ops-summary.util.ts`

| Função | Papel |
|--------|-------|
| `sanitizeOpsDisplayText` | Omite padrões sensíveis → `[conteúdo omitido]` |
| `sortAlertsBySeverity` | critical → warning → info |

**Nunca renderizar:** keys Stripe, OpenAI, Gemini, JWT, `sessionData`, QR, tokens, Authorization, Cookie.

E2E valida mock malicioso: `sk_test_`, `whsec_`, `sessionData` ausentes no HTML.

---

## Componentes design system

Reutilizados de `@/design-system`:

`RadarPageShell`, `PageHeader`, `MetricCard`, `SectionCard`, `StatusBadge`, `LoadingState`, `EmptyState`, `ErrorState`, `Card`.

---

## Testes criados ou atualizados

| Arquivo | Cenários |
|---------|----------|
| `src/types/__tests__/admin-ops-summary.util.test.ts` | Formatadores, status, sanitização |
| `e2e/admin-dashboard.spec.ts` | 7 cenários (cards, abas, TOP20, refresh, 500, secrets, guard) |
| `e2e/fixtures/mock-admin-ops-api.ts` | `MOCK_ADMIN_OPS_SUMMARY`, mock malicioso, setup mocks |

### Cenários E2E

1. Admin abre `/admin/dashboard` — cards principais  
2. Abas Infra, Empresas, Atendimento, Billing, Segurança  
3. TOP20 + alertas na visão geral  
4. Botão Atualizar incrementa chamadas API  
5. API 500 → error state  
6. Strings sensíveis omitidas no DOM  
7. Tenant comum bloqueado pelo `ProtectedRoute`

---

## Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test -- admin-ops` | Verde |
| `npm run build --prefix src/services/web-dashboard/frontend` | Verde |
| `npx playwright test e2e/admin-dashboard.spec.ts` | Verde (7/7) |

---

## Arquivos alterados

### Frontend

| Arquivo | Papel |
|---------|-------|
| `frontend/src/pages/admin/AdminDashboard.tsx` | Query React Query |
| `frontend/src/pages/admin/AdminOpsDashboardView.tsx` | UI completa (novo) |

### Tipos / util

| Arquivo | Papel |
|---------|-------|
| `src/types/admin-ops-summary.util.ts` | Formatadores + sanitização (novo) |
| `src/types/__tests__/admin-ops-summary.util.test.ts` | Testes util (novo) |

### E2E

| Arquivo | Papel |
|---------|-------|
| `e2e/admin-dashboard.spec.ts` | Spec Playwright (novo) |
| `e2e/fixtures/mock-admin-ops-api.ts` | Fixtures mock (novo) |

### Documentação

| Arquivo | Papel |
|---------|-------|
| `docs/concluidos/admin/RADARZAP-ADMIN-DASHBOARD-OPS.md` | Módulo arquivado |
| `docs/admin/RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-3-FRONTEND-DASHBOARD.md` | Este doc |
| `docs/CHANGELOG.md` | § 2.12.38 |
| `docs/SISTEMA-REGISTRO.md` | Linha 2.12.38 |
| `docs/RADARZAP-SISTEMA-COMPLETO.md` | Referência admin ops |

### Dependência Etapa 2 (não alterada neste commit)

| Arquivo | Papel |
|---------|-------|
| `src/types/admin-ops-summary.ts` | Contrato API |
| `src/services/web-dashboard/admin-ops-summary.service.ts` | Agregador |
| `src/services/web-dashboard/admin-ops-alerts.util.ts` | Alertas |

---

## Riscos reduzidos

- Falha na API não deixa tela vazia — error state explícito.
- Capability alinhada: rota e summary usam `dashboard:global`.
- Conteúdo malicioso em alertas não vaza para DOM.
- Staff vê visão consolidada cross-tenant sem navegar 7 páginas admin.

---

## Riscos restantes

- Aba Empresas só agregados — sem ação por org (Etapa 4).
- `/admin/monitoring` legado ainda existe em paralelo.
- Agregação backend pode pesar em escala (cache 30s mitiga parcialmente).
- `webhookFailuresLast24h` = 0 no backend (sem fonte global).
- Sem gráficos históricos.

---

## Decisões pendentes para Benhur

1. Remover ou redirecionar `/admin/monitoring` após QA?
2. Unificar `/admin/clients` (Users) com visão Organizations na Etapa 4?
3. Incluir bloco admin no roteiro QA manual Fase 1?

---

## Próximo passo recomendado

**Etapa 4** — Listagem paginada de empresas + ações trial/plano no dashboard.

Spec de implementação: [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md)

---

*Etapa 3 concluída · `2.12.38` · commit `7f712eb` · não declarar produção pronta.*
