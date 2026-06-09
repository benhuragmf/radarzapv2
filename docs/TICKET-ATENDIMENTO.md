# Ticket — chamado assíncrono (RadarZap)

Documento de referência do produto: o que é um Ticket, como difere do Inbox, quem cria, janelas de tempo e regras de roteamento no WhatsApp.

**Última revisão:** 2026-06-09  
**Implementação:** `src/services/inbox/InboxService.ts`, `src/types/inbox-ticket.ts`, `src/services/inbox/inbound-routing.ts`  
**Relacionado:** [INBOX-ATENDIMENTO.md](./INBOX-ATENDIMENTO.md) (atendimento ao vivo)

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
| Referência | Conversa no painel Inbox | `TK-XXXXXX` |
| Trava o cliente? | **Não** deve travar | **Não** deve travar |

**Regra de ouro:** o Ticket **não substitui** o Inbox. O Ticket **não pode sequestrar** atendimento novo.

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
Abre janela de 12 horas para o cliente interagir com aquele chamado
        ↓
Cliente complementa, consulta status ou inicia novo atendimento (conforme regras)
```

Ordem no WhatsApp ao receber mensagem:

```txt
1. Ticket (se contexto de chamado ativo)
2. Consentimento LGPD (campanha)
3. Inbox (triagem / fila / ao vivo)
```

---

## Janela de 12 horas

Quando a **equipe** envia resposta, atualização ou fechamento pelo Ticket, o cliente ganha **12 horas** para interagir com **aquele** chamado (responder, enviar dados, tirar dúvida, consultar status).

| Evento | Efeito |
|--------|--------|
| Envio da equipe ao cliente | Renova `clientReplyExpiresAt` (+12 h) |
| Fechamento com mensagem ao cliente | Inicia janela de 12 h |
| **Após 12 h** sem nova mensagem da equipe | Cliente **não** responde mais naquele TK → **novo atendimento no Inbox** |
| Nova atualização da equipe | Renova 12 h; regras de 2 h e 30 min recomeçam |

Constante: `TICKET_POST_CLOSE_REPLY_HOURS = 12` (`src/types/inbox-ticket.ts`).

---

## Primeiras 2 horas (resposta direta ao Ticket)

Nas **primeiras 2 horas** após a mensagem da equipe, se o cliente responder, a mensagem vai **direto ao Ticket** — não ao menu do Inbox, não cria novo atendimento.

**Exemplo:**

> **Equipe:** Olá João, analisamos seu caso. Pode nos enviar uma foto do equipamento?  
> **Cliente (dentro de 2 h):** Segue a foto.  
> **Sistema:** salva em `clientReplies[]` do Ticket.

Constante: `TICKET_FOLLOW_UP_MENU_AFTER_HOURS = 2`.

---

## Janela de 30 minutos (complementos)

Na **primeira resposta** do cliente dentro da rodada, o sistema abre **30 minutos** para complementos no **mesmo** chamado:

- texto, foto, documento, áudio, informação extra.

**Mensagem ao cliente (primeira resposta da rodada):**

> Ok! Recebi sua resposta. Se precisar enviar mais alguma informação para este chamado, envie em até 30 minutos.

**Após 30 minutos:**

> O prazo de 30 minutos para complementos deste chamado encerrou. Suas informações foram registradas para a equipe.

Durante os 30 min, tudo entra no Ticket. Depois, `clientReplyPaused = true` até menu das 2 h ou novo envio da equipe.

Constante: `TICKET_CLIENT_REPLY_GRACE_MS` (30 min).

**Se o cliente escrever depois dos 30 min (ainda dentro das 12 h):** o sistema **não** deixa sem resposta — exibe menu:

```txt
1 — Iniciar novo atendimento
2 — Aguardar retorno deste chamado
```

(`ticket_grace_expired` em `lastMenuContext` — ver [INBOX-ATENDIMENTO.md](./INBOX-ATENDIMENTO.md) § Proteções.)

---

## Depois de 2 h e antes de 12 h (menu do Ticket)

Após as **primeiras 2 horas** da janela, nova mensagem do cliente **não** vai automaticamente ao Ticket. O sistema pergunta:

```txt
1 — Ver status, inserir informação ou finalizar este Ticket
2 — Iniciar um novo atendimento
```

| Escolha | Comportamento |
|---------|---------------|
| **1** | Fluxo do Ticket (`ticketInboundMode = ticket`) — status, complemento, `sair` |
| **2** | `ticketInboundMode = new_service` — Inbox assume; bot/IA triagem normal |

Menu: `buildTicketFollowUpMenu()` — `lastMenuContext = ticket_followup`.

---

## Depois de 12 horas

- Cliente **não** responde mais diretamente naquele Ticket.
- Qualquer mensagem vira **novo atendimento no Inbox** (triagem, setor, fila).
- O Ticket antigo permanece no painel para histórico e equipe.

**Reabertura para o cliente:** somente quando um funcionário envia **nova atualização** pelo Ticket → renova 12 h e reinicia ciclo 2 h + 30 min.

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
| `ticket_grace_expired` | Pós–30 min (1 = novo, 2 = aguardar) |
| `consent` | LGPD |
| `none` | Intenção da mensagem / saudação |

TTL do contexto: **30 minutos** (`INBOX_MENU_CONTEXT_TTL_MS`).

Roteamento: `evaluateTicketInboundRouting()` em `src/services/inbox/inbound-routing.ts`.

---

## Regra final (resumo)

1. **Ticket ≠ Inbox** — camadas separadas, propósitos diferentes.
2. **Ticket** = problemas demorados; **Inbox** = atendimento normal.
3. **IA** pode ajudar e criar Ticket, mas **nunca trava** o sistema (fallback para bot fixo).
4. **12 h** sem equipe → cliente só entra pelo Inbox.
5. **Reabertura** do Ticket para o cliente só com nova mensagem da equipe.
6. **`sair` no Ticket** ≠ opt-out LGPD.

---

## Modelo e API (referência técnica)

| Coleção | Campos principais |
|---------|-------------------|
| `inboxTickets` | `ticketRef`, `status`, `clientReplies[]`, `clientReplyExpiresAt`, `clientReplyGraceUntil`, `clientReplyPaused`, `ticketInboundMode`, soft delete `deletedAt` |

| `ticketInboundMode` | Significado |
|---------------------|-------------|
| `awaiting_follow_up` | Aguardando escolha 1/2 do menu pós–2 h |
| `ticket` | Cliente no fluxo do chamado |
| `new_service` | Liberado para Inbox |

Painel: `/platform/inbox/tickets`, `/platform/inbox/tickets/:ref`  
API: `GET/POST/PATCH /api/inbox/tickets/*` — ver [INBOX-ATENDIMENTO.md](./INBOX-ATENDIMENTO.md) § API REST tickets.

Exclusão: **soft delete** (`deletedAt`, `deletedBy`, `deleteReason`) — sem remoção física.

---

## Testes

```bash
npm test -- --testPathPattern=inbound-routing
```

Cenários: menu inbox vs ticket, 12 h, grace 30 min, `novo atendimento`, `bot_triage`.
