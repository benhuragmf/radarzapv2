# RadarZap — Admin Dashboard Ops

**Versão:** `2.12.44` · **Atualizado:** 2026-06-27 · **Etapas 8–9:** reconciliadas com evidência git

Visão operacional global para staff RadarZap (`SYSTEM_ADMIN` / `SYSTEM_MODERATOR`).

**Status release:** `PRONTO PARA QA MANUAL` — produção estável **não** declarada · **Deploy/push:** não executados (Etapas 8–9 commit local; remoto ainda `2.12.42` até push autorizado).

---

## Documentação da série

| Doc | Conteúdo |
|-----|----------|
| [Diagnóstico (Etapa 1)](./RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md) | Lacunas e plano inicial |
| [Etapa 3 — Frontend](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-3-FRONTEND-DASHBOARD.md) | 8 abas, cards, alertas |
| [Etapa 4 — Empresas](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md) | Listagem + trial/plano |
| [Etapa 5 — Segurança](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-5-EVENTOS-SEGURANCA.md) | Feed eventos críticos |
| [Etapa 6 — Fechamento](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-6-QA-FECHAMENTO.md) | QA, OpenAPI, consolidação |
| [Etapa 7 — QA manual](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-7-QA-MANUAL.md) | Gate local Mongo + commit |
| [Etapa 8 — Consolidação](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-8-CONSOLIDACAO-ADMIN.md) | Legado monitoring/errors/servers |
| [Etapa 9 — Auditoria rotas](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md) | Usuários×Empresas, moderação |
| [Verificação real 8–9](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-8-9-VERIFICACAO-REAL.md) | Reconciliação docs × git |
| [Inventário `/admin/*`](./RADARZAP-ADMIN-INVENTARIO-PAGINAS.md) | 19 rotas |
| [**API (OpenAPI espelho)**](./RADARZAP-ADMIN-DASHBOARD-OPS-API.md) | Contrato REST completo |
| [QA Checklist manual](./RADARZAP-ADMIN-DASHBOARD-OPS-QA-CHECKLIST.md) | Roteiro Benhur |
| [QA Resultado gates](./RADARZAP-ADMIN-DASHBOARD-OPS-QA-RESULTADO.md) | Automação 65+50 testes |

OpenAPI machine-readable: `src/constants/openapi-dashboard.ts` (tag **Admin Ops**).

---

## Resumo Etapas 1–6

| Etapa | Entrega | Versão |
|-------|---------|--------|
| 1 | Diagnóstico `/admin/dashboard` | — |
| 2 | `GET /api/admin/ops/summary` | 2.12.37 |
| 3 | UI `/admin/dashboard` 8 abas | 2.12.38 |
| 4 | Orgs paginadas + trial/plano + audit | 2.12.39 |
| 5 | `GET /api/admin/ops/security-events` + feed UI | 2.12.40 |
| 6 | API docs, OpenAPI, QA checklist, anti-segredo | 2.12.41 |
| 7 | QA manual local, gate Mongo, commit seguro | 2.12.42 |
| 8 | Consolidação admin legado (redirect, deep links, páginas enriquecidas) | 2.12.43 |
| 9 | Auditoria rota a rota (Usuários/Empresas, moderação, hubs) | 2.12.44 |

**Ressalva Etapa 7 (Bloco E):** alterar plano no browser — ⏳ pendente Benhur (estender/cancelar trial ✅).

---

## Endpoints finais

```http
GET  /api/admin/ops/summary[?refresh=1]
GET  /api/admin/ops/organizations
PATCH /api/admin/ops/organizations/:id/plan
POST /api/admin/ops/organizations/:id/trial/extend
POST /api/admin/ops/organizations/:id/trial/cancel
GET  /api/admin/ops/security-events
```

Detalhes: [`RADARZAP-ADMIN-DASHBOARD-OPS-API.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-API.md).

---

## Frontend

| Rota | Componentes |
|------|-------------|
| `/admin` | redirect → `/admin/dashboard` |
| `/admin/dashboard` | `AdminDashboard.tsx` → `AdminOpsDashboardView.tsx` (`?tab=` deep link) |
| `/admin/monitoring` | `AdminMonitoring.tsx` + `AdminOpsInfraPanel` |
| `/admin/errors` | `AdminErrors.tsx` + feed Segurança |
| `/admin/servers` | `AdminServers.tsx` + `AdminOpsServersPanel` |
| `/admin/clients` | `AdminClients.tsx` — **Usuários** (contas) |
| Aba Empresas | `AdminOpsTenantsPanel.tsx` (`?tab=tenants`) |
| Aba Segurança | `AdminOpsSecurityPanel.tsx` |

Abas: Visão geral · Infra · Empresas · Atendimento · Billing · IA · Segurança · Go-live.

---

## Matriz RBAC Admin Ops

| Recurso | Capability |
|---------|------------|
| UI + summary + orgs list + security-events | `dashboard:global` |
| PATCH plan / POST trial | `system:plans:manage` |

| Papel | Dashboard | Mutações plano/trial |
|-------|-----------|----------------------|
| `SYSTEM_ADMIN` | ✅ | ✅ |
| `SYSTEM_MODERATOR` | ✅ | ❌ (read-only UI) |
| Owner/Admin/Manager/Atendente tenant | ❌ | ❌ |
| Sem sessão | ❌ | ❌ |

---

## Segurança

**Sanitização:** `sanitizeOpsDisplayText` (UI) · `sanitizeAdminOpsSecurityEventText` (eventos).

**Nunca exposto:** Stripe keys, webhook secrets, IA keys, JWT, sessionData, QR, tokens, meta/payload bruto, `stripeSubscriptionId`, e-mail owner em massa.

**Testes anti-segredo:** `admin-ops-anti-secret.test.ts` + E2E DOM malicioso.

---

## Testes automatizados

| Suite | Qtd |
|-------|-----|
| `npm test -- admin-ops` | 65 |
| `e2e/admin-dashboard.spec.ts` | 18 |

Arquivos: `admin-ops-summary*.test.ts`, `admin-ops-organizations.service.test.ts`, `admin-ops-security-events.service.test.ts`, `admin-ops-anti-secret.test.ts`.

---

## Riscos restantes

- QA manual checklist **não preenchido** (Benhur)
- Override plano manual vs Stripe real
- Scan org billing / security-events in-memory em escala
- Working tree Etapas 4–6 **sem commit** no remoto

---

## Próximos passos

1. Benhur: Bloco E no browser (`SYSTEM_ADMIN`) — trial/plano em org de teste
2. Autorizar **push** `develop` após revisão
3. TOP 20 QA A–J global antes de go-live
4. Gráficos históricos (backlog)

---

## Arquivos principais

| Camada | Arquivos |
|--------|----------|
| Types | `admin-ops-summary.ts`, `admin-ops-organizations.ts`, `admin-ops-security-events.ts`, `admin-ops-summary.util.ts` |
| Services | `admin-ops-summary.service.ts`, `admin-ops-organizations.service.ts`, `admin-ops-security-events.service.ts`, `admin-ops-alerts.util.ts` |
| Routes | `DashboardService.ts` |
| Frontend | `AdminDashboard.tsx`, `AdminOpsDashboardView.tsx`, `AdminOpsTenantsPanel.tsx`, `AdminOpsSecurityPanel.tsx` |
| OpenAPI | `openapi-dashboard.ts` |
