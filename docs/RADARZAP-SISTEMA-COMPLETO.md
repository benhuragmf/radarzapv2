# RadarZap — Documentação Completa do Sistema

**Versão:** `2.12.6` · **Atualizado:** 2026-06-24

> **Este é o documento principal do RadarZap v2.** Leia-o antes de qualquer módulo específico.  
> Resumo executivo: [`RADARZAP-RESULTADO-FINAL-TOP-01-20.md`](./RADARZAP-RESULTADO-FINAL-TOP-01-20.md) · **Fonte oficial pós-TOP 20:** [`top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) · Índice: [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) · Auditoria TOP 01–21: [`top/`](./top/).

| Campo | Valor |
|-------|-------|
| **Versão final** | `2.12.6` |
| **Status** | `PRONTO PARA QA MANUAL` |
| **Produção estável** | Não declarada |
| **Deploy** | Não executado |
| **Stripe live** | Não ativado |
| **Push** | Não realizado (TOP 20/21) |
| **QA manual A–J** | Pendente (Benhur) |
| **Próximo passo** | QA manual A–J + infra (VPS/SSL/env) — ver TOP 20 |

---

## 1. Visão geral do produto

O RadarZap é uma plataforma SaaS multi-tenant para **atendimento omnicanal** (WhatsApp Baileys, WebChat, formulários de leads), **automação** (campanhas, regras, Discord→WhatsApp opcional), **Inbox** com filas/setores, **tickets** (`TK-…`), **IA** (Básica e Premium), **equipe/RBAC**, **consentimento LGPD** e **API REST** (`/api`, `X-API-Key`).

**Fase atual:** estabilização (Fase 1) — ver [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md). Não declarar produção pronta até QA manual TOP 20 e gate de estabilização.

---

## 2. Stack técnica

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js, TypeScript |
| API painel | Express (`DashboardService.ts`, base `/api`) |
| WhatsApp | Baileys (sessão por organização) |
| Banco | MongoDB (Mongoose) |
| Fila | BullMQ (Redis) |
| Frontend | React + Vite + TanStack Query |
| Design system | `frontend/src/design-system/` |
| Auth | Cookie sessão painel; RBAC capabilities |
| Billing | Stripe (parcial) |
| Testes | Jest, Playwright E2E |

---

## 3. Como rodar localmente

```bash
npm install
cp .env.example .env   # Mongo, Redis, SESSION_ENCRYPTION_KEY, etc.
npm run dev            # monolito (backend + painel)
```

Gates locais: `npm run typecheck`, `npm run build`, `npm test`, `npm run qa:atendimento:gate`.

Frontend isolado: `cd src/services/web-dashboard/frontend && npm run dev`.

---

## 4. Estrutura de pastas

| Pasta | Conteúdo |
|-------|----------|
| `src/index.ts` | Boot monolito |
| `src/services/whatsapp/` | Baileys, sessão, envio |
| `src/services/inbox/` | Inbox, triagem, tickets, comandos WA |
| `src/services/webchat/` | Widget, API pública |
| `src/services/web-dashboard/` | API painel + frontend |
| `src/models/` | Schemas MongoDB |
| `src/auth/rbac/` | Papéis e capabilities |
| `src/types/` | Tipos e helpers compartilhados |
| `docs/` | Documentação (este arquivo = entrada principal) |
| `docs/top/` | Auditoria TOP 01–20 |

---

## 5. Versionamento e governança

- Versão em `package.json` (semver interno `2.11.x`).
- Protocolo: [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md).
- Changelog: [`CHANGELOG.md`](./CHANGELOG.md).
- Registro espelho: [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md).
- Regra Cursor: `.cursor/rules/radarzap-v2-system-registry.mdc`.

Ao entregar feature: incrementar versão, atualizar changelog/registro, docs de módulo e índice.

---

## 6. Planos, limites e billing

Matriz oficial TOP 03: [`top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md`](./top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md).

Campos relevantes: `messagesPerDay`, `whatsappDestinations`, `webchatWidgets`, `aiCreditsMonthly`, assentos equipe.

Billing Stripe documentado em [`BILLING.md`](./BILLING.md). Enforcement completo de excedentes → TOP 17.

---

## 7. RBAC, cargos e permissões

Documento: [`EQUIPE-RBAC.md`](./EQUIPE-RBAC.md). Auditoria TOP 04: [`top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md`](./top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md).

- Presets: OWNER, ADMIN, MANAGER, ATTENDANT, INTEGRATION.
- Papéis custom por organização (`customRoles[]`).
- WhatsApp sessão: `whatsapp:session:view` (ver status), `whatsapp:session:manage` (conectar/desconectar — tipicamente OWNER).

---

## 8. Equipe, status, presença e fila

TOP 05: [`top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md`](./top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md).

- Round-robin e fila só para atendentes `online`.
- `supervisor_online`, `ocupado`, `ausente`, `offline` não recebem atribuição automática.
- Limite de conversas simultâneas por plano.

---

## 9. Modos de atendimento

Consolidado: [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md). TOP 06: [`top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md`](./top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md).

Modos: `disabled`, `robotic`, `basic_triage`, `premium_assistant`, `hybrid`.

Aplicam-se a WhatsApp e WebChat conforme pipeline inbound de cada canal.

---

## 10. Inbox, conversas, fila e transferência

[`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md). TOP 07: [`top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md`](./top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md).

- Lista unificada WA + WebChat (`wc:` prefix).
- Setores públicos/internos (`internalRank`).
- CSAT pós-encerramento, chat interno supervisor.

---

## 11. Tickets, chamados e protocolo TK

[`TICKET-ATENDIMENTO.md`](./TICKET-ATENDIMENTO.md). TOP 08: [`top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md`](./top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md).

- Formato `TK-…` + token público.
- Janela 12h retorno cliente; notas internas (`!nota`) não vão ao cliente.
- Comandos equipe via WhatsApp documentados no TOP 12.

---

## 12. Contatos, Leads, Kanban e deduplicação

[`LEADS-FORMULARIO.md`](./LEADS-FORMULARIO.md). TOP 09: [`top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md`](./top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md).

- Todo inbound WA cria/atualiza contato (`Destination`).
- Lead só com intenção comercial; `oi` genérico não cria lead.
- Dedupe por telefone na organização.

---

## 13. Formulários públicos e embed

TOP 10: [`top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md`](./top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md).

- `form.js`, `/api/leads/public`.
- Independente do canal WhatsApp.

---

## 14. WebChat e widget

[`WEBCHAT.md`](./WEBCHAT.md). TOP 11: [`top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md`](./top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md).

- Widget `widget.js`, API `/api/webchat/public`.
- Pré-chat, FAQ, fila, modos IA, fallback WA deferido no widget.

---

## 15. WhatsApp

TOP 12: [`top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md`](./top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md).

| Área | Implementação |
|------|----------------|
| Serviço | `WhatsAppService.ts` (Baileys) |
| Sessão Mongo | `WhatsAppSession.ts` (credenciais criptografadas) |
| QR / status | `waSessionEvents.ts`, eventos WS painel |
| APIs | `GET/POST /api/sessions/*` com RBAC |
| Inbound | → contato → Inbox → modo atendimento / comandos |
| Outbound | Fila humanizada + rate limit por tipo |
| Comandos `!` | `whatsapp-agent-command.service.ts` (equipe autorizada) |
| Helpers TOP 12 | `whatsapp-session.util.ts` |

**Código:** fechado no TOP 12 (comandos, sessão, rate limit, testes automatizados).  
**Pendente:** QR real, sessão real, inbound/outbound e comandos em ambiente final — **QA manual TOP 20 bloco D** ([`top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md)).

**Cloud API Meta:** stub 503 — não pronto para produção.

---

## 16. Bridge WebChat ↔ WhatsApp

TOP 13: [`top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md`](./top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md). QA manual: [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md).

| Fluxo | Implementação |
|-------|----------------|
| Fallback WA (alerta equipe) | `webchat-whatsapp-fallback.service.ts` — rotação, cooldown 15 min |
| Assumir via `!assumir` | `whatsapp-agent-command.service.ts` → `activateWhatsappBridge` |
| Sync visitante → WA | `forwardVisitorMessageToWhatsappBridge` (bridge ativa) |
| Sync atendente WA → WebChat | `handleWhatsappBridgeAgentReply` — roteamento `TK-XXXX texto` |
| Anti-loop | `filterFallbackAlertPhones`, dedupe forward, `isBridgeLoopRisk` |
| Helpers TOP 13 | `webchat-bridge.util.ts`, `webchat-whatsapp-bridge.util.ts` |
| Eventos | `bridge.started/closed/agent_reply/message_forwarded/loop_prevented`, webhooks `webchat.bridge.*` |
| Inbox | Conversa única `wc:` + `whatsappBridgeActive` badge |

**Não suportado / pendente (código):** sync bidirecional automático sem `!assumir`; comando `!responder` dedicado (resposta por contexto ativo).

**Código:** fechado no TOP 13 (fallback, `!assumir`, sync, anti-loop, webhooks, testes).  
**Pendente:** validação real em ambiente final (alerta WA → `!assumir` → resposta no WebChat, sem loop) — **QA manual TOP 20 bloco E**.

---

## 17. IA Básica

TOP 14: [`top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md`](./top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md).

| Área | Implementação |
|------|----------------|
| Conceito | Triagem/roteamento — **não** chat livre |
| Classificador local | `basic-triage-classifier.ts` — keywords, sem LLM obrigatório |
| Serviço WA | `AiBasicTriageService.ts` |
| Serviço WebChat | `webchat-basic-triage.service.ts` |
| Modos | `basic_triage`, `hybrid` (cadeia básica) |
| Intenções produto | `basic-triage.util.ts` — sales, support, billing, ticket_status, … |
| Confiança | alta ≥0.75 roteia; média esclarece; baixa → fila |
| LLM opcional | `basicTriageLlmFallbackEnabled` + gate créditos |
| Leads | `hasCommercialLeadIntent` — só intenção comercial (TOP 09) |
| Bridge | `shouldSkipBasicTriageForBridge` — não reprocessa |
| Auditoria | `AttendanceEvent` `triage.classified` |

**IA Premium profunda → TOP 15.** Créditos/recarga → TOP 16.

---

## 18. IA Premium

Assistente **generativo controlado** (`premium_assistant` / etapa Premium do `hybrid`): responde com LLM + base/FAQ/contexto, consome créditos via `AiUsageMeterService`, e transfere para fila humana quando gates falham ou confiança é baixa.

| Módulo | Função |
|--------|--------|
| IA Básica (TOP 14) | Classifica e encaminha — não substituída |
| IA Premium (TOP 15) | Resposta generativa com KB/FAQ + handoff |
| IA Créditos | Gate de custo — recarga/compra → TOP 16 |
| Billing | Planos/limites — enforcement → TOP 17 |

**Serviços:** `AiConversationService` (WhatsApp/Inbox), `WebChatAiService` (widget), `AiProviderService`, `AiAutoResolveService` / `AiKnowledgeBaseService` (FAQ/KB), `AiPromptBuilderService`, `AiEscalationService`.

**Gate oficial** (`premium-ai.util.ts` → `evaluatePremiumAiGate`): modo `premium_assistant`/`hybrid`, provider/credencial (`AiProviderService.resolveApiKey`), créditos (`AiUsageMeterService`), não-comando `!`, bridge inativa (`shouldSkipPremiumAiForBridge`), cliente não pediu humano, rate limit OK.

**Limites de resposta:** WebChat 1200 chars, WhatsApp 900, esclarecimento 300 — `sanitizePremiumAiResponse`.

**Handoff:** sem crédito/provider, erro/timeout, baixa confiança, assunto sensível, pedido humano, loop — `AiEscalationService` + fila Inbox/WebChat.

**Auditoria:** `AttendanceEvent` `ai.premium.*` (sem prompt/API key).

**Bridge (TOP 13):** mensagens com `whatsappBridgeActive` não disparam IA Premium no WebChat.

Doc detalhada: [`top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md`](./top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md). Créditos: [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md).

---

## 19. IA Créditos e carteira

Proteção **anti-prejuízo** para LLM RadarZap: saldo mensal por plano + `purchasedCredits` − consumo proporcional ao custo real (`AiUsage` / `creditWeight`).

| Plano | Créditos/mês | Aprendizagem/mês |
|-------|-------------:|-----------------:|
| Free | 0 | 0 |
| Trial | 100 | 10 |
| Starter | 400 | 30 |
| Pro | 2.500 | 120 |
| Enterprise | 12.000 | 500 |

**Serviços:** `AiWalletService`, `AiUsageMeterService`, `Organization.aiWallet`.

**Gate:** `canConsumeAiCredits` / `getUsageSnapshot` antes de `AiProviderService.complete`; chave própria (`mode: company`) não debita carteira RadarZap.

**Consome:** IA Básica LLM fallback, IA Premium LLM RadarZap. **Não consome:** robotizado, triagem local, FAQ/auto-resolve local, handoff, bridge.

**Sem crédito:** WebChat → fila + mensagem segura ao cliente; WhatsApp → triagem padrão/fila; painel alerta interno.

**Alertas:** 80% / 90% / 100% — `ai-credit-alerts.util.ts` + `PanelCriticalAlertsService`.

**Pacotes extras:** catálogo `config/plans.json` → `GET /platform/ai/credit-packages`; ajuste manual `POST /platform/ai/wallet/purchased` (RBAC `billing:manage`, sem checkout — TOP 17).

**API saldo:** `GET /platform/ai/balance` (`inbox:ai:balance:view`).

Doc: [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md), [`top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md`](./top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md).

---

## 20. Billing, assinaturas e bloqueios

[`BILLING.md`](./BILLING.md) · [`top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md`](./top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md).

- **Catálogo:** `config/plans.json` (TOP 03) — Trial/Free/Starter R$99/Pro R$299/Enterprise.
- **Stripe:** checkout assinatura (`starter`/`pro`) + pacotes IA (`pack_1k`/`pack_5k`/`pack_15k`); modo teste com `sk_test_…`.
- **Webhooks:** HMAC `STRIPE_WEBHOOK_SECRET`; eventos assinatura + `invoice.payment_failed` (grace 3d).
- **Status:** `billing-state.util.ts` — `active`, `past_due`, `unpaid`, `canceled`, etc.
- **Limites backend:** equipe (TOP 04), formulários, widgets WebChat, leads/mês, contatos, tickets/mês, IA créditos (TOP 16).
- **RBAC:** `BILLING_MANAGE`; cross-tenant bloqueado.
- **Pendências:** trial runtime na org, gateway BR, Customer Portal, alguns limites (`whatsappDestinations`, `conversationsPerMonth`). Auditoria billing → TOP 18.

---

## 21. Logs, auditoria, segurança e LGPD

[`top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md`](./top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md) · [`CONSENTIMENTO-LGPD.md`](./CONSENTIMENTO-LGPD.md) · [`WEBHOOKS.md`](./WEBHOOKS.md).

- **Mascaramento:** `src/utils/mask-secret.util.ts` — Stripe, wck/lfm, QR, ticket token, cookie/auth.
- **Auditoria:** `AttendanceEvent` (atendimento) + `AuditLog` (admin); meta redactada antes de persistir.
- **Eventos TOP 18:** `ticket.public_lookup_failed`, `form.blocked`, `billing.checkout.completed`, `billing.invoice.failed`, `billing.ai_credit_pack.purchased`, `billing.limit.blocked`.
- **Logs:** Pino com redact paths; `logAudit`/`logError` redactam contexto.
- **Rate limit:** WebChat/lead público, auth, ticket lookup/resend, WA sessão.
- **Webhooks:** HMAC Stripe + outbound; sem payload bruto em log.
- **Multi-tenant:** API filtra por `clientId`; RBAC no painel.
- **Admin ops (2.12.37+):** `GET /api/admin/ops/summary` — agregador cross-tenant; UI completa em `/admin/dashboard` (2.12.38).
- **LGPD:** consentimento contato/form; export CSV; portal titular pendente go-live.
- **Pendências:** `auth.login_failed`, purge retenção, QA manual WA → TOP 20.

---

## 22. QA, testes e gates obrigatórios

**Versão ref.:** `2.12.5` (TOP 19) · Doc completo: [`top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md`](./top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md)

### Gates obrigatórios (CI / pré-merge)

| Comando | Uso | TOP 19 |
|---------|-----|--------|
| `npm run typecheck` | TypeScript backend | Verde |
| `npm run build` | Build backend | Verde |
| `npm test` | Jest (127 suites, 772 testes) | Verde |
| `npm run qa:atendimento:gate` | Atendimento + billing/IA/audit + `qa:webchat-wa` | Verde |

### Gates pré-TOP 20

| Comando | Uso | TOP 19 |
|---------|-----|--------|
| `npm run qa:fase1:e2e` | Playwright 6 specs (38 testes chromium) | Verde |
| `npm run qa:fase1:all` | E2E + gate atendimento | Equivalente verde |
| `npm run qa:gate` | test + build + frontend build | Equivalente verde |
| `npm run build --prefix src/services/web-dashboard/frontend` | Painel Vite | Verde |

### Scripts auxiliares

`qa:prep`, `qa:webchat-wa:setup`, `qa:leads:setup`, `qa:manual:start` (= atendimento gate), `lint` / `lint:all` (backend).

### Sequência recomendada (evitar paralelo em OneDrive)

```bash
npm run typecheck
npm run build
npm test
npm run qa:atendimento:gate
npm run build --prefix src/services/web-dashboard/frontend
npm run qa:fase1:e2e
```

### Roteiro manual (TOP 20)

Blocos A–J no doc TOP 19: login, equipe, WebChat, WhatsApp, bridge, tickets, leads, IA, billing, segurança/LGPD. Templates: [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md), [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md).

### Critérios TOP 20

- Gate humano WhatsApp (QR, inbound, comandos, bridge) verde.
- Stripe **test** checkout + webhook; live só após checklist.
- SSL, CORS, secrets em env — sem commit de credenciais.
- **Não** marcar produção pronta sem TOP 20.

### Riscos restantes (pós TOP 19)

Baileys real, bridge em prod, Stripe live, ESLint frontend legado (159), Jest open handles, infra backups/SSL.

Mapas legados: [`QA-FASE1-AUTOMATIZACAO.md`](./QA-FASE1-AUTOMATIZACAO.md), [`QA-FASE1-RAPIDO.md`](./QA-FASE1-RAPIDO.md).

---

## 23. Deploy, produção e checklist final

**Versão ref.:** `2.12.6` (TOP 20) · **Status:** `PRONTO PARA QA MANUAL`

### Gates finais (TOP 20)

| Gate | Status |
|------|--------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test` (772) | Verde |
| `npm run qa:atendimento:gate` | Verde |
| `npm run qa:fase1:e2e` (38) | Verde |
| Frontend build | Verde |

### Documentos TOP 20

| Doc | Conteúdo |
|-----|----------|
| [`top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) | Congelamento, checklists produção, QA manual A–J |
| [`RADARZAP-RESULTADO-FINAL-TOP-01-20.md`](./RADARZAP-RESULTADO-FINAL-TOP-01-20.md) | Leitura rápida pós 20 TOPs |
| [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md) | § Resultado QA Manual TOP 20 |

### Checklists preparados

- VPS, SSL, domínio, CORS, reverse proxy
- Variáveis de ambiente (sem valores no git)
- Mongo, Redis, filas, storage, backup
- Stripe test/live, webhooks, trial
- WhatsApp QR real, comandos, rate limit
- WebChat embed, bridge, anti-loop
- IA, créditos, alertas
- Segurança, logs, LGPD
- Monitoramento e operação

### Riscos e pendências

Blockers go-live: QA manual A–J, WhatsApp real, bridge real, VPS/SSL/env, backups.  
Não críticos: lint frontend, Jest handles, portal LGPD, Customer Portal.

### Execução deploy

Referência: [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md), [`PRODUCTION.md`](./PRODUCTION.md).  
**Deploy não executado no TOP 20.** Stripe live não ativado.

---

## 24. Roadmap TOP 01–20

> **Preservação:** cada linha abaixo corresponde a um arquivo **imutável** em `docs/top/RADARZAP-TOP-NN-*.md` (auditoria). Não remover nem mover sem autorização Benhur. Índice completo: [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) · regra: [`top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md`](./top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md) § Preservação.

| # | Tema | Doc | Versão ref. | Status |
|---|------|-----|-------------|--------|
| 01 | Diagnóstico | `top/RADARZAP-TOP-01-*` | — | Concluído |
| 02 | Baseline gates | TOP 02 | 2.11.88 | Concluído |
| 03 | Planos/limites | TOP 03 | 2.11.89 | Concluído |
| 04 | RBAC | TOP 04 | 2.11.90 | Concluído |
| 05 | Presença/fila | TOP 05 | 2.11.91 | Concluído |
| 06 | Modos atendimento | TOP 06 | 2.11.92 | Concluído |
| 07 | Inbox | TOP 07 | 2.11.93 | Concluído |
| 08 | Tickets TK | TOP 08 | 2.11.94 | Concluído |
| 09 | Contatos/leads | TOP 09 | 2.11.95 | Concluído |
| 10 | Formulários | TOP 10 | 2.11.96 | Concluído |
| 11 | WebChat | TOP 11 | 2.11.97 | Concluído |
| 12 | WhatsApp profundo | TOP 12 | 2.11.98 | Concluído |
| 13 | Bridge WA↔WebChat | TOP 13 | 2.11.99 | Concluído |
| 14 | IA Básica profunda | TOP 14 | 2.12.0 | Concluído |
| 15 | IA Premium / KB / handoff | TOP 15 | 2.12.1 | Concluído |
| 16 | IA Créditos / carteira | TOP 16 | 2.12.2 | Concluído |
| 17 | Billing / limites | TOP 17 | 2.12.3 | Concluído |
| 18 | Auditoria / segurança / LGPD | TOP 18 | 2.12.4 | Concluído |
| 19 | QA final / regressão | TOP 19 | 2.12.5 | Concluído |
| 20 | Congelamento / go-live controlado | TOP 20 | 2.12.6 | Concluído — **QA manual pendente** |
| 21 | Documentação final única (extra) | TOP 21 | 2.12.6 | Concluído — organização pós-TOP20 |

**Próximo passo:** Benhur executa QA manual A–J → infra → go-live controlado.

---

## 25. Pendências conhecidas

Fonte detalhada: [`top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`](./top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md) § Pendências finais.

- **QA manual A–J** (blocker go-live) — Benhur; template [`QA-FASE1-RESULTADO-TEMPLATE.md`](./QA-FASE1-RESULTADO-TEMPLATE.md).
- **WhatsApp em ambiente real:** código fechado TOP 12; **QR, sessão, inbound/outbound e comandos** pendentes no QA manual bloco D.
- **Bridge em ambiente real:** código fechado TOP 13; **ciclo alerta → `!assumir` → WebChat → encerramento sem loop** pendente no QA manual bloco E.
- Estabilidade Baileys em produção (pós-QA manual).
- WhatsApp Cloud API (stub 503).
- Billing enforcement excedentes em runtime (TOP 17 — testes automatizados OK).
- Gate estabilização Fase 1 em [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md).
- Infra go-live: VPS, SSL, CORS, backups, env produção — TOP 20 checklists + [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md).
- Stripe live não ativado até QA bloco I e autorização Benhur.

---

## 26. Como um agente de IA deve trabalhar neste projeto

1. Ler este arquivo + [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) + doc do módulo afetado.
2. Comparar com v1 apenas se necessário: `.cursor/rules/radarzap-v2-reference.mdc`.
3. Implementar backend + frontend + testes; não deixar placeholders "Em breve".
4. Incrementar `package.json`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`.
5. Não copiar Evolution/Sendfy; não commitar `sessions/`, `.env`, `data/`.
6. Não declarar produção pronta com bugs abertos em atendimento.
7. Seguir etapa TOP atual em `docs/top/` quando em fechamento 01–20.
8. **Nunca** remover nem mover `docs/top/RADARZAP-TOP-NN-*.md` sem autorização Benhur — são histórico de auditoria.
