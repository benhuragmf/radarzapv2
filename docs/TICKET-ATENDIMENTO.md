# Ticket — chamado assíncrono (RadarZap)

Documento de referência do produto: o que é um Ticket, como difere do Inbox, quem cria, janelas de tempo e regras de roteamento no WhatsApp.

**Última revisão:** 2026-06-24 (TOP 08 — `2.11.94`)
**Implementação:** `src/services/inbox/InboxService.ts`, `src/types/inbox-ticket.ts`, `src/types/ticket-status.util.ts`, `src/types/ticket-sla-priority.util.ts`, `src/models/InboxTicket.ts`, `src/services/inbox/inbound-routing.ts`, `src/services/inbox/ticket-public-access.service.ts`
**Relacionado:** [INBOX-ATENDIMENTO.md](./INBOX-ATENDIMENTO.md) (atendimento ao vivo), [WEBCHAT.md](./WEBCHAT.md) (consulta token widget), [top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md](./top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md)

---

## TOP 08 — estados, SLA e helpers (2.11.94)

- **Estados persistidos:** `open`, `in_progress`, `client_replied`, `closed` — mapeamento para estados de produto em `ticket-status.util.ts` (`pending_team`, `pending_customer`, `expired`, etc.).
- **Protocolo TK:** `generateInboxTicketRef()` → `TK-XXXXXX` (alfabeto sem 0/O/1/I/L); índice único `{ clientId, ticketRef }`.
- **SLA operacional:** `teamSlaDueAt` após resposta do cliente — 24h (`DEFAULT_TICKET_TEAM_RESPONSE_HOURS`). Metas comerciais por prioridade documentadas em `ticket-sla-priority.util.ts` (campo `priority` ainda não persistido).
- **Janela cliente:** 12h pós-fechamento/último envio da equipe — `ticket-reply-window.util.ts`.
- **Auditoria:** `AttendanceEvent` — `ticket.created`, `ticket.client_replied`, `ticket.closed`, `ticket.reopened`, `ticket.assigned`.

---

## Consulta pública por token (2.10.70)

Chamados (`TK-XXXXXX`) podem ter **token de consulta** para o visitante acompanhar status no widget embed (sem login).

| Campo `InboxTicket` | Uso |
|---------------------|-----|
| `publicAccessTokenHash` | SHA-256 do token (nunca armazenar token puro) |
| `publicAccessTokenHint` | Últimos 4 caracteres — suporte interno |
| `publicAccessCreatedAt` | Geração do token |

- Token gerado ao criar chamado (WhatsApp, WebChat, IA).
- Formato exibido ao cliente: `XXXX-XXXX` (uma vez na mensagem de abertura).
- API pública: `POST /api/webchat/public/widgets/:publicKey/tickets/lookup` e `…/tickets/resume`.
- Rate limit anti-força bruta; resposta genérica se token/ref inválidos.
- Retomada pelo widget só para `channel: webchat_site` com conversa aberta.

Helpers: `src/utils/ticket-public-access.util.ts`, `ticket-public-access.service.ts`.

### Mensagens visíveis ao cliente vs notas internas (2.11.13)

| Canal | Visível ao cliente | Onde grava |
|-------|-------------------|------------|
| Painel — **Mensagens ao cliente** (WebChat) | Sim — chat + consulta TK+token | `InboxTicket.comments[]` + `WebChatMessage` |
| WhatsApp — `TK-XXXX texto` (bridge) | Sim | `comments[]` + chat |
| WhatsApp — **`!nota TK-XXXX texto`** | **Não** — só equipe | `internalNotesList[]` |
| Painel — **Notas internas** | **Não** | `internalNotesList[]` |
| Resposta do visitante (chat aberto) | Sim | `clientReplies[]` + chat |

Chamado **fechado** não aceita novas mensagens ao cliente. Consulta TK+token mostra histórico; **Continuar atendimento** só com conversa + chamado abertos.

Ver também: [`WEBCHAT.md`](./WEBCHAT.md), [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md).

---

## Conceito

O **Ticket** no RadarZap é um **chamado separado** do atendimento ao vivo.

Use-o para problemas que **não** se resolvem na hora:

- processos demorados;
- análise interna;
- suporte técnico, financeiro, orçamento, manutenção, documentos;
- qualquer situação que dependa de **retorno posterior** da equipe.

| | **Inbox** | **Ticket** |
|---|-----------|------------|
| Papel | Atendimento **principal** — ao vivo | Acompanhamento **assíncrono** |
| Quando | Triagem, fila, setor, humano em tempo real | Problema demorado, pendente de análise |
| Referência | Conversa no painel Inbox | `TK-XXXXXX` (6 caracteres após `TK-`) |
| Trava o cliente? | **Não** deve travar | **Não** deve travar |

### Referência `TK-…` (formato e ambiguidade — 2.11.86)

| Item | Detalhe |
|------|---------|
| Geração | `generateInboxTicketRef()` em `src/utils/inbox-ticket-ref.ts` |
| Formato | `TK-` + 6 caracteres maiúsculos |
| Alfabeto (≥ 2.11.86) | `23456789ABCDEFGHJKMNPQRSTUVWXYZ` — **sem** `0`, `O`, `1`, `I`, `L` |
| Legado (&lt; 2.11.86) | `Date.now().toString(36)` — pode misturar `0` e `O`; confundir ao copiar visualmente |
| Normalização API | `ticketRef.trim().toUpperCase()` em `getTicketByRef` — **não** corrige `0`↔`O` |
| Múltiplos por contato | Cada abertura (WebChat, botão 🎫 no Inbox, `!abrir`, IA) pode criar **outro** `TK-…` |

**Painel:** lista em `/platform/inbox/tickets`; detalhe em `/platform/inbox/tickets/:ref`. Chamados `webchat_site` carregam histórico via `WebChatService.getDetailForInbox`.

**Regra de ouro:** o Ticket **não substitui** o Inbox. O Ticket **não pode sequestrar** atendimento novo.

---

## Nomenclatura das janelas (aliases)

No produto e na documentação, use estes nomes — alinhados às constantes em `src/types/inbox-ticket.ts`:

| Alias (produto) | Duração | Constante | O que significa |
|-----------------|---------|-----------|-----------------|
| **Janela de retorno do Ticket** | 12 h | `TICKET_POST_CLOSE_REPLY_HOURS` | Prazo em que o cliente pode interagir com aquele chamado após envio da equipe ou fechamento |
| **Captura automática do Ticket** | 2 h | `TICKET_FOLLOW_UP_MENU_AFTER_HOURS` | Período inicial da janela de retorno em que respostas vão **direto** ao Ticket, sem menu |
| **Janela de complemento** | 30 min | `TICKET_CLIENT_REPLY_GRACE_MS` | Após a 1ª resposta com conteúdo na rodada, prazo para enviar complementos no mesmo chamado |

Ordem temporal dentro de uma rodada (após mensagem da equipe):

```txt
Equipe envia → [Captura automática: 2 h] → [Menu pós-2 h] → [Janela de retorno: até 12 h total]
                      ↓
              1ª resposta com conteúdo → [Janela de complemento: 30 min]
```

---

## Status × Modo de roteamento

São **dois eixos independentes** no modelo `InboxTicket`:

### `status` — situação do chamado (painel / equipe)

Descreve o **estado interno** do ticket para a equipe. **Não** decide sozinho para onde vai a próxima mensagem WhatsApp.

| Valor (MVP) | Rótulo | Significado |
|-------------|--------|-------------|
| `open` | Aberto | Chamado criado, aguardando análise |
| `in_progress` | Em andamento | Equipe trabalhando / responsável atribuído |
| `client_replied` | Cliente respondeu | Cliente enviou resposta na janela ativa |
| `closed` | Fechado | Encerrado pela equipe (cliente pode ainda responder dentro da janela de retorno) |

Helpers: `ticketIsActive()`, `INBOX_TICKET_STATUS_LABEL` em `src/types/inbox-ticket.ts`.

### `ticketInboundMode` — roteamento WhatsApp (próxima mensagem)

Controla **para onde** a próxima mensagem inbound do cliente é roteada no WhatsApp.

| Valor | Significado |
|-------|-------------|
| `ticket` | Cliente no fluxo do chamado — mensagens capturadas pelo handler de ticket |
| `awaiting_follow_up` | Aguardando escolha 1/2 do menu pós–2 h |
| `new_service` | Liberado para Inbox (triagem, fila, IA, novo atendimento) |
| *(undefined)* | Sem modo explícito — roteamento depende de janelas, menus e competição com Inbox |

Decisão de captura: `evaluateTicketInboundRouting()` em `src/services/inbox/inbound-routing.ts`.

### Status propostos (roadmap — ainda não implementados)

| Status proposto | Uso previsto |
|-----------------|--------------|
| `waiting_team` | Cliente respondeu; aguarda retorno da equipe |
| `waiting_client` | Equipe enviou; aguarda cliente na janela ativa |
| `paused` | Cliente pediu `sair` / pausa de complementos |
| `resolved` | Resolvido pela equipe (distinto de `closed` operacional) |
| `expired` | Janela de retorno encerrada; só histórico |

> **MVP:** use `status` + campos de janela (`clientReplyExpiresAt`, `clientReplyGraceUntil`, `clientReplyPaused`) + `ticketInboundMode` para expressar o comportamento WhatsApp.

---

## Quem pode criar um Ticket

| Origem | Quando |
|--------|--------|
| **Funcionário humano** | Atendente percebe que o caso não será resolvido naquele momento |
| **IA** | Sem atendente online, problema demorado ou precisa de análise humana |
| **Sistema** | Regra automática indica que o atendimento deve virar chamado |

### Exemplo: fora do horário com IA

```txt
Cliente: "Estou com problema na minha internet."

IA: "Entendi. No momento não temos atendentes online, mas vou registrar seu
     chamado para a equipe analisar assim que possível. Pode me informar seu
     nome e descrever melhor o problema?"

Cliente informa os dados.

Sistema:
  • cria Ticket TK-XXXXXX
  • salva nome, telefone, problema e resumo
  • deixa o chamado pendente para a equipe
  • NÃO trava o cliente no atendimento ao vivo

Cliente: "Seu chamado foi aberto com sucesso. Nossa equipe irá analisar e
          retornar assim que possível."

Equipe: acessa /platform/inbox/tickets, analisa, resolve ou responde pelo Ticket.
```

> **MVP atual:** criação automática de `TK-…` pela IA em escalação ainda em evolução. Criação manual e via equipe já disponível no painel.

---

## Diferença Inbox × Ticket

### Inbox (atendimento principal)

- Bot de triagem (menu de setores);
- IA de triagem (camada **opcional**);
- Escolha de setor e fila;
- Atendente assume conversa;
- Conversa em tempo real.

### Ticket (chamado assíncrono)

- Referência `TK-XXXXXX`;
- Comentários internos e @menções;
- Atualizações da equipe ao cliente;
- Resposta do cliente dentro de **janelas de tempo** definidas;
- Vinculado ao contato e à conversa, com **regras próprias** de captura no WhatsApp.

---

## Fluxo correto

```txt
Cliente entra pelo WhatsApp
        ↓
IA ou bot faz triagem (Inbox)
        ↓
Problema simples? → resolve no atendimento (IA ou humano)
        ↓
Problema demorado? → IA, funcionário ou sistema cria Ticket
        ↓
Ticket pendente no painel (/platform/inbox/tickets)
        ↓
Funcionário analisa quando disponível
        ↓
Funcionário envia resposta/atualização ao cliente (WhatsApp)
        ↓
Abre Janela de retorno do Ticket (12 h) para interagir com aquele chamado
        ↓
Cliente complementa, consulta status ou inicia novo atendimento (conforme regras)
```

### Máquina de estados — visão cliente (WhatsApp)

```mermaid
stateDiagram-v2
    [*] --> AguardandoEquipe: Ticket criado
    AguardandoEquipe --> CapturaAutomatica: Equipe envia mensagem
    CapturaAutomatica --> Complemento30min: Cliente responde (conteúdo)
    Complemento30min --> CapturaAutomatica: Dentro de 30 min
    Complemento30min --> MenuPos30min: 30 min expirou
    CapturaAutomatica --> MenuPos2h: Passaram 2 h
    MenuPos2h --> FluxoTicket: Cliente escolhe 1
    MenuPos2h --> Inbox: Cliente escolhe 2
    MenuPos30min --> Inbox: Cliente escolhe 1 (novo)
    MenuPos30min --> AguardandoEquipe: Cliente escolhe 2 (aguardar)
    FluxoTicket --> Complemento30min: Nova resposta com conteúdo
    CapturaAutomatica --> Inbox: Janela de retorno expirou (12 h)
    MenuPos2h --> Inbox: Janela de retorno expirou (12 h)
    AguardandoEquipe --> CapturaAutomatica: Nova mensagem da equipe
```

Ordem de prioridade ao receber mensagem WhatsApp (ver também § Prioridade WhatsApp):

```txt
1. Ticket (somente se contexto de captura válido — ver inbound-routing)
2. Consentimento LGPD (campanha)
3. Inbox (triagem / fila / ao vivo / IA)
```

---

## Janela de retorno do Ticket (12 h)

Quando a **equipe** envia resposta, atualização ou fechamento pelo Ticket, o cliente ganha **12 horas** (**Janela de retorno do Ticket**) para interagir com **aquele** chamado.

| Evento | Efeito desejado |
|--------|-----------------|
| Envio da equipe ao cliente **via Ticket** | Define/renova `clientReplyExpiresAt` (+12 h) e `clientReplyWindowStartedAt` em `sendTicketMessageToClient` |
| Fechamento com mensagem ao cliente | Inicia janela de retorno de 12 h (mesmo caminho) |
| Resposta / finalizar / CSAT no **Inbox ao vivo** | **Não** renova ticket fechado antigo (2.8.9) |
| **Após 12 h** sem nova mensagem da equipe **via Ticket** | Cliente **não** responde mais naquele TK → **novo atendimento no Inbox** |
| Nova atualização da equipe **via Ticket** | Renova 12 h; captura automática (2 h) e janela de complemento (30 min) recomeçam |
| Validação (2.8.10) | Elegível só se `lastTeamMessageAt` (ou `closedAt`) dentro das 12 h — ignora `clientReplyExpiresAt` inflado por inbox pré-2.8.9 |

Constante: `TICKET_POST_CLOSE_REPLY_HOURS = 12`.

### Janelas — implementação (v2.6.2+)

| Caminho | Comportamento |
|---------|---------------|
| `closeTicket()` | Fecha e notifica via `sendTicketMessageToClient` (renova +12 h) |
| `sendClientUpdate()` | Renova janela via `sendTicketMessageToClient` |
| `convertToTicket()` | Abre janela ao notificar cliente |
| Ack curto | Mantém janela existente; não sobrescreve se já válida |

---

## Captura automática do Ticket (2 h)

Nas **primeiras 2 horas** da janela de retorno, após mensagem da equipe, se o cliente responder, a mensagem vai **direto ao Ticket** — não ao menu do Inbox, não cria novo atendimento.

**Exemplo:**

> **Equipe:** Olá João, analisamos seu caso. Pode nos enviar uma foto do equipamento?  
> **Cliente (dentro de 2 h):** Segue a foto.  
> **Sistema:** salva em `clientReplies[]` do Ticket.

Constante: `TICKET_FOLLOW_UP_MENU_AFTER_HOURS = 2` · `TICKET_FOLLOW_UP_MENU_AFTER_MS`.

---

## Complemento via IA (Inbox triagem)

Quando o cliente está na **IA de atendimento** (`BOT_TRIAGE`) e quer **interagir em ticket existente** (ex.: informar telefone, foto ou dado extra):

1. Cliente confirma ou informa referência `TK-XXXXXX` → gravado em `AiConversationState.targetTicketRef`.
2. Cliente envia o dado (telefone, texto útil) → `InboxService.appendTicketClientReplyFromAi` persiste em `clientReplies[]`.
3. Painel: status `client_replied`, `unreadClientReply`, mensagem de sistema *"Informação adicionada ao ticket … (via assistente IA)"*.

**Serviços:** `AiTicketUpdateService`, `src/utils/ticket-ref.ts` · **JSON IA:** `targetTicketRef`, `shouldAppendToTicket`, `ticketAppendBody`.

**Resiliência:** gravação ocorre **antes** da chamada LLM e na recuperação de erro (rate limit), se o ticket já estiver selecionado — não depende só da resposta do modelo.

**Diferença do fluxo direto:** não dispara menu grace de 30 min nem altera `ticketInboundMode` — o cliente continua na conversa com a IA.

**Menu múltiplos tickets (2.6.7):** se houver 2+ chamados, a IA exibe menu numerado (`pendingTicketChoices` em `AiConversationState`); cliente responde `1`–`N`, `TK-…` ou *novo* para outro assunto. Um único chamado é selecionado automaticamente.

**Menu bot fixo (2.7.0):** fora da IA, em triagem padrão (`TicketClientMenuService`), o cliente pode digitar *ticket*, *chamado* ou código `TK-…`. Estado em `Destination.pendingTicketMenuChoices` / `pendingTicketTargetRef`; contexto `ticket_pick`. Desde **2.7.1** usa o mesmo `AiTicketAssistService` para status/recusa/perguntas.

**SLA equipe (2.7.0):** após resposta do cliente (`clientReplies`), inicia prazo configurável (`InboxSettings.ticketTeamResponseHours`, default 24h). Campos `teamSlaDueAt` / `teamSlaBreachedAt`; limpa quando equipe responde. Monitor em scan SLA do Inbox notifica painel (`inbox:priority`).

**Status enriquecidos (2.7.0):** painel exibe `displayStatus` derivado (`waiting_team`, `waiting_client`, `paused`, `expired`) via `ticket-display-status.ts`.

**Assistente inteligente (2.7.0):** antes de gravar no ticket, a IA classifica a intenção do cliente (`classifyTicketClientIntent` em `src/utils/ticket-client-intent.ts`):

| Intenção | Exemplo | Comportamento |
|----------|---------|---------------|
| `status_inquiry` | *Gostaria de saber o status dele?* | Responde andamento — **não grava** |
| `decline` | *não obrigado* | Despedida — **não grava** |
| `question` | *Como acompanho?* | Tenta KB/skills (`AiTicketAssistService`) — **não grava** |
| `problem_report` | *O problema voltou* | Tenta resolver; se não, pode gravar como complemento |
| `append_data` | telefone, endereço | Grava em `clientReplies[]` |

Orquestração: `AiTicketAssistService` + guards em `AiTicketUpdateService` (`ticketIntentBlocksAppend`). O prompt inclui contexto do ticket ativo (`getTicketBriefForAssist`).

---

## Janela de complemento (30 min)

Na **primeira resposta com conteúdo** do cliente dentro da rodada, o sistema abre **30 minutos** para complementos no **mesmo** chamado:

- texto, foto, documento, áudio, informação extra.

**Mensagem ao cliente (primeira resposta da rodada):**

> Ok! Se tiver mais alguma informação, me envie em no máximo 30 minutos que insiro no chamado.

(`TICKET_CLIENT_REPLY_GRACE_PROMPT`)

**Após 30 minutos:**

> O prazo de 30 minutos para enviar complementos encerrou. Suas informações já foram registradas no chamado.

(`TICKET_CLIENT_GRACE_EXPIRED_ACK`)

Durante os 30 min, tudo entra no Ticket. Depois, `clientReplyPaused = true` até menu das 2 h ou novo envio da equipe.

Constante: `TICKET_CLIENT_REPLY_GRACE_MS` (30 min).

**Se o cliente escrever depois dos 30 min (ainda dentro das 12 h):** o sistema exibe menu com **3 opções**:

```txt
1 — Enviar nova informação para este chamado  (reabre janela de complemento 30 min)
2 — Iniciar novo atendimento
3 — Aguardar retorno da equipe
```

(`ticket_grace_expired` em `lastMenuContext` — `parseTicketGraceExpiredChoice`, `buildTicketGraceExpiredMenu`.)

---

## Confirmações curtas (`Positivo`, `Ok`, etc.)

Respostas de **acknowledgment** (`isTicketClientAcknowledgment` em `src/types/inbox-ticket.ts`) — ex.: *Positivo*, *Ok obrigado*, *Entendido*, *Aguardo* — têm tratamento especial **no contexto do ticket** (janela já aberta pela equipe).

### Comportamento desejado

| Efeito | Comportamento |
|--------|---------------|
| Anexa no ticket | ✓ em `clientReplies[]` |
| Prompt de 30 min | **Não** envia |
| Janela de complemento | Encerra (`clientReplyGraceUntil` limpo) |
| **Janela de retorno (12 h)** | **Mantém** prazo já aberto pelo envio da equipe — **não reinicia do zero** |
| Pausa complementos | `clientReplyPaused = true` |
| Após 2 h corridas da janela | Menu ticket vs novo atendimento (mesmo com ticket **aberto**) |

Respostas **com conteúdo** (foto, dúvida, texto substantivo) seguem o fluxo normal: prompt de 30 min na primeira resposta da rodada.

> **Importante:** ack **não** é gatilho para abrir a janela de retorno. Quem abre/renova são **mensagens da equipe** (ou fechamento com notificação). Ack só consome/registra dentro da janela já existente.

### Lacuna MVP — implementação atual

Em `InboxService.recordTicketClientReply()` → `startTicketPostAckWindow()`:

| Aspecto | MVP atual | Desejado |
|---------|-----------|----------|
| `clientReplyExpiresAt` no ack | **Reinicia** +12 h a partir do ack | **Preservar** expiração existente (ou no máximo estender se já expirada) |
| Resposta com conteúdo | Zera `clientReplyExpiresAt` | Manter janela de retorno aberta pela equipe |
| `sendClientUpdate()` | Zera `clientReplyExpiresAt` antes do envio | Setar +12 h ao enviar |

Enquanto `sendClientUpdate` não setar `clientReplyExpiresAt`, tickets abertos dependem de `teamHasMessagedClient` + lógica em `inOpenTicketContext` — comportamento menos previsível que o desenho de produto acima.

---

## Depois de 2 h e antes de 12 h (menu do Ticket)

Após o fim da **captura automática** (2 h), nova mensagem do cliente **não** vai automaticamente ao Ticket. O sistema pergunta:

```txt
1 — Inserir informação, consultar status ou finalizar este Ticket
2 — Iniciar um novo atendimento
```

(`buildTicketFollowUpMenu()` — `lastMenuContext = ticket_followup`)

| Escolha | Comportamento |
|---------|---------------|
| **1** | Fluxo do Ticket (`ticketInboundMode = ticket`) — status, complemento, `sair` |
| **2** | `ticketInboundMode = new_service` — Inbox assume; bot/IA triagem normal |

---

## Depois de 12 horas

- Cliente **não** responde mais diretamente naquele Ticket.
- Qualquer mensagem vira **novo atendimento no Inbox** (triagem, setor, fila).
- O Ticket antigo permanece no painel para histórico e equipe.

**Reabertura para o cliente:** somente quando um funcionário envia **nova atualização** pelo Ticket → renova janela de retorno (12 h) e reinicia ciclo de captura automática (2 h) + complemento (30 min).

---

## Prioridade WhatsApp (Inbox × Ticket)

Inbox/IA **ativo compete** com ticket antigo. O ticket **não** sequestra atendimento novo por existir um `TK-…` aberto no histórico.

### Ticket captura quando

| Condição | Captura? |
|----------|----------|
| `ticketInboundMode = ticket` ou `awaiting_follow_up` | ✓ (modo explícito) |
| Janela de complemento ativa (`clientReplyGraceUntil` futuro) | ✓ |
| Menu ticket ativo (`ticket_followup`, `ticket_grace_expired`) e escolha válida | ✓ |
| Ack curto (*Positivo*, *ok*) **com** janela de retorno válida e **sem** Inbox/IA competindo | ✓ |
| `clientReplyPaused` + dentro de 12 h + escolha menu ticket / `status` | ✓ (`defer_inbox` até menu) |

### Ticket **não** captura quando

| Condição | Efeito |
|----------|--------|
| Inbox em triagem (`inboxTriageActive`, menu setores) | `release_inbox` |
| IA ativa (`aiTriageActive`) | `release_inbox` |
| Conversa em `bot_triage`, `waiting_queue`, `in_progress` | `release_inbox` (via `isInboxServiceCompeting`) |
| Ack solto durante IA/fila **sem** modo ticket explícito ou grace 30 min | **Não captura** — vai para Inbox |
| `ticketInboundMode = new_service` | `release_inbox` |
| Saudação / novo atendimento (`oi`, `novo atendimento`, etc.) | `release_inbox` |
| Janela de retorno expirada (12 h) em ticket fechado | `release_inbox` |

Implementação: `isInboxServiceCompeting()` + `evaluateTicketInboundRouting()` em `src/services/inbox/inbound-routing.ts`.

Ordem resumida:

```txt
Inbox/IA ativo + sem modo ticket explícito + sem grace 30 min → Inbox ganha
Modo ticket / grace / menu explícito → Ticket captura
```

---

## `sair` / `finalizar` no Ticket

No contexto do **Ticket**, `sair` ou `finalizar` **não** é opt-out LGPD.

Significa: o cliente não quer mais responder **aquele chamado** agora.

| Ação do sistema | |
|-----------------|--|
| Pausa respostas no Ticket (`clientReplyPaused`) | ✓ |
| Mantém Ticket visível para equipe | ✓ |
| Não bloqueia contato | ✓ |
| Não remove consentimento | ✓ |
| Não impede novo atendimento pelo Inbox | ✓ |

**Mensagem sugerida:**

> Entendido. Você não precisa responder mais neste chamado. Caso precise de um novo atendimento, envie uma nova mensagem.

Implementação: `parseTicketClientExit` / `parseTicketFinalize` rodam **antes** do `ConsentService` (`WhatsAppService`).

---

## Regra de segurança: Ticket não sequestra Inbox

Se o cliente escrever qualquer um dos itens abaixo, o sistema deve **liberar o Inbox**, exceto se estiver **claramente** na janela ativa do Ticket **e** o último menu enviado foi o **menu do Ticket** (`lastMenuContext`).

Gatilhos de liberação (exemplos):

- `oi`, `olá`, `menu`
- `novo atendimento`, `falar com atendente`
- `suporte`, `comercial`, `financeiro`
- escolha **1–4** do menu de **setores** do Inbox

### Controle de contexto de menu (`Destination`)

| `lastMenuContext` | Números pertencem a |
|-------------------|---------------------|
| `inbox_triage` | Inbox (setores 1–4) |
| `ticket_followup` | Ticket (1 = chamado, 2 = novo) |
| `ticket_grace_expired` | Pós–30 min (1 = complemento, 2 = novo, 3 = aguardar) |
| `consent` | LGPD |
| `none` | Intenção da mensagem / saudação |

TTL do contexto: **30 minutos** (`INBOX_MENU_CONTEXT_TTL_MS`).

---

## Regra final (resumo)

1. **Ticket ≠ Inbox** — camadas separadas; `status` ≠ `ticketInboundMode`.
2. **Ticket** = problemas demorados; **Inbox** = atendimento normal.
3. **IA** pode ajudar e criar Ticket, mas **nunca trava** o sistema (fallback para bot fixo).
4. **Janela de retorno (12 h)** sem equipe → cliente só entra pelo Inbox.
5. **Reabertura** do Ticket para o cliente só com nova mensagem da equipe.
6. **Ack curto** mantém janela de retorno existente — **não** abre 12 h do zero.
7. **Inbox/IA ativo** tem prioridade sobre ticket antigo, salvo modo ticket explícito ou grace 30 min.
8. **`sair` no Ticket** ≠ opt-out LGPD.

---

## Roadmap (produto — não implementado)

Itens planejados para evolução do módulo Ticket. **Não alterar código neste documento.**

| # | Item | Status |
|---|------|--------|
| 1 | **SLA interno equipe** | ✅ 2.7.0 — `ticketTeamResponseHours` (default 24h), `teamSlaDueAt` / `teamSlaBreachedAt`, alerta painel |
| 2 | **Menu pós-30 min ampliado** | ✅ 2.6.3 — 3 opções (complemento / novo / aguardar) |
| 3 | **Múltiplos tickets ativos** | ✅ 2.7.0 — menu numerado na IA (2.6.7) + bot fixo (`TicketClientMenuService`, contexto `ticket_pick`) |
| 4 | **Campos de auditoria** | ✅ 2.7.0 — `lastTeamMessageAt`, `lastStatusChangeAt`, campos SLA equipe |
| 5 | **Painel funcionário** | ✅ 2.7.0 — ações rápidas status, badge enriquecido, stats SLA |
| 6 | **Status enriquecidos** | ✅ 2.7.0 — `displayStatus` (`waiting_team`, `waiting_client`, `paused`, `expired`) |
| 7 | **Correção janelas MVP** | ✅ 2.6.2 |

---

## Modelo e API (referência técnica)

| Coleção | Campos principais |
|---------|-------------------|
| `inboxTickets` | `ticketRef`, `status`, `clientReplies[]`, `teamHasMessagedClient`, `clientReplyExpiresAt`, `clientReplyWindowStartedAt`, `clientReplyGraceUntil`, `clientReplyPaused`, `ticketInboundMode`, soft delete `deletedAt` |

Modelo Mongoose: `src/models/InboxTicket.ts`.

| Campo | Papel |
|-------|-------|
| `status` | Situação do chamado (MVP: `open` \| `in_progress` \| `client_replied` \| `closed`) |
| `ticketInboundMode` | Roteamento WhatsApp da próxima mensagem |
| `clientReplyExpiresAt` | Fim da janela de retorno (12 h) |
| `clientReplyWindowStartedAt` | Início da rodada atual (equipe enviou / fechou) |
| `clientReplyGraceUntil` | Fim da janela de complemento (30 min) |
| `clientReplyPaused` | Cliente pausou ou grace expirou |
| `teamHasMessagedClient` | Equipe já notificou o cliente no WhatsApp |
| `lastTeamMessageAt` | Última mensagem da equipe ao cliente (2.6.3) |
| `teamSlaDueAt` | Prazo interno equipe responder após msg cliente (2.7.0) |
| `teamSlaBreachedAt` | Momento em que SLA interno estourou (2.7.0) |
| `lastStatusChangeAt` | Última alteração manual de status (2.7.0) |
| `openedByUserId` | Quem abriu (MVP); roadmap: `createdBy` explícito |
| `assignedUserId` | Responsável (MVP); roadmap: `assignedTo` explícito |

Painel: `/platform/inbox/tickets`, `/platform/inbox/tickets/:ref`  
API: `GET/POST/PATCH /api/inbox/tickets/*` — ver [INBOX-ATENDIMENTO.md](./INBOX-ATENDIMENTO.md) § API REST tickets.

Exclusão: **soft delete** (`deletedAt`, `deletedBy`, `deleteReason`) — sem remoção física.

---

## Testes

```bash
npm test -- --testPathPattern=inbound-routing
```

Cenários cobertos: menu inbox vs ticket, janela de retorno (12 h), janela de complemento (30 min), competição Inbox/IA, ack durante triagem, `novo atendimento`, `bot_triage`, menus `ticket_followup` e `ticket_grace_expired`.

Arquivos: `src/services/inbox/__tests__/inbound-routing.test.ts`.
