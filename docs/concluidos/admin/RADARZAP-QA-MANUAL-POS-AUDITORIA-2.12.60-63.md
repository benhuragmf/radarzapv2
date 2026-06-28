# QA manual — pós-auditoria 2.12.60–63 + Admin Ops VPS

**Data:** 2026-06-28 · **Versão alvo:** `2.12.63` · **Executor:** Benhur (browser VPS/local)

**Pré-requisito deploy:** commit `2.12.60–63` na `main` + deploy VPS concluído.

**Não declarar:** go-live / produção — gate Fase 1 ROADMAP ainda aberto.

---

## Bloco A — Admin Ops (Etapa 9 + Bloco E)

Ref: [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md)

| # | Rota / ação | Verificar | OK |
|---|-------------|-----------|-----|
| A1 | Menu | **Empresas** e **Usuários** separados | ☐ |
| A2 | `/admin/clients` | Título Usuários + banner hub | ☐ |
| A3 | `/admin/dashboard?tab=tenants` | Trial / plano / paginação | ☐ |
| A4 | `/admin/moderation` | Sem tabela plano; cards LGPD | ☐ |
| A5 | `/admin/ai-blueprint` | Banner hub → aba IA | ☐ |
| A6 | `/admin/ai-platform` | Banner hub → aba IA | ☐ |
| A7 | **Bloco E** | Alterar plano no browser VPS + entrada `AuditLog` | ☐ |
| A8 | Moderador | Empresas read-only; moderação OK | ☐ |

---

## Bloco B — Portal LGPD (2.12.63)

Ref: [`CONSENTIMENTO-LGPD.md`](../../CONSENTIMENTO-LGPD.md) § Portal LGPD

| # | Passo | Verificar | OK |
|---|-------|-----------|-----|
| B1 | Menu Consentimento → **Portal LGPD** | Abre `/platform/lgpd` | ☐ |
| B2 | Busca telefone contato real | Lista 1+ resultado | ☐ |
| B3 | **Exportar JSON** | Download `.json` com `schema: radarzap-lgpd-export-v1` | ☐ |
| B4 | Feed eventos | Linha `Exportação solicitada` | ☐ |
| B5 | **Anonimizar** (contato teste) | Confirmação + toast sucesso | ☐ |
| B6 | Re-busca mesmo telefone | Contato anonimizado / inativo | ☐ |
| B7 | `GET /api/lgpd/events` ou tabela UI | `lgpd.anonymized` registrado | ☐ |

---

## Bloco C — Infra / health (2.12.62)

| # | Passo | Verificar | OK |
|---|-------|-----------|-----|
| C1 | `curl /api/services/health` | `healthy: true` com Mongo+Redis up | ☐ |
| C2 | Staff `/api/admin/ops/infra-health` | `dependencies.mongodb/redis` OK | ☐ |
| C3 | Dev: parar Redis, reiniciar app | Boot degradado + `degraded: true` no health (opcional local) | ☐ |

---

## Bloco D — Bridge dedup (2.12.61)

| # | Passo | Verificar | OK |
|---|-------|-----------|-----|
| D1 | Bridge WebChat→WA ativa | Mensagem visitante encaminha 1x | ☐ |
| D2 | Retry rápido mesma mensagem | Sem duplicata WA; evento `bridge.loop_prevented` se bloqueado | ☐ |

---

## Gates automáticos (já verdes local)

```bash
npm run pre-push:gate
npm test -- --testPathPattern="lgpd-portal|bridge-forward|infra-boot"
npx playwright test e2e/cross-tenant-isolation.spec.ts e2e/lgpd-portal.spec.ts --project=chromium
npx playwright test e2e/admin-dashboard.spec.ts --project=chromium
```

### Evidência deploy / CI 2026-06-28

| Item | Status |
|------|--------|
| GitHub **Deploy** `main` @ `b4bfb24` (app 2.12.63) | ✅ success (~3m31s) |
| GitHub **Deploy** `main` @ `db077e0` (E2E only) | ✅ success (~56s) |
| GitHub **CI** `main` @ `b4bfb24` | ❌ 2 E2E desatualizados — corrigido em `db077e0` |
| GitHub **CI** `main` @ `db077e0` | ✅ success — E2E 80/80 + test + audit ([run 28336722683](https://github.com/benhuragmf/radarzapv2/actions/runs/28336722683)) |
| Unit 2.12.60–63 | ✅ 14/14 (lgpd, bridge, infra-boot, infra-health) |
| E2E LGPD mock | ✅ `e2e/lgpd-portal.spec.ts` (3/3 local) |
| E2E Admin hub IA | ✅ ai-blueprint / ai-platform em `admin-dashboard.spec.ts` |

---

## Resultado

| Campo | Valor |
|-------|-------|
| Data execução | |
| Ambiente | local / VPS |
| Versão deployada | `2.12.63` (`main` @ `db077e0`) |
| Blocos A–D | ☐ todos OK / ☐ ressalvas |
| Evidência | Preencher [`docs/qa-results/qa-manual-pos-auditoria-2.12.60-63-TEMPLATE.json`](../../qa-results/qa-manual-pos-auditoria-2.12.60-63-TEMPLATE.json) → renomear com data |

---

*Último passo do backlog pós-auditoria horizontal — após OK, atualizar Etapa 9 e ENTREGA-AUDITORIA.*
