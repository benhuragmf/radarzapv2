# Radar Chat — Admin Dashboard Ops — Etapa 9 — Auditoria rota a rota

> **Correção de sequência:** este arquivo foi gerado como “entregue” antes de existir commit correspondente (HEAD estava em `2.12.42`). A auditoria real está em [`RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-8-9-VERIFICACAO-REAL.md`](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-8-9-VERIFICACAO-REAL.md). Status abaixo reflete implementação **após** gates e commit de reconciliação.

**Data:** 2026-06-28  
**Versão:** `2.12.63`  
**Status:** **Gates automatizados verdes** — QA VPS browser + Bloco E pendente Benhur

---

## Objetivo

Checklist **completo** de cada rota `/admin/*`: conteúdo útil, duplicação com Dashboard Ops, ação tomada (manter / enriquecer / redirecionar / deprecar).

---

## Matriz de auditoria

| Rota | Conteúdo útil? | Duplica dashboard? | Decisão Etapa 9 | Implementado |
|------|----------------|-------------------|-----------------|--------------|
| `/admin` | — | — | Redirect → dashboard | ✅ Etapa 8 |
| `/admin/dashboard` | ✅ Hub 8 abas | — | Manter | ✅ |
| `/admin/dashboard?tab=tenants` | ✅ Empresas/trial/plano | — | **Menu "Empresas"** | ✅ |
| `/admin/clients` | ✅ Usuários (contas) | 🟡 Confundia com empresas | Renomear **Usuários** + guia + hub | ✅ |
| `/admin/monitoring` | ✅ Infra + stats | Parcial aba Infra | Enriquecer + hub | ✅ Etapa 8 |
| `/admin/errors` | ✅ Erros sanitizados | Parcial aba Segurança | Enriquecer + hub | ✅ Etapa 8 |
| `/admin/servers` | ✅ WA/Discord/canais | Parcial aba Atendimento | Enriquecer + hub | ✅ Etapa 8 |
| `/admin/moderation` | ✅ LGPD/consent | 🔴 Tabela planos duplicada | **Remover tabela**; hub Empresas | ✅ |
| `/admin/payments` | ✅ Pedidos + sweep | Parcial aba Billing | Hub link billing | ✅ |
| `/admin/plans` | ✅ Catálogo planos | Não (ação config) | Manter | — |
| `/admin/sessions` | ✅ Sessões WA | Não (transacional) | Manter | — |
| `/admin/queue` | ✅ Fila BullMQ | Não (transacional) | Manter | — |
| `/admin/logs` | ✅ SystemLog | Não (transacional) | Manter | — |
| `/admin/api` | ✅ Chaves/webhooks | Parcial overview | Hub link overview | ✅ |
| `/admin/audit` | ✅ AuditLog staff | Parcial feed Segurança | Hub + nota diferença | ✅ |
| `/admin/settings` | ✅ Limites WA global | Não | Manter | — |
| `/admin/ai-blueprint` | ✅ Config IA | Parcial aba IA | Manter (config) | ✅ hub link aba IA |
| `/admin/ai-platform` | ✅ Credenciais IA | Parcial aba IA | Manter (config) | ✅ hub link aba IA |
| `/admin/permissions` | ✅ Matriz caps | Não | Manter | — |
| `/admin/security` | 🟡 Checklist estático | Parcial aba Segurança | Hub + links | ✅ |
| `/admin/backup` | ✅ Backup | Não | Manter | — |

**Legenda duplicação:** 🔴 removido · 🟡 clarificado · ✅ complementar (não redundante).

---

## Usuários × Empresas (principal confusão)

| Conceito | Rota | API | Quem gerencia plano/trial |
|----------|------|-----|---------------------------|
| **Usuário** | `/admin/clients` | `GET /users` | — |
| **Empresa (org)** | `/admin/dashboard?tab=tenants` | `GET /admin/ops/organizations` | `PATCH/POST …/plan`, `…/trial/*` |

**Antes:** menu "Clientes" + Moderação com dropdown de plano (API legada, sem auditoria Ops).  
**Depois:** menu **Usuários** + **Empresas**; Moderação só LGPD; planos centralizados na aba Empresas.

---

## RBAC

| Cap | Vê hub banner? | Página |
|-----|----------------|--------|
| `dashboard:global` | ✅ | `AdminOpsHubLink` |
| `system:users:view` only | ❌ banner | `/admin/clients` — lista usuários |
| `system:moderation:action` | ✅ se tiver dashboard | Moderação — sem tabela plano |

Moderador (`SYSTEM_MODERATOR`) tem `dashboard:global` mas **não** `system:plans:manage` — aba Empresas read-only (correto).

---

## Pendências (Etapa 11+)

- [x] Hub link aba IA em `ai-blueprint` / `ai-platform` — ✅ 2.12.60
- [ ] QA manual VPS todas as rotas (checklist — Benhur) — **deixar por último**
- [ ] Bloco E: alterar plano no **browser VPS** + AuditLog — **deixar por último**
- [x] Deprecar `GET /admin/organizations` legado — headers + sucessora Ops — ✅ 2.12.60

---

## QA manual VPS (checklist)

| # | Rota | Verificar |
|---|------|-----------|
| 1 | Menu | **Empresas** e **Usuários** separados |
| 2 | `/admin/clients` | Título Usuários + guia + banner |
| 3 | `/admin/dashboard?tab=tenants` | Trial/plano |
| 4 | `/admin/moderation` | Sem tabela plano; cards LGPD |
| 5 | `/admin/payments` | Banner billing |
| 6 | `/admin/audit` | Nota vs feed Segurança |
| 7 | Moderador | Empresas read-only, moderação OK |

---

## Referências

- Etapa 8: [`RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-8-CONSOLIDACAO-ADMIN.md`](./RADARCHAT-ADMIN-DASHBOARD-OPS-ETAPA-8-CONSOLIDACAO-ADMIN.md)
- Inventário: [`RADARCHAT-ADMIN-INVENTARIO-PAGINAS.md`](./RADARCHAT-ADMIN-INVENTARIO-PAGINAS.md)
