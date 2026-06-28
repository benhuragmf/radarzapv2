# RadarZap — Auditoria Horizontal — Segurança, Dados, Código e Estabilidade

**Versão auditada:** `2.12.45` → hardening `2.12.46`  
**Data:** 2026-06-28  
**Branch:** `develop`  
**Commit base:** `3ebd4be` (Etapa 10 QA admin ops)  
**Modo:** somente leitura + hardening mínimo autorizado  
**Status final:** `AUDITORIA HORIZONTAL CONCLUÍDA` · `PRONTO PARA CORREÇÕES PRIORITÁRIAS` · `PRONTO PARA QA MANUAL COMPLEMENTAR`

> **Não declarado:** produção pronta · go-live liberado · Stripe live · deploy VPS

---

## Resumo executivo

Auditoria horizontal do RadarZap v2 cobrindo segurança de dados, RBAC, multi-tenant, estabilidade, escalabilidade, billing, IA, WhatsApp/WebChat/Inbox e Admin Ops. Gates automatizados **verdes** (build, admin-ops 65/65, E2E admin 27/27, qa:atendimento 235/235).

**Veredito:** o sistema tem **base sólida de hardening** (TOP 18, mask-secret, audit ampliado, admin ops RBAC, token ticket hash, bridge anti-loop). **Não está pronto para go-live** — achados **CRÍTICOS/ALTOS** exigem correção antes de produção: vazamento global em `/api/stats`, filas BullMQ cross-tenant, rotas legadas de plano sem audit, dependência rígida Redis/Mongo, rate limit fail-open.

**Correções aplicadas nesta sessão (2.12.46):** rate limit em anexo WebChat público; validação de origem no GET config de leads.

---

## Escopo auditado

| Área | Cobertura |
|------|-----------|
| Segurança de dados / LGPD | mask-secret, AuditLog, AttendanceEvent, sessionData, tokens |
| Segurança do código | Auth, RBAC, rotas públicas, webhooks, rate limits |
| Multi-tenant | clientId/organizationId, WebChat/leads públicos, admin global |
| Estabilidade | Mongo, Redis, BullMQ, WA, bridge, IA fallback |
| Escalabilidade | Paginação admin, índices, TTL logs, aggregations |
| Billing / trial / planos | Stripe test, dev activate, rotas Ops vs legado |
| IA créditos | Carteira, limites LM, consumo proporcional |
| WhatsApp / WebChat / Inbox / Bridge | Sessão criptografada, anti-loop, CSAT, tickets |
| Frontend UX falha | Admin dashboard, error states, guard 403 |
| Admin Ops | Etapas 1–10, RBAC, anti-segredo |
| Documentação | TOP 01–20, CHANGELOG, índice, roadmap |

**Fora do escopo:** deploy VPS, Stripe live, QA manual A–J completo, testes de carga.

---

## Estado Git e versão

| Item | Valor |
|------|-------|
| Branch | `develop` |
| Versão package.json | `2.12.45` → `2.12.46` (hardening pós-auditoria) |
| Modificados (pré-auditoria) | `docs/concluidos/README.md` |
| Untracked sensíveis (não commitar) | `data/`, `mocker/modelochat/`, `sessions/` |
| Untracked docs | `docs/RADARZAP-PLANO-UPGRADES.md`, `docs/qa-results/*.json`, `docs/referencias/` |
| Código alterado nesta sessão | `WebChatService.ts`, `lead-form-public.routes.ts`, docs auditoria |

---

## Segurança de dados

### Controles existentes (positivos)

| Controle | Evidência |
|----------|-----------|
| `sessionData` WA criptografado | `WhatsAppSession.ts` — AES, `select` implícito |
| Token ticket hash + hint | `InboxTicket.publicAccessTokenHash` `select: false` |
| mask-secret oficial | `mask-secret.util.ts` — sk_, whsec_, wck_, lfm_, QR |
| AuditLog/AttendanceEvent redact | `redactSensitiveMeta` antes de persistir |
| Admin ops anti-segredo | `admin-ops-summary.util.ts`, testes `admin-ops-anti-secret` |
| Stripe payload não em log | `BillingService` webhook HMAC |
| Pino redact paths | `logger.ts` ampliado TOP 18 |

### Lacunas

| ID | Sev | Descrição |
|----|-----|-----------|
| **AH-D01** | MÉDIO | `allowedDomains` vazio → origem aberta (WebChat + Leads) — config tenant |
| **AH-D02** | MÉDIO | `AttendanceEvent`/`AuditLog` crescem sem TTL (só SystemLog 30d) |
| **AH-D03** | BAIXO | Provider IA prompt completo não documentado como proibido em audit |
| **AH-D04** | BAIXO | Portal LGPD export/delete pendente (doc TOP 18) |

**Resposta Q1:** Parcialmente seguro — mascaramento robusto, mas config padrão permissiva em embeds públicos.

---

## Segurança do código

### Rotas admin — mapa RBAC

Todas as rotas `/admin/*` auditadas possuem `requireCapability`. Separação read (`DASHBOARD_GLOBAL`) vs mutate (`SYSTEM_PLANS_MANAGE`) correta para moderator.

| Rota | Cap | Tenant scoped? |
|------|-----|----------------|
| `GET /admin/ops/summary` | `dashboard:global` | Global (staff) |
| `GET /admin/ops/organizations` | `dashboard:global` | Global (staff) |
| `POST/PATCH …/plan`, trial | `system:plans:manage` | Global + AuditLog |
| `GET /admin/monitoring` | `logs:global` | Global |
| `GET /admin/audit-logs` | `system:audit:view` | Global |

### Rotas públicas

| Endpoint | Auth | Rate limit | Risco |
|----------|------|------------|-------|
| `/api/webchat/public/*` | `wck_*` / visitor token | POST 120/min; GET skip | MÉDIO |
| `/api/leads/public/*` | `lfm_*` | compartilhado webchatPublic | MÉDIO (GET config — **corrigido 2.12.46**) |
| Ticket lookup TK+token | hash + origin | in-memory clientId:ip | MÉDIO |
| `/api/billing/webhook/stripe` | HMAC Stripe | sem rate limit | BAIXO |

**Resposta Q4–Q5:** Endpoints sensíveis com auth adequada; gaps em superfície pública e `/api/stats` tenant.

---

## RBAC e rotas

Frontend `ROUTE_PERMISSIONS` alinhado com backend para rotas admin auditadas (Etapa 9). Guard React bloqueia tenant em `/admin/dashboard` (E2E confirma).

| ID | Sev | Rota | Problema |
|----|-----|------|----------|
| **AH-R01** | **CRÍTICO** | `GET /api/stats` | `buildStats()` global — expõe orgs, sessões WA, filas a qualquer `dashboard:view` |
| **AH-R02** | **ALTO** | `GET /api/queue/failed` | `job.data` cross-tenant sem filtro |
| **AH-R03** | **ALTO** | `PATCH /admin/organizations/:id/plan` (legado) | Sem AuditLog/motivo |
| **AH-R04** | **ALTO** | `PUT /users/:id/plan` | Muta `User.plan` legado, sem audit |
| **AH-R05** | MÉDIO | `POST /panel/notifications/ingest` | Atendente pode injetar eventos sino |
| **AH-R06** | MÉDIO | Socket.IO CORS `*` + `wcp_` sem auth forte | Presença WebChat |

**Resposta Q3:** RBAC coerente em admin ops; gap crítico em stats/filas tenant.

---

## Multi-tenant e isolamento

| ID | Sev | Área | Descrição |
|----|-----|------|-----------|
| **AH-M01** | **ALTO** | `/api/stats`, `/api/queue` | Dados globais visíveis a tenant |
| **AH-M02** | MÉDIO | WebChat/Leads público | Origem aberta se `allowedDomains` vazio |
| **AH-M03** | MÉDIO | InboxService | `findById` conversa sem `clientId` (defense-in-depth) |
| **AH-M04** | MÉDIO | Testes | Sem E2E cross-tenant inbox/webchat/leads autenticado |
| **AH-M05** | BAIXO | Bridge dedup | Map in-process — não coordena multi-réplica |

**Resposta Q2:** Risco real de vazamento **global→tenant** via stats/filas; isolamento por org em APIs autenticadas está **adequado** (padrão `auth.clientId`).

WebChat/leads públicos: tenant derivado de `publicKey` único global — **correto**.

---

## Estabilidade operacional

| ID | Sev | Área | Descrição |
|----|-----|------|-----------|
| **AH-S01** | **CRÍTICO** | Boot | Mongo + Redis obrigatórios — sem degraded mode |
| **AH-S02** | **ALTO** | Rate limit | Redis fail-open (`allowed: true`) |
| **AH-S03** | **ALTO** | IA | `AiProviderService` fetch sem timeout HTTP |
| **AH-S04** | MÉDIO | Health | `/services/health` não reflete Redis/Mongo |
| **AH-S05** | MÉDIO | Bridge | Anti-loop in-memory — OK single VPS |
| **AH-S06** | BAIXO | BullMQ | Retry/backoff configurado (positivo) |
| **AH-S07** | BAIXO | Webhooks outbound | Timeout 15s + retry 5× (positivo) |

**Resposta Q10–Q11:** Fallbacks lógicos (IA, bridge, CSAT) existem; infra hard dependency bloqueia resiliência.

---

## Escalabilidade horizontal

| Área | Volume esperado | Risco | Índice/cache | Recomendação | Prioridade |
|------|-----------------|-------|--------------|--------------|------------|
| Admin orgs + status filter | 100–10k orgs | **ALTO** full scan | limit 100 página | Aggregation server-side | P1 |
| Security events feed | 1k+/dia | MÉDIO | FETCH_CAP 200/fonte | Paginação cursor | P2 |
| AttendanceEvent admin | Global queries | MÉDIO | Falta `{kind, createdAt}` | Criar índice | P2 |
| Inbox conversas | 10k+/org | BAIXO | Índices presentes | OK piloto | — |
| AuditLog | Ilimitado | MÉDIO | Sem TTL | Política retenção | P3 |
| Admin ops summary | Staff | BAIXO | Cache Redis 60s | OK | — |
| WA sessions | 1/org típico | MÉDIO multi-instância | Lock Redis | Documentar single-instance | P2 |

**Resposta Q11:** Aguenta piloto single-VPS; não escala horizontal sem revisão WA lock + bridge dedup + rate limit Redis.

---

## Billing, trial e planos

| Verificação | Status |
|-------------|--------|
| Trial manual não chama Stripe | ✅ Ops trial extend/cancel |
| Alterar plano exige `system:plans:manage` | ✅ Ops; ⚠️ legado sem audit |
| Mutações Ops com AuditLog | ✅ `admin.plan.changed`, trial events |
| Moderator read-only planos | ✅ E2E confirma |
| Tenant não muta plano | ✅ |
| `stripeSubscriptionId` não exposto | ✅ |
| Stripe live desativado | ✅ test mode |
| Webhook valida assinatura | ✅ HMAC |
| Past_due + grace | ✅ TOP 17 |
| Limites plano aplicados | ✅ parcial (mensagens/dia; widgets doc) |
| Dev activate | ⚠️ `NODE_ENV !== production` — exigir flag explícita |

| ID | Sev | Descrição |
|----|-----|-----------|
| **AH-B01** | **ALTO** | Rota legada `PATCH /admin/organizations/:id/plan` sem audit |
| **AH-B02** | MÉDIO | `POST /billing/dev/activate` sem `ALLOW_DEV_BILLING` obrigatório |

---

## IA Créditos e custos

| Verificação | Status |
|-------------|--------|
| Consumo proporcional por chamada | ✅ `creditWeight`, carteira |
| Limite LM/chamadas | ✅ por plano |
| Timeout provider | ❌ AH-S03 |
| Fallback sem quebrar atendimento | ✅ `recoverFromAiFailure` |
| Prompt sem segredo | ✅ env separado |
| Admin vê uso sem conteúdo | ✅ agregados |
| Logs IA sem chave | ✅ mask-secret |

---

## WhatsApp, WebChat, Inbox e Bridge

| Verificação | Status |
|-------------|--------|
| Sessões criptografadas | ✅ |
| QR não em log indevido | ✅ `isWhatsappQrLogSafe` |
| Bridge anti-loop | ✅ single-node |
| Fila por presença | ✅ round-robin + availability |
| Ticket público TK+token | ✅ hash, rate limit, OTP resend |
| CSAT não bloqueia novo atendimento | ✅ 2.8.11 |
| Inbox org scope | ✅ `getConversationIfAllowed` |
| Anexo WebChat rate limit | ✅ **corrigido 2.12.46** |

| ID | Sev | Descrição |
|----|-----|-----------|
| **AH-W01** | MÉDIO | Anexo visitante sem rate limit — **CORRIGIDO** |
| **AH-W02** | MÉDIO | Origem embed aberta default | Config + alerta painel |

---

## Frontend e UX de falha

| Rota | Loading | Error | 403 | Sensível no DOM |
|------|---------|-------|-----|-----------------|
| `/admin/dashboard` | ✅ | ✅ E2E 500 | ✅ guard | ✅ anti-segredo E2E |
| `/platform/inbox` | ✅ | parcial | ✅ | OK |
| `/platform/leads` | ✅ | ✅ | ✅ | OK |
| `/platform/webchat` | ✅ | parcial | ✅ | OK |
| `/plans` | ✅ | ✅ | ✅ | OK |
| `/dashboard` | ✅ | ⚠️ mostra stats globais errados | ✅ | ⚠️ métricas globais |

Admin Ops: 8 abas, modais com motivo obrigatório (plano/trial), empty states — **aprovado Etapa 7 com ressalvas**.

---

## Logs, auditoria e anti-segredo

- **SystemLog:** TTL 30 dias ✅
- **AuditLog / AttendanceEvent:** redact meta ✅; sem TTL ⚠️
- **Admin feed segurança:** sanitizado, limit 100 ✅
- **Testes anti-segredo:** `admin-ops-anti-secret.test.ts`, `mask-secret.util.test.ts` ✅

---

## Backups e go-live

| Item | Status |
|------|--------|
| `/admin/backup` UI | ✅ existe |
| PREPARACAO-PRODUCAO | ⏳ referência — não executar |
| Gate Fase 1 ROADMAP | ❌ QA manual A–J incompleto |
| TOP 20 status | `PRONTO PARA QA MANUAL` |
| Stripe live | ❌ não ativar |
| Deploy VPS | ❌ não autorizado |

---

## Achados críticos

### AH-R01 — `/api/stats` vaza dados globais para tenant

| Campo | Valor |
|-------|-------|
| **Severidade** | CRÍTICO |
| **Área** | RBAC / multi-tenant |
| **Arquivo/rota** | `DashboardService.ts` L1298–1304, L7230–7270 |
| **Descrição** | `buildStats()` agrega User, Organization, WhatsAppSession, filas globais |
| **Risco** | Tenant vê contagem total de orgs, sessões WA plataforma, jobs globais |
| **Evidência** | Frontend `Dashboard.tsx` L47 chama `/stats`; `/platform/stats` já é tenant-scoped |
| **Correção** | Escopar `/api/stats` por `auth.clientId` ou deprecar em favor de `/platform/stats` |
| **Prioridade** | P0 |
| **Corrigir agora?** | não (requer ajuste contrato frontend) |

### AH-S01 — Boot exige Mongo + Redis sem degraded mode

| Campo | Valor |
|-------|-------|
| **Severidade** | CRÍTICO |
| **Área** | Estabilidade |
| **Arquivo** | `src/index.ts` |
| **Descrição** | Falha Redis/Mongo encerra processo |
| **Risco** | Indisponibilidade total vs degradação parcial |
| **Correção** | Documentar SPOF; health checks reais; runbook |
| **Prioridade** | P0 (doc) / P2 (código) |
| **Corrigir agora?** | não |

---

## Achados altos

| ID | Área | Descrição | Correção | Agora? |
|----|------|-----------|----------|--------|
| AH-R02 | Filas | `/queue/failed` expõe `job.data` cross-tenant | Filtrar por clientId ou `queue:global` | não |
| AH-R03 | Billing | Plano legado sem AuditLog | Deprecar rota; usar Ops | não |
| AH-R04 | Billing | `PUT /users/:id/plan` legado | Deprecar | não |
| AH-M01 | Multi-tenant | Stats + filas globais | Ver AH-R01/R02 | não |
| AH-S02 | Rate limit | Redis fail-open | fail-closed prod WA | não |
| AH-S03 | IA | Sem timeout HTTP provider | AbortSignal 30s | não |
| AH-B01 | Billing | = AH-R03 | unificar Ops | não |

---

## Achados médios

| ID | Descrição | Prioridade |
|----|-----------|------------|
| AH-D01 | Origem embed aberta default | P2 |
| AH-R05 | Ingest notificações por atendente | P2 |
| AH-R06 | Socket.IO permissivo | P2 |
| AH-M02 | GET leads config sem origin — **CORRIGIDO 2.12.46** | — |
| AH-M03 | findById sem clientId Inbox | P2 |
| AH-M04 | Testes cross-tenant E2E ausentes | P2 |
| AH-S04 | Health não reflete infra | P2 |
| AH-S05 | Bridge dedup single-node | P2 |
| AH-B02 | dev/activate sem flag explícita | P2 |
| AH-W02 | Config domínios vazios | P2 |
| AH-E01 | Admin orgs status filter full scan | P1 |
| AH-E02 | Security events sem paginação real | P2 |
| AH-D02 | AuditLog/AttendanceEvent sem TTL | P3 |

---

## Achados baixos

| ID | Descrição |
|----|-----------|
| AH-R07 | `/services/health` sem cap |
| AH-R08 | Prefixo `/admin/destinations` confuso |
| AH-D03 | Doc prompt IA em audit |
| AH-D04 | Portal LGPD pendente |
| AH-M05 | Bridge dedup multi-réplica futuro |

---

## Correções rápidas permitidas

### Aplicadas (2.12.46)

| ID | Correção |
|----|----------|
| AH-W01 | `assertWebChatSendAllowed` em `sendVisitorAttachment` |
| AH-M02 (parcial) | `assertOrigin` em `GET /leads/public/forms/:publicKey/config` |

### Bloqueadas (requerem escopo maior)

- AH-R01 `/api/stats` — refactor frontend + backend
- AH-R02 filas cross-tenant — redesign cap/filtro
- AH-R03/R04 rotas plano legado — deprecação coordenada
- AH-S01 degraded mode — arquitetura
- AH-S03 timeout IA — testes provider
- Deploy / push / Stripe live

---

## Backlog recomendado

### Pré go-live (P0–P1)

1. Corrigir `/api/stats` → tenant-scoped
2. Isolar `/api/queue/failed` ou elevar cap
3. Unificar mutações plano + audit obrigatório
4. Timeout IA provider
5. Paginação server-side admin orgs com filtro status
6. QA manual VPS rota a rota (Etapa 10)
7. Bloco E browser VPS + AuditLog

### Pós go-live (P2–P3)

- Default deny origem embed em prod
- Rate limit GET público
- Índice AttendanceEvent global
- TTL AuditLog
- Testes cross-tenant E2E
- Hub IA ai-blueprint/platform
- Deprecar `GET /admin/organizations` legado

---

## Gates executados

| Gate | Resultado | Data |
|------|-----------|------|
| `npm run typecheck` | ⚠️ script inexistente — `tsc` via build | 2026-06-28 |
| `npm run build` | ✅ exit 0 | 2026-06-28 |
| `npm test -- admin-ops` | ✅ 65/65 | 2026-06-28 |
| `npm run build --prefix …/frontend` | ✅ | 2026-06-28 |
| `playwright e2e/admin-dashboard.spec.ts` | ✅ 27/27 | 2026-06-28 |
| `npm run qa:atendimento:gate` | ✅ 235/235 + qa:webchat-wa 60/60 | 2026-06-28 |

---

## Status final

```
AUDITORIA HORIZONTAL CONCLUÍDA
PRONTO PARA CORREÇÕES PRIORITÁRIAS
PRONTO PARA QA MANUAL COMPLEMENTAR
```

**Proibido declarar:** `PRONTO PARA PRODUÇÃO` · `GO-LIVE LIBERADO`

**Próximo passo recomendado:** corrigir AH-R01 (stats tenant) + AH-R02 (filas) em sprint dedicado; executar QA manual VPS Etapa 10 (Benhur); Bloco E browser.

---

## Referências

- [`docs/top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md`](../top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md)
- [`docs/admin/RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md`](../admin/RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md)
- [`docs/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](../top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md)
- [`docs/audits/RADARZAP_AUDITORIA_INCREMENTAL.md`](./RADARZAP_AUDITORIA_INCREMENTAL.md)
