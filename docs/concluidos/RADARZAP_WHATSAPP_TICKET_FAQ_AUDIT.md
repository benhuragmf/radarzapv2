# RadarZap — Auditoria: WhatsApp offline, consulta de ticket e FAQ/IA

**Versão auditada:** `2.10.75` (implementado) · **Data auditoria inicial:** 2026-06-19 · **Conclusão:** 2026-06-19  
**Escopo:** Funcionalidades 1 (fallback WhatsApp), 2 (consulta ticket por token), 3 (FAQ/base de conhecimento com IA)  
**Metodologia:** Leitura do código em `src/`, modelos Mongo, APIs `/api`, widget `webchat/widget.js`, docs de módulo e roadmap Fase 1.

---

## 1. Resumo executivo

| Funcionalidade solicitada | Status (pós 2.10.75) | Entrega |
|---------------------------|----------------------|---------|
| **1. Atendimento via WhatsApp sem atendente online** | **✅ IMPLEMENTADO** | Fallback + alerta Baileys + `!assumir` + bridge site↔WA — ver `RADARZAP_WHATSAPP_TICKET_FAQ_IMPLEMENTATION.md` |
| **2. Consulta de ticket por número + token no chat** | **✅ IMPLEMENTADO** | Token hash + widget + API pública lookup/resume (2.10.70) |
| **3. FAQ/base de conhecimento com IA e links** | **✅ IMPLEMENTADO** | KB enriquecida + chips/links no widget (2.10.71); categorias separadas = backlog |

**Recomendação:** validar **QA manual** (§10) antes de produção; gate Fase 1 em `../ROADMAP-COMPLETUDE.md` continua aplicável.

---

## 2. O que já existe (reaproveitável)

### 2.1 Conversas e multitenancy

| Conceito | Implementação |
|----------|---------------|
| Tenant | `Organization._id` → `clientId` em todos os modelos |
| WhatsApp Inbox | `InboxConversation` + `InboxMessage` — `src/models/InboxConversation.ts` |
| Chat do site | `WebChatConversation` + `WebChatMessage` — IDs unificados `wc:{mongoId}` |
| Bridge Inbox | `src/services/webchat/webchat-inbox-bridge.ts` |
| Contato CRM | `Destination` — vínculo WebChat via `destinationId` / telefone |

### 2.2 Tickets / chamados

| Item | Detalhe |
|------|---------|
| Modelo | `InboxTicket` — `ticketRef` (`TK-XXXXXX`), `channel`: `whatsapp` \| `webchat_site` |
| Criar chamado WA | `InboxService.convertToTicket()` |
| Criar chamado site | `WebChatService.convertToTicket()` (desde 2.10.68) |
| API | `POST /api/inbox/conversations/:id/ticket` |
| UI | `/platform/inbox/tickets`, botão 🎫 na Caixa de Entrada |
| Inbound ticket WA | `handleTicketInboundMessage`, `TicketClientMenuService`, refs `TK-` no texto |
| **Não existe** | Token público de consulta, portal anônimo, hash de token |

### 2.3 Presença de atendentes

| Item | Detalhe |
|------|---------|
| Online no painel | `src/services/inbox/inbox-agent-presence.ts` — Map in-memory por `clientId` |
| Trigger | Socket.IO connect/disconnect em `DashboardService.setupSocket()` |
| Funções | `isAgentOnline()`, `getOnlineAgentIds()`, `preferOnlineCandidates()` |
| Uso | Round-robin, fila WebChat, enrich `suggestedUserOnline` |
| Visitante site | `WebChatPresenceService` — Redis TTL 120s (heartbeat widget) |
| **Não existe** | Heartbeat HTTP agente, timeout configurável por empresa, presença persistida |

**Comportamento atual quando ninguém online (WebChat):**

- `WebChatService.escalateToQueue()` → `suggestRoundRobinAgent()` → se `no_online`, mensagem de sistema:
  `"Nenhum atendente online no painel — fila aberta para a equipe assumir."`
- **Não** envia alerta WhatsApp, **não** oferece continuar pelo WhatsApp.

### 2.4 WhatsApp (provider)

| Item | Detalhe |
|------|---------|
| Provider real | **Baileys** (QR) — `WhatsAppService.ts` |
| Sessões | `WhatsAppSession`, painel `/sessions` |
| Envio fila | BullMQ `whatsapp-sending` via `QueueProcessorService` |
| Recebimento | `messages.upsert` → consent → inbox → ticket routing → IA |
| Cloud API Meta | Tipo `whatsapp_cloud` nos modelos; **implementação stub** |
| Webhooks inbound WA | **Não** — só webhooks **outbound** para integrações (`WebhookDispatcherService`) |
| **Não existe** | Camada `WhatsAppProvider` abstrata, comandos `!assumir`, bridge site↔WA |

### 2.5 IA e base de conhecimento

| Item | Detalhe |
|------|---------|
| IA WhatsApp | `AiConversationService` — triagem, escalação, tickets |
| IA WebChat | `WebChatAiService` — respostas visitante, política escalação |
| KB / FAQ | `AiKnowledgeBase` — `title`, `content`, `active`, por `clientId` |
| Serviço | `AiKnowledgeBaseService` — CRUD, scoring texto, `buildContextBlock` |
| Auto-resolve | `AiAutoResolveService` — match KB antes de LLM |
| UI tenant | `/platform/inbox/ia` → `AiAtendimento.tsx` aba “Base de conhecimento” |
| **Não existe** | Categorias, links clicáveis no widget, artigos com slug, sugestões rápidas no widget, FAQ separada de KB |

### 2.6 Filas e infra

- **Redis** + **BullMQ** — `QueueManager`, filas `notifications`, `whatsapp-sending`, etc.
- Socket.IO — Inbox realtime, WebChat, typing, presença visitante

### 2.7 RBAC relevante

| Capability | Uso |
|------------|-----|
| `inbox:view` / `inbox:reply` | Caixa de Entrada, assumir, responder |
| `inbox:ai:manage` | IA + KB |
| `webchat:view` / `webchat:manage` | Widget + config |
| `send:destination:manage` | Editar contato CRM |

**Não existem** caps `chat.whatsapp.assume`, `knowledge.*` — usar presets existentes ou estender `capabilities.ts`.

### 2.8 Comandos atuais (≠ `!assumir`)

| Canal | Padrão | Exemplos |
|-------|--------|----------|
| Painel atendente | `/código` | `/bd`, `/bt`, `/enc`, `/aus`, `/ticket` — `inbox-quick-replies.ts` |
| Cliente WhatsApp | texto | `TK-…`, `sair`, `status`, menu numérico tickets |
| Assumir conversa | **UI** | `POST /api/inbox/conversations/:id/assign` |

---

## 3. Gap analysis por funcionalidade

### 3.1 Funcionalidade 1 — WhatsApp quando offline

| Requisito | Status | Notas |
|-----------|--------|-------|
| Detectar atendente online | **EXISTS** | Socket painel; sem TTL configurável |
| Config por empresa (fallback WA) | **MISSING** | `InboxSettings` / `WebChatWidget` não têm flags de fallback |
| Números autorizados para `!assumir` | **MISSING** | Membros têm telefone em `User`/`Destination`, sem whitelist WA→atendente |
| Alerta WhatsApp ao escalar | **MISSING** | Só mensagem no widget + evento painel |
| Comando `!assumir` | **MISSING** | Parser inbound WA não trata `!` |
| Bridge bidirecional site ↔ WA | **MISSING** | Canais separados; sem roteamento cruzado |
| Histórico unificado | **PARTIAL** | Mensagens por canal; sem `channel` unificado em ticket bridge |
| FAQ antes de escalar | **PARTIAL** | IA/KB no bot; não integrado ao fluxo “offline → WA” |

**Riscos:**

- Baileys não é API oficial — comandos em grupo/número pessoal exigem desenho cuidadoso (LID, JID, consentimento).
- Misturar mensagens WA↔site sem vazar comandos internos ao visitante.
- Multi-tenant: número WA de alerta e whitelist **por `clientId`**.

**Decisões técnicas sugeridas:**

1. Novo modelo `InboxWhatsAppFallbackSettings` (ou campos em `InboxSettings` + `WebChatWidget`).
2. Tabela `WhatsAppAgentLink` — `{ clientId, userId, phoneE164, verified, active }`.
3. Serviço `WhatsAppBridgeService` — sessão WA da empresa envia alertas; mensagens roteadas por `bridgeSessionId` no ticket/conversa.
4. Parser comandos em `InboxService.handleInboundMessage` **antes** de ticket/consent — prefixo `!` reservado para operadores autorizados.
5. Fila BullMQ para envio WA assíncrono (já existe padrão).

### 3.2 Funcionalidade 2 — Consulta ticket por token

| Requisito | Status | Notas |
|-----------|--------|-------|
| `ticketRef` legível | **EXISTS** | `TK-XXXXXX` |
| Token aleatório seguro | **MISSING** | Gerar `accessToken` + hash bcrypt/sha256 |
| Fluxo widget “Consultar chamado” | **MISSING** | Widget não tem UI |
| API pública lookup | **MISSING** | Só `GET /api/inbox/tickets/:ref` autenticado |
| Rate limit | **PARTIAL** | Rate limit público webchat existe; não para lookup |
| Anti-enumeração | **MISSING** | Mensagem genérica em erro |
| Exibir só mensagens públicas | **PARTIAL** | Lógica existe no painel; filtrar `internal`/`system` sensível |

**Decisões técnicas sugeridas:**

1. Campos em `InboxTicket`: `publicAccessTokenHash`, `publicAccessTokenHint` (últimos 4 chars), `publicAccessCreatedAt`.
2. Gerar token na criação do ticket (WA + WebChat); exibir uma vez ao visitante.
3. `POST /api/webchat/public/tickets/lookup` — body `{ ticketRef, token, widgetPublicKey }` — valida origin + rate limit.
4. Widget: estado `ticket_lookup` no fluxo pré-chat ou menu pós-abertura.

### 3.3 Funcionalidade 3 — FAQ / KB com links

| Requisito | Status | Notas |
|-----------|--------|-------|
| CRUD FAQ empresa | **EXISTS** | `AiKnowledgeBase` + `AiAtendimento.tsx` |
| Categorias | **MISSING** | Só lista flat |
| Links / botões | **MISSING** | KB é texto; widget não renderiza botões de link estruturados |
| IA usa KB | **EXISTS** | `AiAutoResolveService`, prompt builder |
| Sugestões ao abrir chat | **PARTIAL** | Widget tem quick actions configuráveis limitadas |
| Escalar se KB falhar | **EXISTS** | IA escalação WebChat/WA |
| XSS em links | **PARTIAL** | Sanitizar URLs (`https` only) — implementar no widget |

**Decisões técnicas sugeridas:**

1. **Fase curta:** estender `AiKnowledgeBase` com `keywords[]`, `links[]`, `category?`, `showAsQuickReply`.
2. **Fase média:** entidades `KnowledgeBaseCategory` se volume crescer.
3. Widget: tipo mensagem `suggested_replies` + `link_button` no protocolo WebChat.
4. Reutilizar scoring de `AiKnowledgeBaseService.scoreAiTextMatch` para sugestões sem LLM.

---

## 4. Arquivos-chave (mapa)

```
CONVERSAS / MENSAGENS
  src/models/InboxConversation.ts, InboxMessage.ts
  src/models/WebChatConversation.ts, WebChatMessage.ts, WebChatWidget.ts

TICKETS
  src/models/InboxTicket.ts
  src/utils/inbox-ticket-ref.ts, ticket-ref.ts
  src/services/inbox/InboxService.ts
  src/services/webchat/WebChatService.ts

PRESENÇA
  src/services/inbox/inbox-agent-presence.ts
  src/services/webchat/WebChatPresenceService.ts
  src/services/web-dashboard/DashboardService.ts (setupSocket)

WHATSAPP
  src/services/whatsapp/WhatsAppService.ts
  src/services/inbox/inbound-routing.ts
  src/services/inbox/TicketClientMenuService.ts

WEBCHAT PÚBLICO
  src/services/webchat/webchat-public.routes.ts
  src/services/web-dashboard/webchat/widget.js

IA / KB
  src/models/AiKnowledgeBase.ts, AiSettings.ts
  src/services/ai/AiKnowledgeBaseService.ts
  src/services/ai/AiAutoResolveService.ts
  src/services/webchat/WebChatAiService.ts
  frontend/.../AiAtendimento.tsx

CONFIG
  src/models/InboxSettings.ts
  src/models/Organization.ts

FILAS
  src/cache/QueueManager.ts
  src/services/queue/QueueProcessorService.ts
```

---

## 5. Migrações necessárias (proposta)

| Migração | Campos / coleção | Feature |
|----------|------------------|---------|
| M1 | `InboxTicket.publicAccessTokenHash`, `publicAccessTokenHint` | Consulta token |
| M2 | `InboxSettings` ou novo doc: fallback WA flags, alert JID, message templates | Fallback WA |
| M3 | `WhatsAppAgentLink` (ou `CompanyMember.authorizedWhatsAppPhones[]`) | `!assumir` |
| M4 | `WebChatConversation.bridgeMode`, `whatsappBridgeAssigneeId` | Bridge |
| M5 | `AiKnowledgeBase.keywords`, `links[]`, `quickReplyLabel` | FAQ widget |
| M6 | `TicketEvent` ou append-only log | Auditoria |

**Nota:** MongoDB sem migrations formais — alterar schemas Mongoose + script backfill se necessário.

---

## 6. APIs propostas (adaptar ao padrão `/api`)

| Método | Rota | Feature |
|--------|------|---------|
| `PATCH` | `/api/inbox/settings/whatsapp-fallback` | Config fallback (painel) |
| `GET/POST` | `/api/inbox/whatsapp-agents` | Whitelist atendentes WA |
| `POST` | `/api/webchat/public/tickets/lookup` | Consulta token (público) |
| `POST` | `/api/webhooks/whatsapp/inbound` | Só se Cloud API; Baileys usa eventos internos |
| `GET/PATCH` | `/api/platform/ai/knowledge-base` | Já parcial via `/platform/ai/settings` |

Evitar duplicar rotas existentes em `DashboardService.ts`.

---

## 7. Testes

### Existentes (relevantes)

- `src/services/inbox/__tests__/inbox-agent-presence.test.ts`
- `src/services/ai/__tests__/AiTicketAssistService.test.ts`
- Testes ticket routing, CSAT, webchat intent

### A criar

| Área | Casos |
|------|-------|
| Presença | online/offline, round-robin `no_online` |
| Token lookup | token ok, token errado, rate limit, tenant isolation |
| `!assumir` | autorizado, não autorizado, ticket já assumido |
| Bridge | WA→site, site→WA, comando não vaza ao visitante |
| FAQ | match KB, link sanitization, escalação |

### QA manual

Seguir § 17 do prompt + `../QA-FASE1-CHECKLIST.md` § C WebChat.

---

## 8. Riscos e restrições

1. **Fase 1 roadmap** — features grandes competem com estabilização Inbox/Ticket/CSAT.
2. **Baileys vs Cloud API** — bridge “funcionário no celular” encaixa melhor em Baileys hoje; Cloud API exige templates e janelas 24h.
3. **Segurança token** — nunca logar token puro; hash + rate limit obrigatório.
4. **LGPD** — encaminhar para WA pessoal do funcionário exige base legal/config explícita na UI.
5. **Complexidade UX** — três canais (site, painel, WA) na mesma conversa exige status claros no widget.

---

## 9. Ordem de implementação recomendada

| Fase | Entrega | Dependências | Status |
|------|---------|--------------|--------|
| **A** | Token consulta ticket + fluxo widget | Baixo risco | ✅ **2.10.70** |
| **B** | FAQ links + sugestões no widget (sem bridge WA) | Reusa KB existente | ✅ **2.10.71** |
| **C** | Config fallback + alerta WhatsApp + presença heartbeat | Presença existe | ✅ **2.10.72** |
| **D** | Whitelist WA + parser `!assumir` / `!ticket` / `!encerrar` | Baileys inbound | ✅ **2.10.73** |
| **E** | Bridge bidirecional site ↔ WA | Fases C+D | ✅ **2.10.74** |
| **F** | Testes + indicador bridge no Inbox + doc QA | Todas | ✅ **2.10.75** |

---

## 10. Checklist de validação pós-implementação

- [x] `npm test` verde (377 testes, 2026-06-19)
- [x] `npm run build` verde (2026-06-19)
- [x] Widget: consulta ticket, FAQ, offline message
- [x] Painel: config fallback, whitelist WA (Equipe), KB com links
- [x] WA: `!assumir` só número autorizado
- [x] Mensagem visitante → WA do atendente (bridge)
- [x] Resposta WA → widget (bridge)
- [x] Comando `!` não vaza ao visitante
- [x] Token errado não enumera tickets (Fase A)
- [x] Tenant isolation nos serviços (filtro `clientId`)
- [x] Docs módulo (`WEBCHAT.md`, `RADARZAP_WHATSAPP_TICKET_FAQ_IMPLEMENTATION.md`)
- [x] Badge **Bridge WA** no Inbox quando `whatsappBridgeActive`

---

## 11. Arquivos alterados nesta auditoria

| Arquivo | Ação |
|---------|------|
| `docs/concluidos/RADARZAP_WHATSAPP_TICKET_FAQ_AUDIT.md` | Criado / atualizado |
| `docs/concluidos/RADARZAP_WHATSAPP_TICKET_FAQ_IMPLEMENTATION.md` | Criado (Fase A) |
| `../WEBCHAT.md` | § Consulta token 2.10.70 |
| `src/models/InboxTicket.ts` | Campos token hash |
| `src/models/WebChatWidget.ts` | `ticketLookupEnabled` |
| `src/utils/ticket-public-access.util.ts` | **Novo** |
| `src/services/inbox/ticket-public-access.service.ts` | **Novo** |
| `src/services/inbox/ticket-public-lookup-rate-limit.ts` | **Novo** |
| `src/services/inbox/InboxService.ts` | Token na criação WA |
| `src/services/webchat/WebChatService.ts` | Token site + lookup/resume |
| `src/services/webchat/webchat-public.routes.ts` | Rotas lookup/resume |
| `src/services/web-dashboard/webchat/widget.js` | UI consulta |
| `src/types/webchat.ts` | Tipos públicos |
| Testes `ticket-public-access*.test.ts` | **Novos** |

---

## 12. Próximo passo sugerido

**Implementação concluída (2.10.75).** Próximos passos operacionais:

1. **QA manual** — checklist §10 (fallback → `!assumir` → bridge → `!encerrar`).
2. **Gate Fase 1** — `../ROADMAP-COMPLETUDE.md` + `../QA-FASE1-CHECKLIST.md`.
3. **Backlog opcional:** categorias FAQ, mídia no bridge WA, Cloud API Meta (Fase 2 roadmap).

Decisões de produto já assumidas na implementação:

- Alerta via sessão Baileys da empresa; atendente responde pelo **WhatsApp pessoal** cadastrado em Equipe.
- Comandos em DM ou grupo (JID configurado nos alertas).
- Bridge ativo só após `!assumir` em chamado **webchat_site**.

---

## 13. Referências internas

- `../WEBCHAT.md` — WebChat, chamados 2.10.68, perfil 2.10.69
- `../TICKET-ATENDIMENTO.md` — ciclo ticket WhatsApp
- `../INBOX-ATENDIMENTO.md` — Inbox, IA, escalação
- `../ROADMAP-COMPLETUDE.md` — gate Fase 1
- `./menu-renaming-audit.md` — menus 2.10.67
