# RadarZap — Admin Dashboard Ops — Etapa 10 — QA VPS + Bloco E + Push prep

**Versão:** `2.12.45`  
**Branch:** `develop`  
**Data:** 2026-06-28  
**Push/deploy:** **NÃO** executados (aguarda autorização Benhur)

---

## Objetivo

Validar rotas admin em ambiente real (VPS/staging), fechar **Bloco E** (alterar plano + AuditLog), rodar gates finais e preparar push seguro — **sem feature nova**, **sem Stripe live**, **sem declarar go-live**.

---

## Gates finais (Etapa 10 — agente)

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ |
| `npm test -- admin-ops` | ✅ 65/65 |
| `npm run build --prefix …/frontend` | ✅ |
| `npx playwright test e2e/admin-dashboard.spec.ts` | ✅ **54/54** (+4 cenários: plano, ?tab=tenants) |
| `npm run qa:admin-ops:bloco-e:local` | ✅ — ver JSON |
| `npm run qa:atendimento:gate` | ⏭ não executado (escopo Admin Ops) |

Evidência Bloco E local: [`docs/qa-results/admin-ops-bloco-e-local-2026-06-28.json`](../../qa-results/admin-ops-bloco-e-local-2026-06-28.json)

---

## Correções Etapa 10 (escopo permitido)

| Item | Arquivo |
|------|---------|
| Quick link dashboard **Clientes → Usuários** | `AdminOpsDashboardView.tsx` |
| `data-testid` modal alterar plano | `AdminOpsTenantsPanel.tsx` |
| E2E modal plano + `?tab=tenants` | `e2e/admin-dashboard.spec.ts` |
| Script gate Bloco E Mongo | `scripts/qa-admin-ops-bloco-e-local.ts` |

---

## QA manual VPS — checklist Benhur

Executar logado na VPS/staging com versão **≥ 2.12.45** após push autorizado.

| Rota | Verificar |
|------|-----------|
| `/admin` | Redirect → `/admin/dashboard` |
| `/admin/dashboard` | 8 abas, cards, refresh |
| `/admin/dashboard?tab=tenants` | Empresas, trial/plano |
| `/admin/dashboard?tab=infra` | Infra detalhada |
| `/admin/dashboard?tab=security` | Feed segurança |
| `/admin/clients` | Título **Usuários**, guia, hub |
| `/admin/moderation` | LGPD, **sem** tabela plano |
| `/admin/payments` | Hub billing |
| `/admin/audit` | Nota vs feed Segurança |
| `/admin/security` | Hub/links |
| `/admin/monitoring` | Infra + banner |
| `/admin/errors` | Erros sanitizados |
| `/admin/servers` | WA/WebChat/Inbox |
| Anti-segredo | Nenhum secret/token/QR na UI |

---

## Bloco E — browser (Benhur)

1. Login `SYSTEM_ADMIN` na VPS/staging.
2. `/admin/dashboard?tab=tenants` → org de teste (não cliente real).
3. **Plano** → plano `starter` ou `pro`, motivo ≥ 5 chars, expiração futura.
4. Confirmar toast, tabela, summary, `AuditLog` `admin.plan.changed`.
5. Reverter plano se necessário.

**Local (agente):** mutação + audit + revert via `npm run qa:admin-ops:bloco-e:local` — org Kiro System, pro→starter→revert pro.

---

## SYSTEM_MODERATOR

- E2E: sem botões Estender/Plano/Cancelar na aba Empresas.
- VPS: confirmar read-only; `PATCH …/plan` → **403** se testar via DevTools.

---

## Pendências pós-Etapa 10

- [ ] QA manual VPS rota a rota (Benhur)
- [ ] Bloco E browser VPS (Benhur)
- [ ] Push `develop` → merge `main` (autorização Benhur)
- [ ] Hub link aba IA em `ai-blueprint` / `ai-platform`
- [ ] Unificar `GET /admin/organizations` legado (doc deprecação)

---

## Referências

- Resultado consolidado: [`RADARZAP-ADMIN-DASHBOARD-OPS-QA-RESULTADO.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-QA-RESULTADO.md)
- Etapa 9 pendências: [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md)
