# Inbox — atendimento WhatsApp (RadarZap)

Módulo proprietário de triagem, filas e atendimento humano via WhatsApp.

> **Referências externas** (Izing, Whaticket, Chatwoot, etc.) servem apenas para inspirar fluxos de mercado.  
> Nenhum código de terceiros é copiado. Contratos, modelos e UI são exclusivos do RadarZap.

**Última revisão:** 2026-06-09 (roteamento ticket/inbox/IA, menu context, dedup, soft delete)

## Fluxo (MVP — Fase 1)

```txt
Cliente envia mensagem no WhatsApp (contato 1:1) — ele iniciou o contato
↓
RadarZap localiza ou cria contato (aceite implícito para atendimento, sem pedir 1/2)
↓
Ordem: ticket TK → consentimento LGPD → Inbox (triagem)
↓
InboxService → IA de triagem (somente se ativa) OU menu de triagem (bot fixo)
↓
Conversa em bot_triage? Se não existe aberta → cria + menu
↓
Cliente escolhe 1–4 (ou palavra-chave do setor)
↓
Conversa entra na fila do setor (InboxDepartment)
↓
Atendente assume no painel (/platform/inbox)
↓
Atendente responde / transfere / finaliza
```

## Ordem de processamento inbound (WhatsApp)

Implementação: `WhatsAppService` → `messages.upsert`.

```txt
1. handleTicketInboundMessage   — chamado TK-… (antes do consent: "sair" ≠ opt-out LGPD)
2. ConsentService.handleInboundMessage — campanha LGPD pendente (1 aceito / 2 recuso)
3. handleInboundMessage         — triagem bot / IA, filas, atendimento ao vivo
```

**Regra de ouro:** com IA **desativada**, o passo 3 **nunca** chama `AiConversationService.handleInbound`. O sistema segue só com bot fixo, filas, setores e humano — a IA não é dependência obrigatória.

Diagrama simplificado do passo 3 em `bot_triage`:

```txt
handleInboundMessage
  ├─ releaseTicketsForInboxTriage (ticketInboundMode = new_service)
  ├─ IA ativa? → AiConversationService.handleInbound
  │     ├─ handled → para
  │     └─ useStandardTriage → bot fixo
  └─ handleStandardBotTriage (menu / escolha / hint inválido)
```

Arquivos principais:

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/services/whatsapp/WhatsAppService.ts` | Entrada WA, ordem dos handlers |
| `src/services/inbox/InboxService.ts` | Triagem, ticket, fila, transferência |
| `src/services/ai/AiConversationService.ts` | Camada IA opcional em `bot_triage` |
| `src/constants/inbox-triage.ts` | Menu, `parseInboxMenuChoice`, setores |
| `src/types/inbox-ticket.ts` | Parsers ticket (`1`/`2` follow-up, `sair`, etc.) |
| `src/services/inbox/inbound-routing.ts` | `evaluateTicketInboundRouting` — ticket vs inbox |
| `src/services/inbox/inbound-contact-queue.ts` | Fila serial por contato (evita corrida 1/2/3) |
| `src/services/inbox/inbound-dedup.ts` | Dedup `whatsappMessageId` |

### Proteções anti-travamento

| Mecanismo | Onde |
|-----------|------|
| **Fila por contato** | `enqueueInboundForContact` — mensagens do mesmo JID processadas em ordem |
| **Dedup WA** | Índice único `inboxMessages(clientId, whatsappMessageId)` + cache em memória |
| **Menu context** | `Destination.lastMenuContext` + `lastMenuSentAt` (TTL 30 min) |
| **Roteamento ticket** | `evaluateTicketInboundRouting` antes de capturar mensagem |
| **IA separada** | `InboxConversation.aiStatus` + `aiFallbackUntil` (TTL 24h) — **não** em `conversation.status` |
| **Soft delete ticket** | `deletedAt`, `deletedBy`, `deleteReason` — sem `DELETE` físico |

### `lastMenuContext` (contato)

| Valor | Números |
|-------|---------|
| `inbox_triage` | `1`–`4` → setores Inbox |
| `ticket_followup` | `1` → chamado; `2` → novo atendimento |
| `ticket_grace_expired` | `1` → novo; `2` → aguardar retorno |
| `consent` | fluxo LGPD |
| `none` | intenção da mensagem / saudação |

## Segmentos automáticos (Contatos)

No primeiro contato inbound (WhatsApp), o contato é salvo em **Contatos** e recebe o segmento **Atendimento** (criado automaticamente se não existir).

Se o cliente escolher um setor comercial na triagem (**Comercial**, **Vendas**, etc.), o contato também entra no segmento **Lead** — potencial cliente com interesse comercial.

| Segmento | Quando |
|----------|--------|
| **Atendimento** | Primeira mensagem inbound (Inbox / WhatsApp) |
| **Lead** | Triagem em setor Comercial/Vendas/Marketing |

Os segmentos aparecem em `/contact` na barra lateral de grupos, como qualquer outro segmento.

## IA de triagem (v2.6) — camada opcional

Configuração: **Atendimento → IA Atendimento** (`/platform/inbox/ia`).

| Modo | `enabled` / `mode` | Comportamento |
|------|---------------------|---------------|
| **Desativada** | `enabled: false` ou `mode: disabled` | **Somente** bot fixo + fila humana. Nenhuma regra de IA executada. |
| **IA RadarZap** | `mode: radarzap` | Chave interna do servidor; limites por plano |
| **IA própria** | `mode: company` | OpenAI ou Gemini com API Key criptografada (vault) |

**Ativação:** `AiSettingsService.isAiActive()` → `settings.enabled && mode !== 'disabled'`.

Na fase `bot_triage`, **somente se a IA estiver ativa**, ela cumprimenta, coleta dados configurados (nome, e-mail, problema, etc.), classifica setor, gera resumo interno e transfere para a fila quando as regras de escalação disparam.

### Coleta de cadastro (nome + e-mail)

| Campo | Regra |
|-------|--------|
| **Nome** | Mesmo constando no cadastro (`Destination.name`), a IA **confirma identidade** — *"Você é João?"* — antes de escalar (`nameConfirmed` em `AiConversationState`) |
| **E-mail** | Pode ser pré-preenchido do cadastro se `skipKnownFields`; caso contrário pede ao cliente |
| **Persistência** | Nome/e-mail confirmados atualizam `Destination` via `AiContextService.persistCollectedFields` |

Helpers: `parseNameConfirmation`, `buildNameConfirmationPrompt`, `needsEmailCollection` — `src/services/ai/AiContextService.ts`. Escalação exige `nameConfirmed` quando `collectName` está ativo (`AiEscalationService`).

### Escalação para fila (2.8.7)

| Gatilho | Comportamento |
|---------|---------------|
| Resposta da IA promete transferência (`AI_TRANSFER_PROMISE` em `AiEscalationService`) | Escalonamento **imediato** para `waiting_queue` — não depende de `aiTurnCount` nem de frase exata do cliente |
| Cliente pede setor/humano (`comercial`, `preciso falar com…`, `suporte`, etc.) | `clientRequestsHuman` → escala via regras `onHumanRequest` |
| Cliente aguarda após promessa (`aguardando`, `cadê`, …) | `isWaitingForPromisedHandoff` na mensagem seguinte |
| Scan SLA Inbox (~60s) | `recoverStuckPromisedHandoffs` — conversas em `bot_triage` há >45s após última msg da IA com promessa de encaminhamento |

Setor: `departmentMenuKey` do JSON da LLM → nome no texto (*setor Comercial*) → fallback primeiro setor público. Se a IA já enviou a promessa ao cliente, **não** duplica mensagem de confirmação de fila (`clientMessage` vazio em `escalateFromAi`).

### Fallback para bot fixo (IA ativa mas indisponível)

| Situação | Resultado |
|----------|-----------|
| API falha (timeout, chave inválida, modelo indisponível) | `useStandardTriage: true` → menu de setores |
| Limite diário/mensal do plano | idem |
| Mídia não interpretável (regra `onUninterpretableMedia`) | idem |
| Resposta JSON inválida / vazia da LLM | idem |
| Estado `ai_fallback_standard` | idem (não re-tenta IA na mesma conversa) |
| Escalação para humano (`ai_escalated`) | Inbox assume; fila/setor conforme regra |

**Status da IA na conversa** (`InboxConversation.aiStatus` — separado de `status`):

| `aiStatus` | Significado |
|------------|-------------|
| `ai_collecting` | Coletando dados iniciais |
| `ai_waiting_client` | Aguardando próxima mensagem do cliente |
| `ai_completed` | Triagem IA concluída |
| `ai_escalated` | Transferido para humano |
| `ai_fallback_standard` | Bot fixo (TTL `aiFallbackUntil`, padrão 24h) |
| `human_assigned` | Atendente assumiu no painel |
| `null` | Sem camada IA ativa |

Espelho detalhado em `AiConversationState` (coleção auxiliar). `conversation.status` permanece: `bot_triage` \| `waiting_queue` \| `in_progress` \| `resolved` \| `closed`.

Serviços: `AiProviderService`, `AiPromptBuilderService`, `AiEscalationService`, `AiUsageMeterService`.

API painel: `GET/PATCH /api/platform/ai/settings`, `DELETE /api/platform/ai/key`, `POST /api/platform/ai/test`, `GET /api/platform/ai/usage`, catálogo de modelos em `src/constants/ai-model-catalog.ts`.

### Bot fixo (`handleStandardBotTriage`)

Função dedicada em `InboxService` — **independente da IA**. Usada quando:

- IA desativada no tenant;
- IA retornou `useStandardTriage`;
- conversa nunca recebeu menu (`conversationLacksTriageMenu`);
- primeira mensagem (`isNew`) ou mídia sem texto.

Fluxo: `parseInboxMenuChoice` → `handleTriageReply` (fila) **ou** envia `buildInboxTriageMenu` **ou** `buildInvalidMenuHint`.

## Tickets de acompanhamento (atendimento assíncrono)

> **Documento canônico:** [TICKET-ATENDIMENTO.md](./TICKET-ATENDIMENTO.md) — conceito, `sair`, roteamento e regra “ticket não sequestra inbox”.

> **Nomenclatura e prioridade (2.6.2):** ver [TICKET-ATENDIMENTO.md § Nomenclatura das janelas](./TICKET-ATENDIMENTO.md#nomenclatura-das-janelas-aliases) — **12 h retorno**, **2 h captura**, **30 min complemento**; `status` (painel) ≠ `ticketInboundMode` (roteamento WhatsApp). Ver também [§ Prioridade WhatsApp](./TICKET-ATENDIMENTO.md#prioridade-whatsapp-inbox--ticket) — triagem/IA ganham sobre ticket antigo salvo modo explícito (`ticket` / `awaiting_follow_up`) ou grace 30 min; ack curto mantém janela e não captura durante IA.

Muitos problemas **não são resolvidos ao vivo** no WhatsApp. O fluxo típico:

1. Cliente entra pelo **bot** (menu de setores).
2. Um funcionário atende ou registra o caso; o problema pode exigir **horas ou dias**.
3. A equipe abre um **ticket** (`TK-XXXXXX`) vinculado à conversa do contato.
4. No painel, comentários **internos** e **@menções** acionam outro funcionário para resolver.
5. Quando houver solução, a equipe **envia atualização ao cliente** no WhatsApp.
6. Abre-se uma **janela de tempo** para o cliente mandar dados, respostas e dúvidas **naquele chamado**.
7. O cliente **conclui** enviando **`sair`** (não é opt-out LGPD — é encerrar respostas naquele ticket).

```txt
Cliente → bot / Inbox
    ↓
Funcionário A abre ticket TK-… (conversa continua no painel)
    ↓
Comentários internos + @Funcionário B
    ↓
Funcionário B resolve (fora do chat ao vivo)
    ↓
"Enviar atualização ao cliente" ou fechar ticket com mensagem
    ↓
Cliente responde no WhatsApp (texto, mídia, números — ex.: "1", dados)
    ↓
Respostas vão para clientReplies[] do ticket no painel
    ↓
Cliente envia "sair" → pausa respostas até nova mensagem da equipe
```

### Conversa × Ticket

| | **InboxConversation** | **InboxTicket** (`inboxTickets`) |
|---|------------------------|----------------------------------|
| O quê | Fila, bot, chat ao vivo | Chamado formal com referência `TK-…` |
| Onde no painel | `/platform/inbox` | `/platform/inbox/tickets/:ref` |
| Cliente vê | Mensagens normais do atendimento | Mensagens enviadas pela equipe + janela de resposta |
| Equipe vê | Histórico da conversa | Acompanhamento, notas, menções, respostas do cliente |

O ticket é criado/atualizado por `InboxService.ensureTicketRecord` quando a conversa recebe referência `ticketRef`.

### Ações da equipe (painel)

| Ação | Quando usar |
|------|-------------|
| **Comentário** (+ `@menção`) | Alinhar internamente; notifica o colega mencionado |
| **Nota interna** | Só equipe; nunca vai ao WhatsApp |
| **Enviar atualização ao cliente** | Ticket **aberto** — manda resumo/snapshot no WhatsApp (`POST …/client-update`) |
| **Fechar ticket** | Finaliza o chamado; cliente recebe mensagem de encerramento com prazo para dúvidas |
| **Reabrir** | Volta a permitir atualização ao cliente em ticket fechado |

Constantes de texto ao cliente: `src/types/inbox-ticket.ts`.

### Janelas de tempo (cliente no WhatsApp)

| Regra | Duração | Constante / código |
|-------|---------|-------------------|
| Responder no ticket **após fechamento** ou **após qualquer envio da equipe** | **12 horas** | `TICKET_POST_CLOSE_REPLY_HOURS = 12` |
| Menu **chamado vs novo atendimento** (cliente pausado) | após **2 h** do início das 12 h | `TICKET_FOLLOW_UP_MENU_AFTER_HOURS = 2` |
| Complementar informação **na mesma rodada** de resposta | **30 minutos** | `TICKET_CLIENT_REPLY_GRACE_MS` |
| Encerrar respostas neste chamado | **`sair`** ou **`finalizar`** | `parseTicketClientExit` / `parseTicketFinalize` |

**12 horas:** a cada envio da equipe **pelo Ticket** (`sendTicketMessageToClient` — abrir, atualizar, fechar chamado), `clientReplyExpiresAt` e `clientReplyWindowStartedAt` são **renovados**. Mensagens do **Inbox ao vivo** (resposta, finalizar, CSAT) **não** renovam ticket fechado antigo (desde 2.8.9).

**Primeiras 2 horas** (desde o início da janela): o cliente pode responder direto; na **primeira** resposta o sistema envia:

> *Ok! Se tiver mais alguma informação, me envie em no máximo 30 minutos que insiro no chamado.*

**30 minutos:** complementos na mesma rodada entram no ticket. **Ao expirar os 30 min**, o sistema envia:

> *O prazo de 30 minutos para enviar complementos encerrou. Suas informações já foram registradas no chamado.*

`clientReplyPaused = true` — **novas mensagens não entram mais no ticket** até menu das 2 h ou novo envio da equipe.

**Após 2 horas** do início das 12 h (com cliente pausado): ao escrever de novo, recebe o menu:

> *1* — Inserir informação, consultar *status* ou *finalizar* este chamado  
> *2* — Iniciar um *novo atendimento*

- **1** → volta ao fluxo do ticket (`inserir`, `status`, `finalizar` / `sair`)
- **2** → Inbox (novo atendimento pelo bot); o ticket antigo não captura

### Colisão menu inbox × menu ticket (`1` e `2`)

Os números **1** e **2** existem nos **dois** contextos:

| Número | Menu inbox (triagem) | Menu ticket (após 2 h, cliente pausado) |
|--------|----------------------|----------------------------------------|
| `1` | Comercial (ou 1º setor público) | Inserir info / status / finalizar chamado |
| `2` | Financeiro (ou 2º setor) | Iniciar **novo atendimento** |
| `3` | Suporte | — (só inbox) |
| `4` | Geral | — (só inbox) |

Sem tratamento explícito, um ticket fechado na janela de **12 h** podia capturar `1`/`2` antes do Inbox — gravando em `clientReplies[]` e enviando o grace *"Ok! Se tiver mais alguma informação…"* em vez de direcionar para a fila.

**Regras de prioridade (implementadas):**

```txt
inboxTriageContextActive = conversa em bot_triage
                        OU menu de setores enviado nos últimos 30 min
```

| Condição | Ticket | Inbox |
|----------|--------|-------|
| `inboxTriageContextActive` | **Não intercepta** (`return false`) | Processa escolha |
| `ticketInboundMode === 'new_service'` | **Não intercepta** | Processa |
| `ticketInboundMode === 'ticket'` | Fluxo do chamado | Só se `shouldDeferToInboxTriage` |
| Escolha 1–4 + menu inbox recente, conv em `waiting_queue` | Liberado | `resetConversationForBotTriage` + `handleTriageReply` |
| `oi` + conv em `waiting_queue` sem atendente | Liberado | Reinicia `bot_triage` + menu |

Funções: `inboxTriageContextActive`, `shouldDeferToInboxTriage`, `contactRecentlyReceivedInboxTriageMenu`, `releaseTicketsForInboxTriage`, `resetConversationForBotTriage`.

**`sair` / `finalizar`:** pausa respostas neste ticket. Mensagem:

> *Entendido! Você não precisa responder mais neste chamado…*

Um **novo envio da equipe** reabre as 12 h, zera pausa e o modo de menu (`ticketInboundMode`).

### Ticket aberto (não fechado)

Enquanto `status` é `open`, `in_progress` ou `client_replied` e `teamHasMessagedClient === true`, o cliente pode responder no WhatsApp sem limite de 12 h (até enviar `sair` ou a equipe fechar). O fechamento passa a usar a regra de **12 h** a partir da mensagem de encerramento.

### O que **não** é ticket

| Fluxo | Diferença |
|-------|-----------|
| **LGPD / campanha** | Pedido `1` aceito / `2` recuso antes de disparo em massa — `ConsentService`, não ticket |
| **Menu do bot** | Setores 1–4 na triagem — prioridade sobre ticket quando `inboxTriageContextActive` |
| **`sair` no ticket** | Pausa **só aquele chamado** — diferente de cancelar inscrição LGPD (`ConsentService` opt-out) |

Ordem no `WhatsAppService` ao receber mensagem: **ticket** → **consentimento** (campanha LGPD) → **Inbox** (menu/bot/IA).

### Scripts de diagnóstico (dev)

| Script | Uso |
|--------|-----|
| `scripts/inspect-ticket.ts TK-XXXXXX` | Status do ticket, conversas abertas, modo inbound |
| `scripts/fix-stuck-inbox-contact.ts [phone] --ai-off` | Limpa opt-out pendente, libera tickets (`new_service`), reseta conversa para `bot_triage`, desativa IA |
| `scripts/fix-stuck-inbox-contact.ts [phone] --ai-on` | Reativa Gemini (`GEMINI_API_KEY` no `.env`) |
| `scripts/test-ai-gemini-provider.ts` | Smoke test do provedor Gemini |

Variável opcional: `TEST_CLIENT_ID` (padrão tenant de dev).

### Teste E2E recomendado

**IA desativada** (`--ai-off`):

1. `oi` → menu com setores (`1 - Comercial`, …)
2. `1` → confirmação de fila Comercial (sem grace do ticket)
3. Mídia sem legenda → menu de setores (não silêncio)

**IA ativada** (`--ai-on` + chave válida):

1. `oi` → saudação IA (sem JSON cru, sem loop)
2. Falha de API ou limite → menu de setores automaticamente
3. Escalação → fila humana conforme regras do painel IA

### Testes automatizados (`jest`)

Arquivo: `src/services/inbox/__tests__/inbound-routing.test.ts`

```bash
npm test -- --testPathPattern=inbound-routing
```

Cenários: IA off (`oi`, `1`), menu inbox vs ticket, 12h, grace 30 min, `novo atendimento`, `bot_triage`.

### Modelo `inboxTickets`

| Campo | Uso |
|-------|-----|
| `ticketRef` | Ex.: `TK-5NP8CT` |
| `conversationId` / `destinationId` | Vínculo com conversa e contato |
| `status` | `open` \| `in_progress` \| `client_replied` \| `closed` |
| `comments` | Acompanhamento interno (+ menções) |
| `internalNotesList` | Notas só equipe |
| `clientReplies` | Respostas do cliente capturadas pelo WhatsApp |
| `teamHasMessagedClient` | Equipe já enviou ao menos uma vez ao cliente |
| `clientReplyExpiresAt` | Prazo 12 h (fechado ou renovado a cada envio) |
| `clientReplyWindowStartedAt` | Início da contagem das 12 h |
| `clientReplyGraceUntil` | Janela 30 min para complementos |
| `clientReplyPaused` | Pausado (30 min expirou, `sair`, ou aguardando menu) |
| `ticketInboundMode` | `awaiting_follow_up` \| `ticket` \| `new_service` |
| `lastTeamMessageAt` | Última msg equipe ao cliente (2.6.3) |
| `teamSlaDueAt` / `teamSlaBreachedAt` | SLA interno equipe após resposta cliente (2.7.0) |
| `lastStatusChangeAt` | Última alteração manual de `status` (2.7.0) |
| `deletedAt` / `deletedBy` / `deleteReason` | Soft delete (exclusão lógica) |

Respostas enriquecidas (2.7.0): `displayStatus`, `displayStatusLabel`, `teamSlaOverdue` — derivados em `ticket-display-status.ts`.

### API REST — tickets (`/api/inbox/tickets/*`)

| Método | Rota | Cap | Descrição |
|--------|------|-----|-----------|
| GET | `/inbox/tickets` | `inbox:view` | Lista paginada: query `page` (1+), `limit` (1–100, padrão 15), `status`, `mine`, `search` → `{ items, total, page, limit }` |
| GET | `/inbox/tickets/stats` | `inbox:view` | Contadores (+ `slaBreached`, `waitingTeam`) |
| GET | `/inbox/tickets/:ref` | `inbox:view` | Detalhe + comentários + respostas do cliente |
| PATCH | `/inbox/tickets/:ref` | `inbox:reply` | Atualizar responsável / `status` (`open`, `in_progress`, `client_replied`) |
| POST | `/inbox/tickets/:ref/comments` | `inbox:reply` | Comentário (+ `mentionedUserIds`) |
| POST | `/inbox/tickets/:ref/internal-notes` | `inbox:reply` | Nota interna |
| POST | `/inbox/tickets/:ref/client-update` | `inbox:reply` | Enviar resumo ao WhatsApp (ticket aberto) |
| POST | `/inbox/tickets/:ref/notify-client` | `inbox:reply` | Notificar cliente |
| POST | `/inbox/tickets/:ref/close` | `inbox:reply` | Fechar + mensagem ao cliente |
| POST | `/inbox/tickets/:ref/reopen` | `inbox:reply` | Reabrir |
| POST | `/inbox/tickets/:ref/forward` | `inbox:reply` | Encaminhar resumo (outro número / colega) |
| DELETE | `/inbox/tickets/:ref` | `inbox:reply` | Excluir ticket |

Implementação principal: `src/services/inbox/InboxService.ts` (`handleTicketInboundMessage`, `sendClientUpdate`, `closeTicket`, `sendTicketMessageToClient`).

**SLA equipe (2.7.0):** `InboxSettings.ticketTeamResponseHours` (default 24, 0 = desligado) — configurável em `/platform/inbox/bot`. Após resposta do cliente no ticket, inicia prazo; limpa quando equipe responde. Monitor no scan SLA → evento `inbox:priority` no painel.

**Menu bot tickets (2.7.0):** `TicketClientMenuService` na triagem bot — cliente digita *ticket* / *chamado* / `TK-…` fora da IA (`Destination.pendingTicketMenuChoices`, contexto `ticket_pick`).

## Modelos MongoDB

| Coleção | Propósito |
|---------|-----------|
| `inboxDepartments` | Filas/setores (Comercial, Financeiro, …); `clientVisible: false` = interno (só equipe) |
| `inboxConversations` | Conversa por contato + canal WA (fila, bot, chat) |
| `inboxTickets` | Chamados formais `TK-…` (acompanhamento assíncrono) |
| `inboxMessages` | Histórico inbound/outbound/system |
| `inboxTransfers` | Auditoria de transferências |

### InboxDepartment

- `clientId` — tenant (Organization._id)
- `name`, `description`, `menuKey` (`1`–`4` no bot fixo para setores **públicos**; internos usam `i2`, `i3`…)
- `clientVisible` — `true` = aparece no menu WhatsApp; `false` = **setor interno** (só equipe)
- `internalRank` — `0` = público; `2`–`5` = 2ª a 5ª instância (escalação na transferência)
- `memberUserIds[]` — atendentes; vazio = todos com `inbox:view`
- `isActive`, `sortOrder`

**Transferência entre setores internos:** atendente só pode transferir para setor de **rank imediatamente superior** (`InboxService.canUserTransferToDepartment`). Lista de setores para transferência filtra `canTransferTo`.

**UI setores** (`/platform/inbox/setores`): botões **Público / Interno** + dropdown **Instância interna** (desabilitado quando público).

### InboxConversation

- `clientId`, `destinationId`, `contactIdentifier`, `contactName`
- `departmentId`, `assignedUserId`
- `status` — ver enum abaixo
- `channel` — `whatsapp_qr` (MVP); futuro `whatsapp_cloud`
- `lastMessageAt`, `lastInboundAt`

### Status da conversa

| Status | Significado |
|--------|-------------|
| `bot_triage` | Aguardando escolha no menu |
| `waiting_queue` | Na fila do setor |
| `in_progress` | Atendente assumiu |
| `transferred` | Transição (volta para `waiting_queue`) |
| `resolved` | Finalizada pelo atendente |
| `closed` | Encerrada (futuro: timeout) |

## API REST (`/api/inbox/*`)

| Método | Rota | Cap | Descrição |
|--------|------|-----|-----------|
| GET | `/inbox/departments` | `inbox:view` | Lista setores (seed padrão se vazio) |
| GET | `/inbox/members` | `inbox:department:manage` | Equipe para vincular aos setores |
| POST | `/inbox/departments` | `inbox:department:manage` | Criar setor |
| PATCH | `/inbox/departments/:id` | `inbox:department:manage` | Editar setor / atendentes |
| GET | `/inbox/conversations` | `inbox:view` | Lista (`status`, `departmentId`, `mine`) |
| GET | `/inbox/conversations/:id` | `inbox:view` | Detalhe + mensagens |
| POST | `/inbox/conversations/:id/assign` | `inbox:reply` | Assumir |
| POST | `/inbox/conversations/:id/reply` | `inbox:reply` | Responder no WhatsApp |
| POST | `/inbox/conversations/:id/transfer` | `inbox:transfer` | Transferir setor |
| POST | `/inbox/conversations/:id/resolve` | `inbox:reply` | Finalizar |
| GET | `/inbox/settings` | `inbox:department:manage` | Config do bot |
| PATCH | `/inbox/settings` | `inbox:department:manage` | Salvar bot / horários / round-robin |
| GET | `/inbox/reports` | `inbox:reports:view` | Métricas de atendimento (`from`, `to`) |
| GET | `/inbox/supervisor/queue` | `inbox:supervise` | Fila ao vivo (supervisor) — WhatsApp + WebChat unificados (desde 2.10.20) |
| POST | `/inbox/conversations/:id/reassign` | `inbox:supervise` | Reatribuir (`mode: suggest` \| `assign`) |

## Permissões

| Capability | OWNER | ADMIN | ATTENDANT |
|------------|-------|-------|-----------|
| `inbox:view` | ✓ | ✓ | ✓ |
| `inbox:reply` | ✓ | ✓ | ✓ |
| `inbox:transfer` | ✓ | ✓ | ✓ |
| `inbox:department:manage` | ✓ | ✓ | — |
| `inbox:reports:view` | ✓ | ✓ | — |
| `inbox:supervise` | ✓ | ✓ | — |

## Integração WhatsApp

- **Entrada:** `WhatsAppService` → `messages.upsert` → `InboxService.handleTicketInboundMessage` → `ConsentService` (se campanha LGPD pendente) → `InboxService.handleInboundMessage`
- **Saída:** `InboxService` → `WhatsAppService.sendManualMessage` (`skipConsentCheck` para respostas de atendimento)
- **Grupos:** ignorados (só contatos 1:1)
- **Consentimento inbound:** quem escreve primeiro não recebe prompt 1/2 — vai direto ao menu. Campanhas/envios ativos continuam com `assertCanSend` (LGPD outbound)
- **Menu 1–4:** exclusivo do atendimento (não é fluxo de opt-in LGPD)
- **Ticket fechado:** respostas do cliente vão ao `TK-…` se dentro de **12 h** após o último envio da equipe — ver seção [Tickets de acompanhamento](#tickets-de-acompanhamento-atendimento-assíncrono)

## Bot configurável (Fase 2)

Coleção `inboxSettings` por tenant (`clientId`). Painel: `/platform/inbox/bot`.

| Campo | Uso |
|-------|-----|
| `welcomeWithCompany` / `welcomeGeneric` | Cabeçalho do menu (`{company}`) |
| `menuIntro` / `menuFooter` | Texto antes/depois das opções |
| `queueMessage` / `waitingMessage` | Confirmação na fila (`{department}`, `{waiting}`) |
| `outsideHoursMessage` | Fora do horário comercial |
| `invalidMenuHint` | Opção inválida (`{options}`) |
| `resolvedMessage` / `transferMessage` | Finalizar / transferir |
| `businessHoursEnabled` + `schedule` + `timezone` | Horário comercial (Intl timezone) |
| `roundRobinEnabled` | Indica prioridade (não força aceite) |
| `roundRobinPullTimeoutSeconds` | Segundos até outro atendente poder puxar (padrão 120) |
| `alertSoundEnabled` | Som no painel para eventos importantes |
| `alertOnNewChat` | Alerta quando entra conversa nova na fila |
| `alertOnNewMessage` | Alerta quando chega mensagem em conversa ativa |
| `csatEnabled` / `csatPrompt` / `csatThankYou` | Pesquisa 1–5 pós-atendimento — ver § CSAT abaixo |

API: `GET/PATCH /api/inbox/settings` (`inbox:department:manage`).

Setores continuam em `inboxDepartments` — o menu é montado dinamicamente a partir deles.

### CSAT pós-atendimento (2.8.8)

| Gatilho | Comportamento |
|---------|---------------|
| **Finalizar** no painel (`resolveConversation`) | Envia pesquisa CSAT se `csatEnabled` (antes só no encerramento automático `/enc`) |
| Cliente responde `1`–`5` | Grava nota, agradece, webhook `inbox.csat.rated` |
| Cliente escreve *avaliar* / *nota* / etc. | Reenvia pesquisa ou inicia CSAT na conversa recente (24 h) — **não** abre ticket |
| CSAT pendente + nota inválida | Lembrete *"responda só com 1 a 5"* |
| CSAT pendente + novo atendimento (*ola*, *atendimento*, *atendente*) | Limpa `csatPending` e segue para Inbox (2.8.11) |

Ordem inbound: `handleTicketInboundMessage` chama `tryHandleCsatReply` **antes** de rotear ao ticket. Helpers: `parseCsatScore`, `isCsatIntent`, `shouldBypassCsatForNewService` — `src/services/inbox/csat.util.ts`.

## Tempo real e round-robin (Fase 3)

- **WebSocket** (Socket.IO): sala `inbox:{clientId}` — eventos `inbox:conversation`, `inbox:message`
- **Presença online**: atendente online = painel aberto (socket); round-robin **só indica quem está online**
- **Round-robin (prioridade)**: define `suggestedUserId` + `suggestedAt` — status `waiting_queue` até aceite
- **Ninguém online**: fila aberta (sem indicado); evento `inbox:priority_expired`; botão **Assumir**
- **Prioridade expirada / offline**: scan ~60s emite `inbox:priority_expired` ou remove indicado offline
- **UI**: borda amarela + cronômetro; **Aceitar prioridade**; composer com rascunho antes do aceite
- **Puxar**: outro atendente assume se indicado ocupado/offline ou após `roundRobinPullTimeoutSeconds`
- Painel Inbox usa `useInboxSocket` + polling de fallback (30s)

## Relatórios de atendimento (Fase 4)

Painel: `/platform/inbox/relatorios` (`inbox:reports:view`).

Métricas por período (`from` / `to` ISO):

- Tempo médio na fila (`queueEnteredAt` → `acceptedAt`)
- Tempo de primeira resposta e resolução
- Conversas por setor e por atendente

Serviço: `InboxReportsService`.

## Supervisor (Fase 4)

Painel: `/platform/inbox/supervisor` (`inbox:supervise` — OWNER/ADMIN).

- Fila ao vivo com status, setor, atendente e prioridade sugerida
- Reatribuir conversa: `suggest` (nova prioridade) ou `assign` (assume direto)
- Atualização via WebSocket + refresh manual

## Notificações no painel

- **Balão de eventos** no header (à esquerda do indicador *online*): `EventNotificationBell`
- Eventos via Socket.IO `panel:event` (`PanelNotifications`)
- Tipos: novo chat, nova mensagem, prioridade, prioridade expirada, fila parada, WhatsApp desconectado/reconectado
- Som configurável em `/platform/inbox/bot` (alertas do painel)
- Hook: `usePanelSocket` + `EventNotificationContext`

## Estabilidade WhatsApp

- Reconexão automática com backoff exponencial (2s → 30s, até 8 tentativas)
- Evento `whatsapp:disconnected` no painel ao cair sessão (incl. 401)
- Monitoramento em `/platform/wa-status` e logs em `/platform/wa-logs`

## Fases futuras

| Fase | Escopo |
|------|--------|
| 5 | `WhatsAppChannelProvider` — Cloud API Meta (Enterprise). Spec produção: `PRODUCTION.md` §7 |

## Painel

| Rota | Componente |
|------|------------|
| `/platform/inbox` | `pages/menu/Inbox.tsx` |
| `/platform/inbox/setores` | `pages/menu/InboxSectors.tsx` |
| `/platform/inbox/bot` | `pages/menu/InboxBotSettings.tsx` |
| `/platform/inbox/supervisor` | `pages/menu/InboxSupervisor.tsx` |
| `/platform/inbox/relatorios` | `pages/menu/InboxReports.tsx` |
| `/platform/inbox/tickets` | `pages/menu/InboxTickets.tsx` — lista de chamados |
| `/platform/inbox/tickets/:ref` | `pages/menu/InboxTicketDetail.tsx` — detalhe `TK-…` |
| `/platform/inbox/ia` | `pages/menu/AiAtendimento.tsx` — IA Atendimento (9 abas) |
| `/settings/team` | `TeamMembers.tsx` — convidar atendentes |

Menu: **Plataforma → Atendimento → Inbox** / **Tickets** / **Setores** / **IA Atendimento** / **Supervisor** / **Relatórios**

## Apresentação do atendente

Ao **assumir** ou **responder** pela primeira vez, o cliente recebe no WhatsApp:

`Olá! Sou *{nome}* e vou dar continuidade ao seu atendimento.`

O nome vem do perfil do usuário no painel (Google/Discord).
