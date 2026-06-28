# RadarZap — Admin Dashboard Ops — Etapa 5 — Eventos de Segurança

**Data:** 2026-06-27  
**Versão após Etapa 5:** `2.12.40`  
**Branch:** `develop`  
**Status:** ✅ Concluída (código local; **sem push**)

---

## Resumo executivo

A **Etapa 5** adicionou **feed global sanitizado de eventos críticos** na aba **Segurança** do `/admin/dashboard`, agregando `AttendanceEvent`, `SystemLog` e `AuditLog` sem expor meta, payload, tokens ou secrets.

**Entregue:** `GET /api/admin/ops/security-events`, sanitização backend + frontend, filtros (nível, fonte, kind, janela 24h/7d), testes unit + E2E.

**Não entregue:** drawer de detalhe, busca full-text, gráficos históricos, deploy, Stripe live.

**Status release:** `PRONTO PARA QA MANUAL` — produção estável **não** declarada.

---

## Herança das etapas anteriores

| Etapa | Doc | Versão |
|-------|-----|--------|
| 1 Diagnóstico | [`RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md) | — |
| 2 Summary backend | [`RADARZAP-ADMIN-DASHBOARD-OPS.md`](./RADARZAP-ADMIN-DASHBOARD-OPS.md) | 2.12.37 |
| 3 Frontend dashboard | [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-3-FRONTEND-DASHBOARD.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-3-FRONTEND-DASHBOARD.md) | 2.12.38 |
| 4 Empresas/trial | [`RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-4-EMPRESAS-TRIAL.md) | 2.12.39 |
| **5 Eventos segurança** | **Este doc** | **2.12.40** |

---

## Estado Git

| Item | Valor |
|------|-------|
| Branch | `develop` |
| Versão | `2.12.40` |
| Commit | pendente (aguardando autorização) |
| Push | não executado |

---

## Endpoints

```http
GET /api/admin/ops/security-events
```

| Param | Regra |
|-------|-------|
| `limit` | default 25, max 100 |
| `kind` | filtro exato por tipo |
| `level` | info \| warning \| critical \| error |
| `source` | attendance \| system \| audit \| billing \| webhook \| ai \| bridge \| ticket \| form |
| `from` / `to` | ISO; default últimas 24h |

**Capability:** `dashboard:global`

**Resposta:** `AdminOpsSecurityEventsPage` — `items[]`, `total`, `limit`, `window`, `generatedAt`

**Campos por item:** `id`, `source`, `level`, `kind`, `title`, `message`, `organizationId?`, `organizationName?`, `createdAt`

**Nunca retorna:** `meta`, `payload`, `details`, `metadata`, `sessionData`, QR, tokens, Stripe IDs, e-mails.

---

## Fontes de eventos

### AttendanceEvent

Kinds monitorados: `ticket.public_lookup_failed`, `form.blocked`, `billing.*`, `ai.credits.*`, `ai.premium.provider_error`, `bridge.*`, etc.

### SystemLog

Níveis `warn` e `error` na janela selecionada.

### AuditLog

Ações: `admin.trial.*`, `admin.plan.changed`, `billing.*`, `webhook.*`, `security.*`, `auth.login_failed`.

---

## Sanitização

Helper: `sanitizeAdminOpsSecurityEventText()` — reutiliza `containsSensitiveOpsContent` + `maskSecretInText`.

Padrões ocultos: `sk_test_`, `sk_live_`, `whsec_`, `Bearer`, `Authorization`, `Cookie`, `sessionData`, `publicAccessToken`, chaves JWT/Stripe/OpenAI/Gemini.

Substituição: `[conteúdo omitido]`

Limites: title 80 chars, message 300 chars.

Frontend aplica `sanitizeOpsDisplayText` adicional no render.

---

## Frontend

| Item | Detalhe |
|------|---------|
| **Componente** | `AdminOpsSecurityPanel.tsx` |
| **Integração** | aba Segurança em `AdminOpsDashboardView.tsx` |
| **Mantido** | cards contagens + alertas do summary |
| **Novo** | tabela feed, filtros, botão Atualizar |
| **Estados** | loading, error + retry, empty |

---

## RBAC

| Papel | Leitura feed |
|-------|--------------|
| `SYSTEM_ADMIN` | Sim |
| `SYSTEM_MODERATOR` | Sim (`dashboard:global`) |
| Tenant comum | 403 |

Sem mutações nesta etapa.

---

## Testes

| Arquivo | Escopo |
|---------|--------|
| `admin-ops-security-events.service.test.ts` | mappers, sanitização, filtros, ordenação, org names |
| `e2e/admin-dashboard.spec.ts` | feed, filtros, empty, 500, secrets, refresh |

---

## Gates

| Gate | Resultado esperado |
|------|-------------------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test -- admin-ops` | Verde |
| `npm run build --prefix …/frontend` | Verde |
| `npx playwright test e2e/admin-dashboard.spec.ts` | Verde (30+) |

---

## Arquivos alterados

### Backend

- `src/types/admin-ops-security-events.ts`
- `src/services/web-dashboard/admin-ops-security-events.service.ts`
- `src/services/web-dashboard/DashboardService.ts`

### Frontend

- `src/services/web-dashboard/frontend/src/pages/admin/AdminOpsSecurityPanel.tsx`
- `src/services/web-dashboard/frontend/src/pages/admin/AdminOpsDashboardView.tsx`

### Testes / E2E

- `__tests__/admin-ops-security-events.service.test.ts`
- `e2e/admin-dashboard.spec.ts`
- `e2e/fixtures/mock-admin-ops-api.ts`

### Documentação

- Este doc, `RADARZAP-ADMIN-DASHBOARD-OPS.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `INDICE-DOCUMENTACAO.md`

---

## Riscos restantes

- Agregação in-memory após fetch limitado (200/source) — monitorar escala.
- AuditLog sem `clientId` direto depende de `details.organizationId`.
- SystemLog TTL 30 dias — eventos mais antigos não aparecem.

---

## Próximo passo recomendado

- Gráficos históricos de segurança (opcional)
- OpenAPI admin ops
- QA manual A–J antes de go-live

---

*Doc de entrega Etapa 5 · padrão TOP · sem deploy · sem push sem autorização.*
