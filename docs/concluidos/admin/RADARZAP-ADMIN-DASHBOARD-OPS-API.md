# RadarZap — Admin Dashboard Ops — API

**Versão doc:** `2.12.41` · **Base URL:** `/api` · **Auth:** cookie de sessão (painel staff)

Contrato OpenAPI espelho: `src/constants/openapi-dashboard.ts` (tag **Admin Ops**). UI: `/settings#api-docs` → `GET /integrations/openapi`.

**Status release:** `PRONTO PARA QA MANUAL` — produção estável **não** declarada.

---

## Visão geral

Endpoints **cross-tenant** exclusivos para staff interno (`SYSTEM_ADMIN` / `SYSTEM_MODERATOR` com capabilities corretas). Agregam métricas, listagem de organizações, ações manuais de plano/trial e feed de eventos críticos **sanitizados**.

Nenhum endpoint aceita `clientId` do cliente para filtrar dados de outra org.

| Endpoint | Desde |
|----------|-------|
| `GET /admin/ops/summary` | 2.12.37 |
| `GET /admin/ops/organizations` + mutações | 2.12.39 |
| `GET /admin/ops/security-events` | 2.12.40 |

---

## Autenticação e RBAC

| Recurso | Capability |
|---------|------------|
| `/admin/dashboard` (UI) | `dashboard:global` |
| `GET /admin/ops/summary` | `dashboard:global` |
| `GET /admin/ops/organizations` | `dashboard:global` |
| `PATCH /admin/ops/organizations/:id/plan` | `system:plans:manage` |
| `POST /admin/ops/organizations/:id/trial/extend` | `system:plans:manage` |
| `POST /admin/ops/organizations/:id/trial/cancel` | `system:plans:manage` |
| `GET /admin/ops/security-events` | `dashboard:global` |

**Erros:** `401` sem sessão · `403` capability ausente · `500` erro interno (mensagem genérica em produção).

---

## Segurança e campos omitidos

Nunca retornar ou persistir em resposta:

- Chaves Stripe (`sk_test_`, `sk_live_`, `whsec_`), OpenAI, Gemini, JWT, `SESSION_ENCRYPTION_KEY`
- `WhatsAppSession.sessionData`, QR, credenciais Baileys
- `stripeSubscriptionId`, e-mail owner, Discord ID em massa
- `publicAccessToken`, cookies, header `Authorization`
- `meta` / `payload` / `details` / `metadata` bruto de eventos
- `job.data` de filas BullMQ

Sanitização UI: `sanitizeOpsDisplayText` · Backend eventos: `sanitizeAdminOpsSecurityEventText`.

---

## GET /api/admin/ops/summary

Agregador operacional global.

### Query

| Param | Descrição |
|-------|-----------|
| `refresh` | `1` — ignora cache Redis (TTL 30s) |

### Resposta `200`

Tipo: `AdminOpsSummary` (`src/types/admin-ops-summary.ts`)

Blocos: `system`, `services`, `tenants`, `operations`, `ai`, `billing`, `security`, `alerts`, `links`.

### Testes

- `admin-ops-summary.service.test.ts`
- `admin-ops-summary.rbac.test.ts`
- E2E `admin-dashboard.spec.ts`

### Exemplo sanitizado (trecho)

```json
{
  "generatedAt": "2026-06-27T12:00:00.000Z",
  "billing": { "stripeMode": "test" },
  "security": {
    "errorsLast24h": 0,
    "invalidTicketLookupsLast24h": 2,
    "formBlocksLast24h": 0,
    "billingLimitBlocksLast24h": 0,
    "webhookFailuresLast24h": 0
  },
  "alerts": [
    {
      "level": "info",
      "kind": "release.qa_manual_pending",
      "title": "QA manual pendente",
      "message": "Produção ainda não declarada pronta."
    }
  ]
}
```

---

## GET /api/admin/ops/organizations

Listagem paginada de organizações.

### Query

| Param | Default | Regra |
|-------|---------|-------|
| `page` | 1 | ≥ 1 |
| `limit` | 25 | max 100 |
| `plan` | — | free \| starter \| pro \| enterprise |
| `status` | — | billing status normalizado |
| `search` | — | nome, max 80 chars |
| `sort` | createdAt | name \| planExpiresAt |

### Resposta `200`

`AdminOpsOrganizationsPage` — `items[]` com `AdminOpsOrganizationRow`.

**Omitido por row:** owner, e-mail, `stripeSubscriptionId`, sessionData, tokens.

### Testes

- `admin-ops-organizations.service.test.ts`
- E2E filtros e sanitização DOM

### Exemplo row

```json
{
  "id": "674a…",
  "name": "Empresa Demo",
  "plan": "starter",
  "billingStatus": "trialing",
  "planExpiresAt": "2026-07-04T00:00:00.000Z",
  "createdAt": "2026-01-15T12:00:00.000Z",
  "stripeModeHint": "test",
  "waConnected": true,
  "membersCount": 3
}
```

---

## PATCH /api/admin/ops/organizations/:id/plan

Alteração manual de plano (staff).

### Body

```json
{
  "plan": "pro",
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "reason": "Upgrade comercial aprovado"
}
```

| Campo | Regra |
|-------|-------|
| `plan` | obrigatório |
| `reason` | 5–300 chars |
| `expiresAt` | opcional; null limpa em free |

### Resposta

Org atualizada + invalidação cache summary.

### Audit

`admin.plan.changed`

### Erros

`404` org não encontrada · `400` validação · `403` sem `system:plans:manage`

---

## POST /api/admin/ops/organizations/:id/trial/extend

### Body

```json
{
  "days": 14,
  "reason": "Extensão comercial aprovada",
  "plan": "starter"
}
```

| Campo | Regra |
|-------|-------|
| `days` | 1–90 |
| `reason` | 5–300 chars |
| `plan` | opcional; free → starter default |

### Audit

`admin.trial.extended`

---

## POST /api/admin/ops/organizations/:id/trial/cancel

### Body

```json
{
  "reason": "Trial encerrado por inadimplência interna"
}
```

Downgrade para `free`, preserva dados.

### Audit

`admin.trial.cancelled`

---

## GET /api/admin/ops/security-events

Feed global sanitizado (últimas 24h default).

### Query

| Param | Default | Regra |
|-------|---------|-------|
| `limit` | 25 | max 100 |
| `kind` | — | filtro exato |
| `level` | — | info \| warning \| critical \| error |
| `source` | — | attendance \| system \| audit \| billing \| … |
| `from` / `to` | 24h | ISO |

### Fontes

- `AttendanceEvent` — kinds críticos (ticket, form, billing, ai, bridge)
- `SystemLog` — warn + error
- `AuditLog` — admin.*, billing.*, webhook.*, security.*, auth.login_failed

### Resposta `200`

`AdminOpsSecurityEventsPage` — **sem** meta/payload/details.

### Testes

- `admin-ops-security-events.service.test.ts`
- `admin-ops-anti-secret.test.ts`
- E2E aba Segurança

### Exemplo item

```json
{
  "id": "att:674b…",
  "source": "ticket",
  "level": "warning",
  "kind": "ticket.public_lookup_failed",
  "title": "Lookup ticket inválido",
  "message": "Ticket TK-0001",
  "organizationId": "674a…",
  "organizationName": "Empresa Demo",
  "createdAt": "2026-06-27T11:30:00.000Z"
}
```

---

## Erros comuns

| Código | Causa |
|--------|-------|
| 401 | Sessão expirada |
| 403 | Tenant comum ou moderator sem `system:plans:manage` em mutação |
| 404 | Organization id inválido |
| 400 | Motivo curto, plano inválido, days fora de 1–90 |
| 500 | Falha Mongo/Redis — retry |

---

## O que nunca deve ser exposto

```txt
sk_test_ / sk_live_ / whsec_
STRIPE_SECRET_KEY / OPENAI_API_KEY / GEMINI_API_KEY
JWT_SECRET / SESSION_ENCRYPTION_KEY
sessionData / QR WhatsApp / publicAccessToken
Authorization / Cookie / Bearer
stripeSubscriptionId (valor real)
meta bruto / payload bruto / job.data
e-mail owner em massa / telefone cru
```

---

*Referência técnica Admin Ops · Etapa 6 · sem secrets em exemplos · sem Stripe live.*
