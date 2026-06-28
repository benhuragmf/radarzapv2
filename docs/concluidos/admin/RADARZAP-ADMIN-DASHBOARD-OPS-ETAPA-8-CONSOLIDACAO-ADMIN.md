# RadarZap — Admin Dashboard Ops — Etapa 8 — Consolidação admin legado

> **Correção de sequência:** este arquivo foi gerado como “entregue” antes de existir commit correspondente (HEAD estava em `2.12.42`). A auditoria real está em [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-8-9-VERIFICACAO-REAL.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-8-9-VERIFICACAO-REAL.md). Status abaixo reflete implementação **após** gates e commit de reconciliação.

**Data:** 2026-06-27  
**Versão:** `2.12.43`  
**Status:** **IMPLEMENTADA COM EVIDÊNCIA** (commit reconciliação) — QA manual VPS recomendado

---

## Objetivo

Completar a **análise geral e organização** do `/admin/*` iniciada nas Etapas 1–7 (que focaram em `/admin/dashboard`). Eliminar a sensação de “páginas vazias” na VPS enriquecendo legado e ligando tudo ao hub Ops.

---

## Diagnóstico (pré-Etapa 8)

| Problema | Impacto |
|---------|---------|
| `/admin/monitoring`, `/admin/errors`, `/admin/servers` minimalistas | Staff vê VPS “incompleta” vs dashboard novo |
| Duplicação conceitual | Mesmas métricas em dashboard e legado sem ligação |
| Sem entrada `/admin` | URL raiz admin não definida |
| Inventário disperso | Rotas admin não documentadas num só lugar |

---

## Entregas

### 1. Inventário completo

- [`RADARZAP-ADMIN-INVENTARIO-PAGINAS.md`](./RADARZAP-ADMIN-INVENTARIO-PAGINAS.md) — 19 rotas, caps RBAC, status.

### 2. Componentes compartilhados

| Arquivo | Função |
|---------|--------|
| `useAdminOpsSummary.ts` | Hook React Query reutilizável |
| `adminOpsTabs.ts` | Tipo `AdminOpsTab`, parse `?tab=`, URLs deep link |
| `AdminOpsLegacyBanner.tsx` | Banner legado → dashboard |
| `AdminOpsInfraPanel.tsx` | Bloco infra (dashboard + monitoring) |
| `AdminOpsServersPanel.tsx` | Bloco servidores/atendimento |

### 3. Páginas legado enriquecidas

| Rota | Mudança |
|------|---------|
| `/admin/monitoring` | Ops infra + stats legado BullMQ; fallback `logs:global` |
| `/admin/errors` | Feed `security-events` filtro `error`; fallback lista bruta |
| `/admin/servers` | Métricas WA/WebChat/Inbox + Discord summary |

### 4. Navegação

- **`/admin` → `/admin/dashboard`** (redirect)
- **`/admin/dashboard?tab=infra`** — abre aba direto (`initialTab` em `AdminOpsDashboardView`)
- Links rápidos no dashboard renomeados para “(detalhe)”

### 5. Testes E2E (+5)

- Redirect `/admin`
- Deep link `?tab=infra`
- Monitoring / errors / servers enriquecidos (mock Ops)

---

## RBAC / fallback

| Cap | Página | Comportamento |
|-----|--------|---------------|
| `dashboard:global` | monitoring, errors, servers | Dados Ops + banner |
| `logs:global` only | monitoring, errors | API legado `/admin/monitoring`, `/admin/errors` |
| `system:servers:view` only | servers | Cards WA/Discord legado |

---

## QA recomendado (Benhur — VPS)

1. `/admin` → dashboard
2. `/admin/dashboard?tab=security` → aba Segurança
3. `/admin/monitoring` — painel infra + banner
4. `/admin/errors` — feed error sanitizado
5. `/admin/servers` — cards WA + WebChat
6. Login **SYSTEM_MODERATOR** — páginas permitidas sem 403

---

## Pendências (fora Etapa 8)

- Unificar `/admin/clients` com aba Empresas (Etapa futura)
- QA manual alterar plano (Bloco E Etapa 7)
- Declaração go-live — **não** aplicável

---

## Gates

```bash
npm run build
npm run build --prefix src/services/web-dashboard/frontend
npm test -- admin-ops
npx playwright test e2e/admin-dashboard.spec.ts
```

---

## Referências

- Etapa 7: [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-7-QA-MANUAL.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-7-QA-MANUAL.md)
- Diagnóstico original: [`RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md)
