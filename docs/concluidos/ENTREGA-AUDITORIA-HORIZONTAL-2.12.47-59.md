# Entrega — Auditoria horizontal (2.12.47–2.12.59)

**Data:** 2026-06-28 · **Branch:** `develop` / `main` · **Status:** correções código concluídas — **push `main` 8c9f789 (deploy automático)**

---

## Escopo

Implementação controlada pós [`RADARZAP-AUDITORIA-HORIZONTAL-SEGURANCA-ESTABILIDADE.md`](../audits/RADARZAP-AUDITORIA-HORIZONTAL-SEGURANCA-ESTABILIDADE.md) — etapas 1–14.

**Não declarar:** produção / go-live (gate Fase 1 ainda aberto).

---

## Deploy

| Item | Status |
|------|--------|
| Commit | `8c9f789` — `fix(security): auditoria horizontal 2.12.47-59` |
| `develop` | ✅ pushed |
| `main` | ✅ fast-forward merge + push |
| `npm run pre-push:gate` | ✅ verde antes do merge |

## Versões e achados

| Versão | IDs | Resumo |
|--------|-----|--------|
| 2.12.47 | AH-R01 | `buildTenantStats` em GET `/api/stats` |
| 2.12.48 | AH-R02 | Filas BullMQ tenant-scoped + sanitização `job.data` |
| 2.12.49 | AH-R03/R04 | Rotas plano legado → Admin Ops + audit |
| 2.12.50 | AH-S02/S03 | Rate limit fail-closed prod + `fetchWithTimeout` IA |
| 2.12.51 | AH-E01 | Filtro billing status Mongo admin orgs |
| 2.12.52 | AH-D01/W02 | Embed fail-closed prod + alertas domínios vazios |
| 2.12.53 | AH-E02 | Security-events paginação + fetch plan |
| 2.12.54 | AH-R05/D02 | Ingest sino hardened + TTL AuditLog/AttendanceEvent |
| 2.12.55 | AH-R06/M03 | Socket.IO CORS + presença HMAC; Inbox `clientId` |
| 2.12.56 | AH-S04/S01 | Health infra + runbook SPOF Mongo/Redis |
| 2.12.57 | AH-B02/M04/S05 | Dev billing flag; testes cross-tenant; doc bridge dedup |
| 2.12.58 | AH-R07 | Health público mínimo + `/admin/ops/infra-health` |
| 2.12.59 | AH-R08/D03 | Rota consent depreciada; política audit IA; encerramento doc |

---

## Ordem de execução (pós 2.12.59)

| # | Item | Status |
|---|------|--------|
| 1 | Admin Ops hub IA + depreciação orgs | ✅ 2.12.60 |
| 2 | AH-M05 bridge dedup Redis | ✅ 2.12.61 |
| 3 | AH-S01 degraded mode (código) | ✅ 2.12.62 |
| 4 | AH-D04 portal LGPD (TOP 18) | ✅ 2.12.63 |
| 5 | **QA manual VPS Etapa 10 + Bloco E** | ⏳ **último** |

---

## Pendências (humano / pós Fase 1)

- ~~QA manual VPS Etapa 10 + Bloco E browser~~ → **último passo** (após backlog técnico)
- ~~`npm run pre-push:gate` antes de merge `main`~~ ✅ 2026-06-28
- ~~AH-D04 portal LGPD (TOP 18)~~ ✅ 2.12.63
- ~~AH-M05 bridge dedup Redis multi-réplica~~ ✅ 2.12.61
- ~~AH-S01 degraded mode (código)~~ ✅ 2.12.62

---

## Gates recomendados antes de commit

```bash
npm run pre-push:gate
npx playwright test e2e/cross-tenant-isolation.spec.ts --project=chromium
```

---

## Referências

- [`docs/operacao/RUNBOOK-SPOF-MONGO-REDIS.md`](../operacao/RUNBOOK-SPOF-MONGO-REDIS.md)
- [`docs/CHANGELOG.md`](../CHANGELOG.md) — entradas 2.12.47–2.12.59
