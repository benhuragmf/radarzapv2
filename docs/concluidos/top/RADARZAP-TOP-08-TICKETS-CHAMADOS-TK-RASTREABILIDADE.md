# RadarZap — TOP 08/20 — Tickets, Chamados, TK e Rastreabilidade

**Data:** 2026-06-24  
**Versão após TOP 08:** `2.11.94`  
**Branch:** `main`

---

## Resumo executivo

O TOP 08 consolidou o módulo **Tickets/Chamados** já existente no RadarZap v2: protocolo `TK-XXXXXX`, token público com hash SHA-256, janela de resposta do cliente (12h), SLA operacional de equipe (24h após resposta do cliente), vínculo com Inbox/WebChat/WhatsApp, consulta pública segura, helpers centralizados de status/SLA e auditoria ampliada (`ticket.reopened`, `ticket.assigned`).

**Alterações de código:** helpers `ticket-status.util.ts` e `ticket-sla-priority.util.ts`; eventos de auditoria; testes de regressão ampliados. **Sem** redesign de Inbox, WebChat, WhatsApp Cloud, Leads ou billing.

---

## Herança dos TOPs anteriores

### TOP 01

Ticket identificado como módulo real (`InboxTicket`); protocolo `TK-…`; token público; janela 12h; testes `ticket-reply-window`, `inbox-ticket-inbound`, `ticket-public-access`; riscos cross-tenant e ambiguidade de protocolo.

### TOP 02

Baseline técnico verde (typecheck, build, test, `qa:atendimento:gate`).

### TOP 03

Matriz comercial definida; sem enforcement de billing por ticket nesta etapa.

### TOP 04

RBAC consolidado; atendente opera tickets vinculados; Owner/Admin/Supervisor gerenciam conforme permissões; cross-tenant bloqueado.

### TOP 05

Presença/fila consolidados; tickets não atribuem conversa a agente indisponível (herda TOP 07).

### TOP 06

Modos de atendimento; IA/bot que cria/consulta ticket respeita fallback humano.

### TOP 07

Inbox/fila/transferência consolidadas; tickets usam Inbox como base sem refazer fila.

### Esta etapa fecha

Ciclo de vida documentado, TK validado, token público validado, SLA documentado, janela 12h, consulta pública, auditoria mínima, helpers de status, testes.

### Esta etapa não faz

Leads/Kanban (TOP 09), Formulários (TOP 10), redesign WebChat (TOP 11), WhatsApp profundo/Cloud (TOP 12), IA Premium (TOP 15), créditos IA (TOP 16), billing (TOP 17), auditoria completa (TOP 18), produção pronta.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit | `78da007` — `chore(top): inbox fila e transferencia 2.11.93` |
| Modificados | Nenhum (working tree limpo exceto untracked) |
| Untracked (não commitar) | `data/`, `mocker/modelochat/` |
| Risco | Baixo — sem mistura com alterações pendentes de Inbox |

---

## Escopo autorizado

Tickets/chamados, protocolo TK, token público, ciclo de vida, SLA equipe, vínculo Inbox/WebChat/WhatsApp, janela de resposta, histórico, eventos/auditoria mínima, testes automatizados, documentação TOP 08.

---

## Diagnóstico atual de tickets

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Modelo de ticket | Sim | `src/models/InboxTicket.ts` | Coleção `inboxTickets` |
| Código TK | Sim | `src/utils/inbox-ticket-ref.ts` | `TK-` + 6 chars, alfabeto seguro |
| Token público | Sim | `src/utils/ticket-public-access.util.ts` | Hash SHA-256; formato `XXXX-XXXX` |
| Status | Sim | `src/types/inbox-ticket.ts` | `open`, `in_progress`, `client_replied`, `closed` |
| Prioridade | Não persistida | — | Metas em `ticket-sla-priority.util.ts` (referência) |
| SLA equipe | Sim | `src/services/inbox/ticket-team-sla.ts` | `teamSlaDueAt` — 24h após resposta cliente |
| Responsável | Sim | `InboxTicket.assignedUserId` | Atribuição via painel/`updateTicket` |
| Vínculo conversa WA | Sim | `conversationId` | `getTicketForUser` valida org |
| Vínculo WebChat | Sim | `webChatConversationId` | Canal `webchat_site` |
| Vínculo contato | Sim | `destinationId`, `contactIdentifier` | Telefone/e-mail |
| Vínculo canal | Sim | `channel` | `whatsapp` \| `webchat_site` |
| Vínculo organização | Sim | `clientId` | Índice único `{ clientId, ticketRef }` |
| Histórico | Sim | `comments`, `clientReplies`, `internalNotesList` | Notas internas separadas |
| Resposta do cliente | Sim | `InboxService.recordTicketClientReply` | Janela 12h + grace 30min |
| Consulta pública | Sim | `ticket-public-access.service.ts` | TK + token; rate limit |
| API painel | Sim | `DashboardService.ts` | `/inbox/tickets` |
| UI chamados | Sim | `InboxTickets.tsx`, `InboxTicketDetailView.tsx` | `/platform/inbox/chamados` |
| Testes | Sim | `__tests__/ticket-*`, `inbox-ticket-*` | Gate atendimento |
| Auditoria/eventos | Sim | `AttendanceEvent` | `ticket.created`, `client_replied`, `closed`, + TOP 08 |

---

## Diagnóstico do protocolo TK

| Aspecto | Estado |
|---------|--------|
| Geração | `generateInboxTicketRef()` — `crypto.randomBytes(6)` |
| Formato | `TK-XXXXXX` (6 caracteres) |
| Alfabeto | `23456789ABCDEFGHJKMNPQRSTUVWXYZ` — sem 0/O/1/I/L |
| Unicidade | Índice Mongo `{ clientId: 1, ticketRef: 1 }` unique |
| Colisão | Retry implícito na criação se duplicate key (fluxo existente) |
| Pesquisa | `ticketRef` indexado; normalização `normalizeTicketRefForLookup` |
| Testes | `inbox-ticket-ref.test.ts` — formato e ausência de ambíguos |
| Risco | Baixo — alinhado às regras TOP 08 |

---

## Diagnóstico do token público

| Aspecto | Estado |
|---------|--------|
| Geração | `generateTicketPublicAccessToken()` — 8 chars, `XXXX-XXXX` |
| Armazenamento | Hash SHA-256; `select: false` no schema |
| Entropia | Alfabeto 32 chars × 8 posições |
| ≠ TK | Validado em teste |
| Expiração | Token rotacionado no reenvio OTP; hash substituído |
| Consulta | `lookupTicketByPublicAccess` — filtra por `clientId` + ref + hash |
| Erro seguro | Mensagem genérica; `recordTicketLookupFailure` |
| Rate limit | `ticket-public-lookup-rate-limit.ts` |
| Cross-tenant | Query sempre com `clientId` do widget/org |
| Notas internas | **Não** expostas em `buildTicketPublicLookupResult` |
| Logs | Token não persistido em log de auditoria (`meta` sem corpo/token) |

---

## Diagnóstico de SLA e prioridades

| Aspecto | Estado |
|---------|--------|
| Prioridade no modelo | **Ausente** — documentada para evolução futura |
| SLA operacional | `DEFAULT_TICKET_TEAM_RESPONSE_HOURS = 24` após `client_replied` |
| Campos | `teamSlaDueAt`, `teamSlaBreachedAt`, `teamSlaNotifiedAt` |
| Metas comerciais | `TICKET_SLA_TARGETS` em `ticket-sla-priority.util.ts` |
| UI | `serializeTicketDisplayFields` — `teamSlaOverdue` |
| Calendário comercial | Não implementado (fora do escopo TOP 08) |

**Mapeamento referência vs implementação:**

| Prioridade | 1ª resposta (ref.) | Resolução (ref.) | Operacional hoje |
|------------|-------------------|------------------|------------------|
| low | 24h | 5 dias | 24h team SLA |
| normal | 8h | 3 dias | 24h team SLA |
| high | 2h | 24h | 24h team SLA |
| urgent | 30min | 4h | 24h team SLA |

---

## Diagnóstico de vínculo com Inbox

- Criação: `convertToTicket` / fluxos inbound — preserva `conversationId`, `destinationId`, `departmentId`.
- `getTicketForUser`: valida `clientId` + conversa pertence à org (`getConversationIfAllowed` ou WebChat).
- Ticket persiste após conversa fechada (`status: closed` no ticket ≠ conversa).
- Resposta cliente reativa `client_replied` + SLA + alerta equipe.
- Sem duplicidade: roteamento inbound reutiliza ticket ativo quando aplicável (`inbound-routing`).

---

## Diagnóstico WebChat e WhatsApp

### WebChat

- Consulta TK + token: `POST …/tickets/lookup`, `…/tickets/resume`.
- Criação com token na mensagem de abertura.
- Retomada chat: `canContinueInChat` se conversa aberta + ticket ativo.
- Intake/bridge ocultos na consulta pública.

### WhatsApp

- Menu cliente: `TicketClientMenuService`.
- Comandos equipe: `!ticket`, `!nota`, `!encerrar` — `whatsapp-agent-command.service.ts`.
- Resposta cliente `TK-XXXX texto` dentro da janela.
- Criação via conversa/`!abrir` (documentado em `TICKET-ATENDIMENTO.md`).

---

## Estados oficiais de ticket

### Persistidos (não renomear)

| Código | Label |
|--------|-------|
| `open` | Aberto |
| `in_progress` | Em andamento |
| `client_replied` | Cliente respondeu |
| `closed` | Fechado |

### Mapeamento produto → código/derivado

| Estado produto | Como aparece |
|----------------|--------------|
| `open` | `status: open` |
| `in_progress` | `status: in_progress` |
| `pending_team` | `client_replied` ou `unreadClientReply` |
| `pending_customer` | `waiting_client` (display) |
| `waiting_internal` | `clientReplyPaused` |
| `closed` | `status: closed` |
| `expired` | `closed` + `clientReplyExpiresAt` passado |
| `reopened` | Evento `ticket.reopened` (status volta `open`/`in_progress`) |
| `resolved` | Não persistido — usar `closed` |
| `archived` | `deletedAt` (soft delete) |

Helper: `src/types/ticket-status.util.ts` — `mapTicketToProductStatus`, `canCustomerReplyToTicket`.

---

## Regras oficiais de protocolo TK

1. Formato `TK-XXXXXX` — 6 caracteres após prefixo.
2. Alfabeto sem 0/O/1/I/L.
3. Único por organização (`clientId` + `ticketRef`).
4. Pesquisável no painel e WhatsApp/WebChat.
5. Não expõe `ObjectId` ao cliente.

---

## Regras oficiais de token público

1. Formato `XXXX-XXXX` — distinto do TK.
2. Armazenado apenas como hash SHA-256.
3. Consulta exige `clientId` (widget) + TK + token.
4. Resposta genérica em falha — sem vazar existência cross-tenant.
5. Rate limit em lookup e reenvio OTP.
6. Rotação invalida token anterior.

---

## Regras oficiais de SLA

- **Operacional (implementado):** equipe tem 24h para responder após mensagem do cliente (`applyTeamSlaOnClientReply`).
- **Comercial (referência):** tabela em `ticket-sla-priority.util.ts` — ativação por campo `priority` fica para etapa futura.
- **Sem** calendário comercial nem cobrança por SLA nesta etapa.

---

## Janela de resposta do cliente

- **12 horas** após fechamento ou último envio da equipe (`TICKET_POST_CLOSE_REPLY_HOURS`).
- Validação: `isClosedTicketReplyWindowActive` — ignora `clientReplyExpiresAt` inflado pré-2.8.9.
- Fora da janela: menu follow-up ou novo atendimento.
- Grace **30 min** para complementos em ticket ativo.

---

## Criação e atualização de tickets

| Fluxo | Implementado |
|-------|--------------|
| Painel — converter conversa | `convertToTicket` |
| WhatsApp inbound / menu | `inbound-routing`, `TicketClientMenuService` |
| WebChat | Criação com token na abertura |
| Fechar | `closeTicket` + notificação cliente |
| Reabrir | `reopenTicket` + audit `ticket.reopened` |
| Atribuir | `updateTicket` + audit `ticket.assigned` |
| Nota interna | `internalNotesList` — não vai ao cliente |

Permissões: via RBAC painel (`getTicketForUser` + `getConversationIfAllowed`).

---

## Consulta pública de ticket

- Entrada: TK + token (+ `clientId` do widget).
- Retorno: ref, status, subject (filtrado), departamento, mensagens recentes (sem intake/bridge/notas internas).
- Resposta: `resume` respeita janela e canal.
- OTP para reenvio de token com verificação de contato.

---

## Eventos, auditoria e rastreabilidade

| Kind | Quando |
|------|--------|
| `ticket.created` | Abertura |
| `ticket.client_replied` | Resposta cliente (sem corpo no audit) |
| `ticket.closed` | Fechamento |
| `ticket.reopened` | Reabertura (TOP 08) |
| `ticket.assigned` | Atribuição via `updateTicket` (TOP 08) |

Webhooks: `ticket.created`, `ticket.closed`, `ticket.client_replied`.

---

## Correções ou ajustes aplicados

1. `ticket-status.util.ts` — helpers de estado de produto e `canCustomerReplyToTicket`.
2. `ticket-sla-priority.util.ts` — metas SLA por prioridade (referência).
3. `AttendanceEvent` — `ticket.reopened`, `ticket.assigned`.
4. `InboxService.reopenTicket` / `updateTicket` — registra auditoria.
5. Teste: notas internas ausentes na consulta pública.
6. Teste: token ≠ TK.

---

## Testes criados ou atualizados

| Arquivo | Cobertura |
|---------|-----------|
| `ticket-status.util.test.ts` | Status, pendências, janela 12h |
| `ticket-sla-priority.util.test.ts` | Metas SLA, dueAt |
| `ticket-public-access.util.test.ts` | Token ≠ TK |
| `ticket-public-access.service.test.ts` | Notas internas ocultas |
| `inbox-ticket-audit.integration.test.ts` | `ticket.reopened` |
| Existentes no gate | `ticket-reply-window`, `inbox-ticket-inbound`, etc. |

---

## Gates executados

```bash
npm run typecheck          # verde
npm run build              # verde
npm test                   # 634 passed (110 suites)
npm run qa:atendimento:gate # verde (205 jest + qa:prep)
```

| Gate | Resultado |
|------|-----------|
| `typecheck` | Verde |
| `build` | Verde |
| `npm test` | **634** passed |
| `qa:atendimento:gate` | **Verde** (144 + 61 jest; `qa:prep` com MongoDB via Docker) |

Frontend não alterado — build frontend não obrigatório nesta etapa.

---

## Arquivos alterados

- `src/types/ticket-status.util.ts` (novo)
- `src/types/ticket-sla-priority.util.ts` (novo)
- `src/types/__tests__/ticket-status.util.test.ts` (novo)
- `src/types/__tests__/ticket-sla-priority.util.test.ts` (novo)
- `src/models/AttendanceEvent.ts`
- `src/services/inbox/InboxService.ts`
- `src/services/inbox/__tests__/ticket-public-access.service.test.ts`
- `src/services/inbox/__tests__/inbox-ticket-audit.integration.test.ts`
- `src/utils/__tests__/ticket-public-access.util.test.ts`
- `docs/top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md` (novo)
- `docs/TICKET-ATENDIMENTO.md`
- `docs/CHANGELOG.md`
- `docs/SISTEMA-REGISTRO.md`
- `docs/INDICE-DOCUMENTACAO.md`
- `package.json`
- `README.md`
- `.cursor/rules/radarzap-v2-system-registry.mdc`

---

## Riscos reduzidos

- Protocolo TK sem caracteres ambíguos — testado.
- Token público com hash + erro genérico + rate limit.
- Notas internas não vazam na consulta pública — teste explícito.
- Cross-tenant bloqueado por `clientId` em queries.
- Estados de produto documentados sem renomear persistido.
- Reabertura e atribuição rastreáveis.

---

## Riscos restantes

- Campo `priority` não persistido — SLA comercial é referência apenas.
- `resolved` vs `closed` não separados no modelo.
- Auditoria de lookup inválido não registrada (TOP 18).
- QA manual E2E de fluxo completo TK no widget não executado nesta etapa.
- `comments[]` na consulta pública são mensagens ao cliente — equipe deve não usar para notas internas.

---

## Decisões pendentes para Benhur

1. Persistir `priority` no `InboxTicket` e ligar SLA operacional à tabela comercial?
2. Separar status `resolved` de `closed` no modelo?
3. Registrar `ticket.public_lookup_failed` em `AttendanceEvent` (volume/risco)?

---

## Próximo passo recomendado

**TOP 09 — Leads e Kanban:** oportunidades comerciais, fila por capacidade, vínculo opcional com Inbox — sem refazer tickets.
