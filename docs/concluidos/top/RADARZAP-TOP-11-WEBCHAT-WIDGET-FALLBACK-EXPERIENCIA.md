# RadarZap — TOP 11/20 — WebChat, Widget, Fallback e Experiência do Visitante

**Data:** 2026-06-24  
**Versão após TOP 11:** `2.11.97`  
**Branch:** `main`

---

## Resumo executivo

O TOP 11 consolidou o **WebChat profundo** como canal de atendimento: widget público `widget.js` + API `/api/webchat/public`, sync painel↔widget reforçada, pré-chat e visitante, fila humana (TOP 05/07), modos de atendimento (TOP 06), gate IA Premium com fallback para fila, FAQ/tickets/leads conforme TOPs 08–09, segurança pública, helpers testáveis (`webchat-public.util.ts`) e gates verdes.

---

## Herança dos TOPs anteriores

### TOP 01

WebChat maduro: widget, API pública, pré-chat, FAQ, fila, IA, anexos, fallback WA deferido, bridge, Inbox `wc:`.

### TOP 02

Baseline verde.

### TOP 03

`webchatWidgets`, `messagesPerDay`, `aiCreditsMonthly` — limite de widgets documentado (enforcement billing → TOP 17).

### TOP 04

Config WebChat exige `webchat:manage`; APIs públicas por token do widget.

### TOP 05

Fila só para atendente `online`; capacidade simultânea por plano.

### TOP 06

Modos `disabled`/`robotic`/`basic_triage`/`premium_assistant`/`hybrid` no pipeline WebChat.

### TOP 07

Inbox unificada `wc:{id}`; round-robin; transferência — não refeito.

### TOP 08

Consulta TK/token no widget; sem notas internas.

### TOP 09

Lead só com intenção comercial/retorno; genérico não cria lead.

### TOP 10

`form.js` / `/api/leads/public` preservados.

### Esta etapa fecha

Widget, sync, pré-chat, fila, modos, IA gate, fallback widget, FAQ, segurança, testes.

### Esta etapa não faz

WhatsApp profundo (TOP 12), Bridge completa (TOP 13), IA Básica/Premium profunda (TOP 14/15), créditos IA (TOP 16), billing (TOP 17), produção pronta.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `b7d19c5` — `chore(top): formularios publicos e embed 2.11.96` |
| Modificados antes | Nenhum (working tree limpo) |
| Untracked (não commitar) | `data/`, `mocker/modelochat/` |
| Risco | Baixo |

---

## Escopo autorizado

Widget, embed, config pública, pré-chat, fila, modos, IA gate, fallback WA widget, FAQ, tickets, leads/contatos, rate limit, testes, documentação.

---

## Diagnóstico atual do WebChat

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Modelo widget | Sim | `WebChatWidget.ts` | `publicKey` `wck_*`, `appearance`, horário |
| Modelo conversa | Sim | `WebChatConversation.ts` | fila, bridge, fallback WA |
| Modelo mensagem | Sim | `WebChatMessage.ts` | inbound/outbound/system |
| Script público | Sim | `webchat/widget.js` | `data-widget-key` |
| API pública | Sim | `webchat-public.routes.ts` | `/api/webchat/public` |
| Pré-chat | Sim | `webchat-prechat-fields.util.ts` | steps/form |
| Visitante anônimo | Sim | sessão sem telefone | OK |
| Visitante identificado | Sim | `linkWebChatVisitorToDestination` | telefone/e-mail |
| Fila | Sim | `escalateToQueue` | TOP 07 round-robin |
| Mensagens | Sim | `sendVisitorMessage` | sanitização 2.11.97 |
| Anexos | Sim | `sendVisitorAttachment` | PNG/PDF |
| Typing | Sim | `webchat:typing` | WS |
| Receipts | Sim | `webchat-message-receipt.service.ts` | delivered/read |
| FAQ | Sim | `tryFaqAutoReply`, `faq-catalog` | KB por org |
| Fallback WhatsApp | Sim | `webchat-whatsapp-fallback.service.ts` | deferido + rotação |
| IA Básica | Sim | `WebChatBasicTriageService` | classificador local |
| IA Premium | Sim | `WebChatAiService` | gate + fallback fila |
| Modo híbrido | Sim | `runVisitorAutomationPipeline` | pipeline completo |
| Ticket TK | Sim | rotas `tickets/lookup|resume` | TOP 08 |
| Contato | Sim | `ensureDestinationForWebChatVisitor` | TOP 09 |
| Lead | Sim | `maybeCaptureWebChatSession` | intenção comercial |
| Integração Inbox | Sim | `wc:` prefix | unificada |
| Rate limit | Sim | `webchatPublic` middleware + send guard | 120 POST/min |
| Domínio permitido | Sim | `isWebChatOriginAllowed` | whitelist |
| Testes | Sim | 17+ suites `webchat/__tests__` | + TOP 11 |

---

## Diagnóstico atual do widget público

| Critério | Status |
|----------|--------|
| Carregamento | `GET /webchat/widget.js` + config por `publicKey` |
| Token | `wck_` + 32 hex — não previsível |
| Ativo/inativo | `getActiveWidgetByPublicKey` exige `active: true` |
| Domínios | `allowedDomains` + `assertOrigin` |
| CORS | `cors({ origin: true })` |
| Sem segredos na config | `getPublicConfig` sem `clientId` |
| Cache | `Cache-Control` prod 1h / dev no-store |
| Mobile | layout responsivo básico |
| vs `form.js` | rotas distintas — sem conflito |

---

## Diagnóstico de configuração painel para widget

**Fluxo:** `PATCH /api/webchat/widgets/:id` → `getPublicConfig` na API pública.

| Campo | Sync? | Notas |
|-------|-------|-------|
| título/subtítulo/saudação | Sim | `appearance` |
| cores/posição/tema/layout | Sim | incl. `previewTemplateId` |
| pré-chat | Sim | `prechatFields`, `prechatMode` |
| horário/offline | Sim | `outsideHoursMessage` — **corrigido no widget 2.11.97** |
| FAQ | Sim | `faqInChatEnabled`, catálogo |
| ticket lookup | Sim | `ticketLookupEnabled` |
| proactive | Sim | delay + mensagem |
| modos IA | Parcial | modo global em `AiSettings`; toggle widget `autoReplyUseAi` |
| fallback WA | Server | `InboxSettings.whatsappFallback*` — mensagem visitante via sistema |
| domínios/ativo | Sim | não expostos na config pública (correto) |

**Refresh widget:** `appearanceConfigSignature` expandida (greeting, FAQ, proactive, horário) — 2.11.97.

---

## Diagnóstico de pré-chat e visitante

- Campos configuráveis por widget (`prechatFields`)
- Intake aplicado na sessão; nota sistema só no Inbox
- Telefone/e-mail vincula `Destination` quando informado
- Anônimo permitido se campos não obrigatórios
- Lead: `shouldCreateLeadFromWebChatSession` (TOP 09)
- Consentimento: via campos pré-chat quando configurado

---

## Diagnóstico de fila WebChat

Gatilhos: modo `disabled`, híbrido sem resposta, IA escala, cliente pede humano, `no_online`/`all_busy`.

- `escalateToQueue` → `waiting_human`
- Round-robin `suggestRoundRobinAgent` (só `online`, TOP 05)
- Mensagem oficial: `WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE`
- Fallback WA quando `no_online` + config habilitada

---

## Diagnóstico dos modos no WebChat

Pipeline `runVisitorAutomationPipeline`:

| Modo | WebChat |
|------|---------|
| `disabled` | fila direta |
| `robotic` | `WebChatRoboticTriageService` |
| `basic_triage` | `WebChatBasicTriageService` |
| `premium_assistant` | FAQ → auto-reply/IA |
| `hybrid` | cadeia completa + fila |

Testes existentes: `webchat-robotic-triage`, `webchat-basic-triage`, `attendance-mode`.

---

## Diagnóstico de IA Premium gate

- `effectiveWebChatPremiumAi` + `canWebChatRunPremiumAi` (TOP 11)
- `WebChatAiService.getAvailability` valida credencial
- IA falha → `shouldEscalateWebChatOnPremiumAiFailure` → fila (2.11.97)
- Sem crédito: documentado como gate futuro em `hasCredits` helper

---

## Diagnóstico de FAQ e base de conhecimento

- `faqInChatEnabled`, `GET /faq-catalog`, picker numerado
- `shouldShowWebChatFaq` — só com catálogo ativo
- FAQ não cria lead automaticamente
- Encaminhamento humano via escalação existente

---

## Diagnóstico de fallback WhatsApp

- Config em `InboxSettings` (painel Inbox Bot)
- `processFallbackWhatsappRotation` — alerta equipe + mensagem visitante
- TOP 11: valida fluxo deferido/imediato em testes existentes
- Bridge bidirecional: fora de escopo (TOP 13)

---

## Diagnóstico de Tickets no WebChat

- `lookupTicketPublic`, `resumeTicketSession`
- Rate limit falhas + OTP resend
- Mensagens públicas sem notas internas (TOP 08)
- Widget UI condicionada a `ticketLookupEnabled`

---

## Diagnóstico de Contatos e Leads no WebChat

- Contato: pré-chat com telefone/e-mail
- Lead: nova sessão com intenção OU retorno (TOP 09)
- Genérico (`oi`) não cria lead no 1º contato
- Dedupe lead aberto por telefone

---

## Segurança pública e cross-tenant

- Token widget obrigatório; org derivada do widget
- `assertWebChatVisitorMessage` — sanitização + max 4000 chars
- Rate limit middleware + burst por conversa
- `publicWebChatConfigOmitsInternalIds`
- Cross-tenant: conversa resolvida por hash do token visitante + widgetId

---

## Regras oficiais do WebChat

1. Widget ativo + token válido.
2. Organização pelo widget, nunca body `clientId`.
3. Modo global define pipeline de automação.
4. Humano só via fila TOP 07 com presença TOP 05.
5. IA Premium com fallback obrigatório.
6. Lead conforme TOP 09.
7. Formulário TOP 10 independente.

---

## Regras oficiais do widget

- Embed: `<script src="…/webchat/widget.js" data-widget-key="wck_…">`
- Config: `GET /api/webchat/public/widgets/:key/config`
- Refresh em `visibilitychange` com assinatura expandida
- Offline: `outsideHoursMessage` ou `scheduleSummary`

---

## Regras oficiais de fila e fallback

- Mensagem: `Você está na fila de atendimento…`
- Sem atendente online → fila + opcional fallback WA
- IA indisponível → escala fila (premium)

---

## Correções ou ajustes aplicados

| Ajuste | Arquivo |
|--------|---------|
| Helpers públicos testáveis | `src/types/webchat-public.util.ts` |
| Sanitização mensagem visitante | `WebChatService.sendVisitorMessage` |
| IA falha → fila | `maybeAutoReply` |
| Mensagem fila unificada | `escalateToQueue`, widget banner |
| `outsideHoursMessage` no widget | `widget.js` offline banner |
| Assinatura config expandida | `widget.js` + helper TS |

---

## Testes criados ou atualizados

| Arquivo | Cobertura |
|---------|-----------|
| `webchat-public.util.test.ts` | sanitização, FAQ, IA gate, fila, IDs |
| `webchat-public-security.test.ts` | widget ativo/inativo, token |
| Existentes | robotic, basic, fallback, bridge webhook, FAQ, token |

---

## Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test` | Verde — 688 testes |
| `npm run qa:atendimento:gate` | Verde — 144 + 61 + qa:prep |
| `npm test -- webchat-public` | Verde — 14 testes |
| Frontend build | Não alterado nesta etapa |

---

## Arquivos alterados

- `src/types/webchat-public.util.ts`
- `src/types/__tests__/webchat-public.util.test.ts`
- `src/services/webchat/WebChatService.ts`
- `src/services/webchat/__tests__/webchat-public-security.test.ts`
- `src/services/web-dashboard/webchat/widget.js`
- `package.json`, docs TOP 11/CHANGELOG/SISTEMA-REGISTRO/INDICE/WEBCHAT

---

## Riscos reduzidos

- Desync config no refresh do widget (assinatura expandida)
- `outsideHoursMessage` ignorada no visitante
- Widget travado quando IA Premium falha
- Mensagens oversized / controle chars
- Mensagem de fila inconsistente

---

## Riscos restantes

- Limite `webchatWidgets` por plano não enforced (TOP 17)
- Rate limit receipts/ticket in-memory (sem Redis)
- GET config ilimitado por IP (mitigado por cache)
- Bridge WebChat↔WA completa (TOP 13)
- E2E widget público ponta a ponta ausente

---

## Decisões pendentes para Benhur

1. Enforcement `webchatWidgets` na criação de widget agora ou TOP 17?
2. Expor status fallback WA na config pública para CTA no widget offline?
3. Gate de créditos IA no WebChat — bloquear antes de typing indicator?

---

## Próximo passo recomendado

**TOP 12 — WhatsApp profundo** (sessão, reconexão, status, envio humanizado) sem Bridge completa.
