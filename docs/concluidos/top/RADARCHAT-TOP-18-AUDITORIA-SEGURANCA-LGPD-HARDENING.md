# Radar Chat — TOP 18/20 — Auditoria, Segurança, LGPD e Hardening

**Versão:** `2.12.4` · **Data:** 2026-06-24 · **Commit base:** `dbcb521` (TOP 17)

---

## Resumo executivo

O TOP 18 consolida a camada transversal de **auditoria, logs seguros, mascaramento de segredos, eventos críticos, hardening de endpoints públicos/webhooks e documentação LGPD**. Helpers centrais em `mask-secret.util.ts`; `AttendanceEvent` e `AuditLog` redactam meta antes de persistir; novos eventos `ticket.public_lookup_failed`, `form.blocked`, `billing.*`.

**Não** implementa QA final (TOP 19) nem congelamento produção (TOP 20). **Não** declara produção pronta.

---

## Herança dos TOPs anteriores

| TOP | Herança para segurança |
|-----|------------------------|
| **04** | RBAC/cross-tenant — revisado |
| **07–08** | Inbox/tickets + token público TK |
| **09–10** | Leads/formulários públicos `lfm_*` |
| **11** | WebChat público `wck_*` |
| **12** | WA QR/credenciais, rate limit sessão |
| **13** | Bridge anti-loop |
| **14–16** | IA + créditos + eventos `ai.*` |
| **17** | Billing Stripe + webhooks HMAC |

**TOP 18 fecha:** máscara oficial, auditoria ampliada, eventos críticos, mapa de rastreabilidade.

**TOP 18 não faz:** portal LGPD completo, SIEM, QA E2E final, refatoração de módulos fechados.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `dbcb521` — `chore(top): billing assinaturas e limites 2.12.3` |
| Untracked (não commitar) | `data/`, `mocker/modelochat/` |

---

## Escopo autorizado

AttendanceEvent, AuditLog, logs, rate limit, webhooks, endpoints públicos, LGPD documentada, testes segurança.

---

## Diagnóstico atual de auditoria

| Domínio | Evento existe? | Arquivo | Lacuna |
|---------|----------------|---------|--------|
| Inbox | Sim | `AttendanceEvent` `inbox.*` | — |
| Tickets | Sim + **TOP 18** | `ticket.*`, `ticket.public_lookup_failed` | — |
| Bridge | Sim | `bridge.*` | — |
| IA Premium | Sim | `ai.premium.*` | — |
| IA Créditos | Sim | `ai.credits.*` | — |
| Billing | **TOP 18** | `billing.checkout.completed`, `invoice.failed`, `ai_credit_pack.purchased`, `limit.blocked` | `checkout.created` pendente |
| Formulários | **TOP 18** | `form.blocked` | `form.submitted` pendente |
| Auth/RBAC | Parcial | `AuditLog` + `writeAuditLog` | login_failed pendente |
| LGPD | Parcial | `ConsentService` + `AuditLog` | export/delete portal pendente |
| WhatsApp | Parcial | logs + `isWhatsappQrLogSafe` | `whatsapp.command_denied` evento pendente |

Modelos: `AttendanceEvent` (atendimento), `AuditLog` (painel/admin).

---

## Diagnóstico atual de logs

| Tipo | Status |
|------|--------|
| Pino estruturado (`logger.ts`) | Seguro — redact paths ampliados TOP 18 |
| `sanitizeLogText` | Seguro — emojis CP1252 |
| `redact-sensitive.ts` | Seguro — e-mail/telefone OAuth |
| **`mask-secret.util.ts`** | **Novo TOP 18** — Stripe, wck, lfm, QR, auth |
| Provider IA prompt completo | Documentar — não persistir em audit |
| Stripe payload bruto | Removido de audit via redact |

---

## Diagnóstico de dados sensíveis e mascaramento

Helper oficial: `src/utils/mask-secret.util.ts`

| Função | Uso |
|--------|-----|
| `maskSecret` | sk_*, wck_*, lfm_*, whsec_* |
| `maskTicketPublicToken` | `[redacted-ticket-token]` |
| `maskQrPayload` | `[redacted-qr]` |
| `redactSensitiveMeta` | AttendanceEvent + AuditLog |
| `sanitizeLogPayload` | Logs estruturados |
| `safeErrorMessage` | Erros sem vazar key |

Integração: `recordAttendanceEvent`, `writeAuditLog`, `logAudit`, `logBusinessEvent`, `logError`.

---

## Diagnóstico de RBAC e cross-tenant

- Painel: `requireCapability` + `auth.clientId` / `organizationId`.
- Testes existentes: `organization-team-cross-tenant.test.ts`, `capabilities-rbac.test.ts`.
- Billing/IA wallet: org scope validado no TOP 17.
- **Regra:** frontend não é única proteção.

---

## Diagnóstico de endpoints públicos

| Endpoint | Auth | Rate limit | Observação |
|----------|------|------------|------------|
| `/api/webchat/public` | `wck_*` widget key | `webchatPublic` | Domínio permitido no widget |
| `/api/leads/public` | `lfm_*` | `webchatPublic` (compartilhado) | Honeypot + origem |
| Ticket lookup | TK + token hash | `ticket-public-lookup-rate-limit` | Audit falha TOP 18 |
| `/api/billing/webhook/stripe` | HMAC | Idempotência order | Sem payload em log |
| `widget.js` / `form.js` | Estático | Cache | Sem segredo embutido |

---

## Diagnóstico de webhooks

| Webhook | Assinatura | Idempotência | Log seguro |
|---------|------------|--------------|------------|
| Stripe inbound | HMAC `STRIPE_WEBHOOK_SECRET` | BillingOrder paid | Sim |
| Outbound Radar Chat | HMAC `X-Radar Chat-Signature` | Fila BullMQ | Sim |
| Bridge | Eventos `webchat.bridge.*` | Anti-loop | Sim |

---

## Diagnóstico de rate limit

| Área | Existe? | Limite | Lacuna |
|------|---------|--------|--------|
| WebChat public POST | Sim | 120/min prod | — |
| Lead form submit | Sim | Mesmo limiter público | — |
| Ticket lookup | Sim | 8 falhas/15min IP+org | — |
| Ticket token resend | Sim | 5/15min + cooldown 2min | — |
| Auth/login | Sim | 10/15min prod | — |
| WA commands | Sim | `whatsapp-session-rate-limit` | — |
| Billing webhook | HMAC | — | Sem rate limit extra (ok) |
| CSV import | Parcial | 16mb body | Limite linhas documentado |

---

## Diagnóstico LGPD

| Direito/Controle | Existe? | Arquivo | Lacuna |
|------------------|---------|---------|--------|
| Consentimento contato | Sim | `ConsentService`, `Destination` | — |
| Consentimento formulário | Sim | `requireConsent` lead form | — |
| Opt-out / recusa progressiva | Sim | `ConsentStatus` REFUSED_* | — |
| Exportação titular | Parcial | CSV contatos | Portal LGPD pendente |
| Anonimização/delete org | Parcial | `OrganizationDeletionService` | Self-service pendente |
| Soft delete tickets | Sim | `deletedAt` InboxTicket | — |
| Retenção histórico | Catálogo | `historyRetentionDays` plans | Purge automático pendente |
| Auditoria consentimento | Sim | `writeAuditLog` | — |

Doc: [`CONSENTIMENTO-LGPD.md`](../CONSENTIMENTO-LGPD.md).

---

## Diagnóstico por módulo

| Módulo | Segurança | Auditoria | LGPD | Rate limit | Risco |
|--------|-----------|-----------|------|------------|-------|
| Auth/RBAC | Alto | Médio | — | Sim | login_failed audit |
| Inbox | Alto | Alto | — | — | Baixo |
| Tickets | Alto | Alto | — | Sim | Baixo pós-TOP 18 |
| Leads/Forms | Alto | Médio | Sim | Sim | Baixo |
| WebChat | Alto | Médio | — | Sim | Baixo |
| WhatsApp | Alto | Médio | Sim | Sim | QR nunca em log |
| Bridge | Alto | Alto | — | — | Baixo |
| IA | Alto | Alto | — | Créditos | Prompt em audit evitar |
| Billing | Alto | Alto | — | HMAC | Baixo |
| Upload | Médio | Baixo | — | Tamanho | Validar MIME |

---

## Mapa oficial de eventos auditáveis

### Implementados (`AttendanceEvent.kind`)

`ticket.*`, `ticket.public_lookup_failed`, `inbox.*`, `bridge.*`, `triage.classified`, `ai.premium.*`, `ai.credits.*`, `form.blocked`, `billing.checkout.completed`, `billing.invoice.failed`, `billing.ai_credit_pack.purchased`, `billing.limit.blocked`.

### Pendentes controlados

`auth.login_failed`, `lead.created`, `lead.exported`, `whatsapp.session_connected`, `lgpd.export_requested`, `lgpd.delete_requested`, `billing.checkout.created`.

### Admin (`AuditLog.action`)

Equipe, IA settings, consentimento, org delete — via `writeAuditLog` com meta redactada.

---

## Regras oficiais de logs seguros

1. Nunca logar Stripe secret, webhook secret, API key IA, QR, token ticket, Authorization, cookie, payload Stripe bruto.
2. Usar `mask-secret.util` em audit e logs de negócio.
3. Pino redact paths para campos comuns sensíveis.
4. Erros: `safeErrorMessage` quando expor ao cliente.

---

## Regras oficiais de segurança pública

1. Token público por widget/form (`wck_*`, `lfm_*`) — não aceitar `clientId` solto.
2. Ticket: ref + token verificado por hash — mensagem genérica em falha.
3. Resposta sem IDs internos desnecessários.
4. CORS `origin: true` com validação domínio no backend (forms/widgets).

---

## Regras oficiais de LGPD

1. Consentimento antes de outbound; inbound Inbox livre.
2. 3 recusas → bloqueio definitivo.
3. Export CSV disponível; portal titular → go-live.
4. Logs com PII mínima (`redactPhone`, `redactEmail`).

---

## Regras oficiais de rate limit

Ver tabela diagnóstico. Dev mode relaxa limites (`isDevelopment()`).

---

## Regras oficiais de hardening de webhooks

1. Validar HMAC antes de processar.
2. Idempotência em pagamentos/créditos.
3. Metadata `organizationId` obrigatória para billing.
4. Não logar body bruto.

---

## Eventos, logs e rastreabilidade

Todo evento novo: `clientId`, ator opcional, meta mínima, **sem segredo** (redact automático em `recordAttendanceEvent`).

---

## Atualização da documentação mestre

`docs/RADARCHAT-SISTEMA-COMPLETO.md` §21, CHANGELOG, INDICE, SISTEMA-REGISTRO, README.

---

## Correções ou ajustes aplicados

- `mask-secret.util.ts` + testes.
- `recordAttendanceEvent` / `writeAuditLog` redact meta.
- `ticket.public_lookup_failed` em lookup inválido.
- `form.blocked` em honeypot/origem negada.
- `billing-audit.util.ts` + eventos billing.
- `billing.limit.blocked` em plan-limit-enforcement.
- Logger: redact paths + logAudit/logError redact.
- Testes: mask-secret, attendance redact, ticket audit.

---

## Testes criados ou atualizados

- `mask-secret.util.test.ts` (12 casos)
- `attendance-audit.service.test.ts` — redact meta
- `ticket-public-access.service.test.ts` — audit sem token
- Gate: `mask-secret` no `qa:atendimento:gate`

---

## Gates executados

```bash
npm run typecheck   # verde
npm run build       # verde
npm test            # 772 passed
npm run qa:atendimento:gate  # verde (+ qa:webchat-wa)
```

Frontend: não alterado.

---

## Arquivos alterados

- `src/utils/mask-secret.util.ts`, `logger.ts`, `redact-sensitive.ts` (inalterado)
- `src/models/AttendanceEvent.ts`, `AuditLog.ts`
- `src/services/attendance/attendance-audit.service.ts`
- `src/services/billing/billing-audit.util.ts`, `BillingService.ts`, `plan-limit-enforcement.ts`
- `src/services/inbox/ticket-public-access.service.ts`
- `src/services/leads/LeadFormService.ts`
- Testes + docs + `package.json` 2.12.4

---

## Riscos reduzidos

- Segredos/tokens não persistem em audit bruto.
- Lookup ticket inválido auditado sem token.
- Billing/limites geram evento rastreável.
- Logs estruturados com redact ampliado.

---

## Riscos restantes

- Portal LGPD export/delete self-service.
- Eventos auth/whatsapp/lead export pendentes.
- Purge automático retenção histórico.
- QA manual final → TOP 19.

---

## Decisões pendentes para Benhur

1. Portal LGPD para titular antes do go-live?
2. Retenção automática vs manual de histórico?
3. SIEM/export de `AttendanceEvent` para ferramenta externa?

---

## Próximo passo recomendado

**TOP 19** — QA final automatizado e manual (roteiro completo, E2E, checklist go-live preparatório).
