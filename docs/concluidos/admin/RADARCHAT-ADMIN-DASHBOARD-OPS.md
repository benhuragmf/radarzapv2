# Radar Chat — Admin Dashboard Ops

**Versão:** `2.12.63` · **Atualizado:** 2026-06-28 · **Status:** implementação concluída — QA manual VPS pendente

Visão operacional global para staff Radar Chat (`SYSTEM_ADMIN` / `SYSTEM_MODERATOR`).

**Deploy:** `main` @ `db077e0` · CI verde · **Não declarar** go-live (gate Fase 1 aberto).

---

## Documentação ativa

| Doc | Conteúdo |
|-----|----------|
| [**API (OpenAPI espelho)**](./RADARCHAT-ADMIN-DASHBOARD-OPS-API.md) | Contrato REST completo |
| [Entrega Etapas 1–3](../ENTREGA-ADMIN-DASHBOARD-OPS-2.12.37-38.md) | Handoff inicial |
| [Entrega auditoria 2.12.47–63](../ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md) | Pacote horizontal + backlog |
| [QA manual pós-auditoria](./RADARCHAT-QA-MANUAL-POS-AUDITORIA-2.12.60-63.md) | Checklist VPS (último passo) |

OpenAPI machine-readable: `src/constants/openapi-dashboard.ts` (tag **Admin Ops**).

---

## Série arquivada (Etapas 1–10)

Série de entrega nesta pasta (`docs/concluidos/admin/`):

| Doc | Conteúdo |
|-----|----------|
| [Diagnóstico (Etapa 1)](./RADARCHAT-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md) | Lacunas e plano inicial |
| [Etapa 3 — Frontend](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-3-FRONTEND-DASHBOARD.md) | 8 abas, cards, alertas |
| [Etapa 4 — Empresas](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md) | Listagem + trial/plano |
| [Etapa 5 — Segurança](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-5-EVENTOS-SEGURANCA.md) | Feed eventos críticos |
| [Etapa 6 — Fechamento](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-6-QA-FECHAMENTO.md) | QA, OpenAPI, consolidação |
| [Etapa 7 — QA manual](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-7-QA-MANUAL.md) | Gate local Mongo |
| [Etapa 8 — Consolidação](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-8-CONSOLIDACAO-ADMIN.md) | Legado monitoring/errors/servers |
| [Etapa 9 — Auditoria rotas](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md) | Usuários×Empresas, moderação |
| [Etapa 10 — QA VPS](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-10-QA-VPS-PUSH.md) | Bloco E local, gates |
| [Verificação real 8–9](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-8-9-VERIFICACAO-REAL.md) | Reconciliação docs × git |
| [Inventário `/admin/*`](./RADARCHAT-ADMIN-INVENTARIO-PAGINAS.md) | 19 rotas |
| [QA Checklist](./RADARCHAT-ADMIN-DASHBOARD-OPS-QA-CHECKLIST.md) | Roteiro Benhur |
| [QA Resultado gates](./RADARCHAT-ADMIN-DASHBOARD-OPS-QA-RESULTADO.md) | Automação + Etapas 7–10 |

---

## Resumo Etapas 1–10 + pós-auditoria

| Etapa | Entrega | Versão |
|-------|---------|--------|
| 1 | Diagnóstico `/admin/dashboard` | — |
| 2 | `GET /api/admin/ops/summary` | 2.12.37 |
| 3 | UI `/admin/dashboard` 8 abas | 2.12.38 |
| 4 | Orgs paginadas + trial/plano + audit | 2.12.39 |
| 5 | `GET /api/admin/ops/security-events` + feed UI | 2.12.40 |
| 6 | API docs, OpenAPI, QA checklist | 2.12.41 |
| 7 | QA manual local, gate Mongo | 2.12.42 |
| 8 | Consolidação admin legado | 2.12.43 |
| 9 | Auditoria rota a rota | 2.12.44–63 |
| 10 | QA VPS prep, Bloco E local, E2E | 2.12.45 |
| + | Hub IA, bridge dedup, boot degradado, portal LGPD | 2.12.60–63 |

**Bloco E browser:** alterar plano no VPS + `AuditLog` — pendente Benhur (local Mongo ✅).

---

## Endpoints finais

```http
GET  /api/admin/ops/summary[?refresh=1]
GET  /api/admin/ops/organizations
PATCH /api/admin/ops/organizations/:id/plan
POST /api/admin/ops/organizations/:id/trial/extend
POST /api/admin/ops/organizations/:id/trial/cancel
GET  /api/admin/ops/security-events
GET  /api/admin/ops/infra-health
```

Detalhes: [`RADARCHAT-ADMIN-DASHBOARD-OPS-API.md`](./RADARCHAT-ADMIN-DASHBOARD-OPS-API.md).

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

---

## Segurança

**Sanitização:** `sanitizeOpsDisplayText` (UI) · `sanitizeAdminOpsSecurityEventText` (eventos).

**Nunca exposto:** Stripe keys, webhook secrets, IA keys, JWT, sessionData, QR, tokens, meta/payload bruto.

**Testes:** `admin-ops-anti-secret.test.ts` + E2E DOM malicioso + `e2e/admin-dashboard.spec.ts`.

---

## Próximo passo

1. Benhur: QA manual VPS — [`RADARCHAT-QA-MANUAL-POS-AUDITORIA-2.12.60-63.md`](./RADARCHAT-QA-MANUAL-POS-AUDITORIA-2.12.60-63.md)
2. Gate Fase 1 atendimento — [`ROADMAP-COMPLETUDE.md`](../ROADMAP-COMPLETUDE.md)

---

## Arquivos principais

| Camada | Arquivos |
|--------|----------|
| Types | `admin-ops-summary.ts`, `admin-ops-organizations.ts`, `admin-ops-security-events.ts` |
| Services | `admin-ops-summary.service.ts`, `admin-ops-organizations.service.ts`, `admin-ops-security-events.service.ts` |
| Routes | `DashboardService.ts` |
| Frontend | `AdminDashboard.tsx`, `AdminOpsDashboardView.tsx`, `AdminOpsTenantsPanel.tsx` |
| OpenAPI | `openapi-dashboard.ts` |
