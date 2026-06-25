# RadarZap — Documentação Completa do Sistema

**Versão:** `2.12.1` · **Atualizado:** 2026-06-24

Documentação mestre consolidada do RadarZap v2. Detalhes por módulo permanecem nos `.md` especializados listados em [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md). Auditoria TOP 01–20: pasta [`top/`](./top/).

---

## 1. Visão geral do produto

O RadarZap é uma plataforma SaaS multi-tenant para **atendimento omnicanal** (WhatsApp Baileys, WebChat, formulários de leads), **automação** (campanhas, regras, Discord→WhatsApp opcional), **Inbox** com filas/setores, **tickets** (`TK-…`), **IA** (Básica e Premium), **equipe/RBAC**, **consentimento LGPD** e **API REST** (`/api`, `X-API-Key`).

**Fase atual:** estabilização (Fase 1) — ver [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md). Não declarar produção pronta até gate de estabilização.

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

**Não suportado / pendente:** sync bidirecional automático sem `!assumir`; comando `!responder` dedicado (resposta por contexto ativo).

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

[`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md). Recarga/billing créditos → TOP 16.

---

## 20. Billing, assinaturas e bloqueios

[`BILLING.md`](./BILLING.md). Checkout Stripe, planos, alertas críticos no painel. Bloqueios por excedente → TOP 17.

---

## 21. Logs, auditoria, segurança e LGPD

- Consentimento: [`CONSENTIMENTO-LGPD.md`](./CONSENTIMENTO-LGPD.md).
- Webhooks HMAC: [`WEBHOOKS.md`](./WEBHOOKS.md).
- `AttendanceEvent` para auditoria atendimento.
- Multi-tenant: toda API filtra por `clientId`/organização.
- QR/credenciais WA: nunca em logs (`isWhatsappQrLogSafe`).

---

## 22. QA, testes e gates obrigatórios

| Comando | Uso |
|---------|-----|
| `npm run typecheck` | TypeScript backend |
| `npm run build` | Build backend |
| `npm test` | Jest |
| `npm run qa:atendimento:gate` | Gate atendimento |
| `npm run qa:fase1:e2e` | Playwright painel |

Mapas: [`QA-FASE1-AUTOMATIZACAO.md`](./QA-FASE1-AUTOMATIZACAO.md), [`QA-FASE1-RAPIDO.md`](./QA-FASE1-RAPIDO.md).

---

## 23. Deploy, produção e checklist final

Referência (executar após Fase 1): [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md), [`PRODUCTION.md`](./PRODUCTION.md).

---

## 24. Roadmap TOP 01–20

| # | Tema | Doc | Versão ref. |
|---|------|-----|-------------|
| 01 | Diagnóstico | `top/RADARZAP-TOP-01-*` | — |
| 02 | Baseline gates | TOP 02 | 2.11.88 |
| 03 | Planos/limites | TOP 03 | 2.11.89 |
| 04 | RBAC | TOP 04 | 2.11.90 |
| 05 | Presença/fila | TOP 05 | 2.11.91 |
| 06 | Modos atendimento | TOP 06 | 2.11.92 |
| 07 | Inbox | TOP 07 | 2.11.93 |
| 08 | Tickets TK | TOP 08 | 2.11.94 |
| 09 | Contatos/leads | TOP 09 | 2.11.95 |
| 10 | Formulários | TOP 10 | 2.11.96 |
| 11 | WebChat | TOP 11 | 2.11.97 |
| 12 | WhatsApp profundo | TOP 12 | 2.11.98 |
| 13 | Bridge WA↔WebChat | TOP 13 | 2.11.99 |
| 14 | IA Básica profunda | TOP 14 | 2.12.0 |
| 15 | IA Premium / KB / handoff | TOP 15 | 2.12.1 |
| 16–20 | IA Créditos recarga, billing, go-live | pendente | — |

---

## 25. Pendências conhecidas

- Estabilidade Baileys em produção (QA manual WA).
- WhatsApp Cloud API (stub 503).
- Bridge completa (TOP 13).
- Billing enforcement excedentes (TOP 17).
- Gate estabilização Fase 1 em [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md).

---

## 26. Como um agente de IA deve trabalhar neste projeto

1. Ler este arquivo + [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) + doc do módulo afetado.
2. Comparar com v1 apenas se necessário: `.cursor/rules/radarzap-v2-reference.mdc`.
3. Implementar backend + frontend + testes; não deixar placeholders "Em breve".
4. Incrementar `package.json`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`.
5. Não copiar Evolution/Sendfy; não commitar `sessions/`, `.env`, `data/`.
6. Não declarar produção pronta com bugs abertos em atendimento.
7. Seguir etapa TOP atual em `docs/top/` quando em fechamento 01–20.
