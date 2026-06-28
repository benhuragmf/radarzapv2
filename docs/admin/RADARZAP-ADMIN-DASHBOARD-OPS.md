# RadarZap — Admin Dashboard Ops

**Versão:** `2.12.37` · **Atualizado:** 2026-06-27

Visão operacional global para staff RadarZap (`SYSTEM_ADMIN` / `SYSTEM_MODERATOR`). Diagnóstico inicial: [`RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md`](./RADARZAP-ADMIN-DASHBOARD-OPS-DIAGNOSTICO.md).

**Status release:** `PRONTO PARA QA MANUAL` — produção estável **não** declarada.

---

## Visão geral

| Camada | Estado |
|--------|--------|
| **Etapa 1** | Diagnóstico `/admin/dashboard` concluído |
| **Etapa 2** | Backend `GET /api/admin/ops/summary` (agregador seguro) |
| **Etapa 3** | Frontend dashboard ops (pendente) |

O painel `/admin/dashboard` continua usando `GET /admin/monitoring` até a Etapa 3 migrar para o novo endpoint.

---

## Endpoint backend

```http
GET /api/admin/ops/summary
GET /api/admin/ops/summary?refresh=1
```

| Item | Valor |
|------|-------|
| **Capability** | `dashboard:global` (`Cap.DASHBOARD_GLOBAL`) |
| **Implementação** | `admin-ops-summary.service.ts` |
| **Rota** | `DashboardService.ts` |
| **Cache** | Redis TTL 30s (`radarzap:admin:ops:summary:v1`); `?refresh=1` ignora cache |
| **Tipo** | `AdminOpsSummary` em `src/types/admin-ops-summary.ts` |

### Blocos da resposta

- `system` — versão app, `NODE_ENV`, uptime, memória Node, load CPU
- `services` — Mongo, Redis, filas BullMQ (contagens globais)
- `tenants` — organizações por plano e status billing normalizado
- `operations` — WhatsApp, WebChat, Inbox, tickets, leads
- `ai` — créditos consumidos no mês, chamadas premium/básica, orgs com alertas de crédito
- `billing` — modo Stripe (`off|test|live|unknown`), pedidos, past_due
- `security` — contagens 24h (erros, lookup ticket, form blocked, billing limit)
- `alerts` — alertas operacionais sanitizados
- `links` — atalhos para páginas admin existentes

---

## RBAC

| Papel | Acesso |
|-------|--------|
| `SYSTEM_ADMIN` | Sim |
| `SYSTEM_MODERATOR` | Sim (possui `dashboard:global`) |
| Owner/Admin/Manager/Atendente tenant | Não |
| Sem sessão | 401/403 (middleware padrão) |

**Correção vs diagnóstico:** o novo endpoint usa **`dashboard:global`**, alinhado à rota `/admin/dashboard`. `/admin/monitoring` permanece com `logs:global`.

Não aceita `clientId` do cliente para filtrar — métricas são **cross-tenant** apenas para staff.

---

## Métricas disponíveis

| Domínio | Métricas |
|---------|----------|
| Sistema | versão, env, uptime, RAM heap, loadavg |
| Infra | Mongo/Redis ping + latência, filas waiting/active/failed/delayed |
| Tenants | totais por plano, paid, expired, past_due, trialing |
| WA | connected / inactive / expired |
| WebChat | widgets, conversas abertas, fila, bridges |
| Inbox | abertas, fila, em atendimento, resolvidas hoje |
| Tickets | open, in_progress, client_replied, fechados no mês |
| Leads | forms ativos, leads hoje/mês |
| IA | `creditWeight` mês, calls por `usageKind`, orgs com eventos low/exhausted |
| Billing | stripe mode, pedidos pending/paid, invoice failed, past_due count |
| Security | erros SystemLog 24h + AttendanceEvent kinds críticos |

---

## Métricas não expostas por segurança

- Chaves Stripe, OpenAI, Gemini, webhook secret, JWT, encryption keys
- `WhatsAppSession.sessionData`, QR, credenciais
- Tokens públicos de ticket, cookies, Authorization
- Payload de jobs BullMQ (`job.data`)
- `meta` completo de `AuditLog` / `AttendanceEvent`
- Hostname do servidor
- Disco (não implementado nesta etapa)

---

## Alertas

Gerados por `buildAdminOpsAlerts()`:

1. Mongo down/degraded
2. Redis down/degraded
3. Filas com `failed > 0`
4. WA desconectado > conectado (quando há sessões)
5. Organizações `past_due`
6. Orgs sem crédito IA (eventos `ai.credits.exhausted`)
7. Stripe `off` em `NODE_ENV=production`
8. Stripe `live` (info — revisar QA)
9. Erros sistema 24h > 0
10. QA manual TOP 20 pendente (fixo documental)

---

## Performance e cache

- Queries preferem `countDocuments` e `$aggregate` simples
- Cache Redis 30s; fallback direto se Redis indisponível
- Org billing: scan lean de `Organization` (campos mínimos) — monitorar volume em produção
- `organizationsWithLowCredits` / `WithoutCredits`: distinct `clientId` em `AttendanceEvent` (evita scan wallet completo)

---

## Próximas etapas

1. **Etapa 3** — Evoluir `AdminDashboard.tsx` para consumir `/admin/ops/summary`
2. Error state + cards por seção + links
3. Opcional: OpenAPI + teste E2E admin mock auth
4. QA manual bloco admin no roteiro Fase 1

---

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `src/types/admin-ops-summary.ts` | Contrato TypeScript |
| `src/services/web-dashboard/admin-ops-summary.service.ts` | Agregador |
| `src/services/web-dashboard/admin-ops-alerts.util.ts` | Alertas |
| `src/services/web-dashboard/__tests__/admin-ops-*.test.ts` | Testes |
