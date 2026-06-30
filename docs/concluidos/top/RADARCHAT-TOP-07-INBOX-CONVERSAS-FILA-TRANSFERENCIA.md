# Radar Chat — TOP 07/20 — Inbox, Conversas, Fila e Transferência

**Data:** 2026-06-24  
**Versão após TOP 07:** `2.11.93`  
**Branch:** `main`

---

## Resumo executivo

O TOP 07 consolidou o **núcleo operacional da Inbox unificada** (WhatsApp + WebChat): helpers de status de conversa, fila segura reutilizando TOP 05, atribuição com verificação de capacidade/presença, transferência com bloqueio cross-tenant e de conversa alheia, auditoria `AttendanceEvent` para fila/atribuição/transferência, eventos de painel `inbox:assigned` e `inbox:transferred`, e testes de regressão.

**Gates:** typecheck, build, 618 testes, `qa:atendimento:gate` — verdes. Frontend não alterado.

---

## Herança dos TOPs anteriores

### TOP 01

`InboxService.ts` monolítico; WA + WebChat na Inbox; `qa:atendimento:gate` obrigatório.

### TOP 02

Baseline verde (typecheck, build, test, gate).

### TOP 03

Matriz comercial; `maxConcurrentChatsPerAgent` por plano (TOP 05 aplica).

### TOP 04

RBAC; `INBOX_TRANSFER`, `INBOX_SUPERVISE`; equipe por organização.

### TOP 05

Somente `online` na fila; `supervisor_online`/ocupado/ausente/offline excluídos; limite simultâneo; `inbox:agent_offline_risk`.

### TOP 06

Modos com fallback humano/fila (`disabled`, `robotic`, básica, premium, híbrido).

### Esta etapa fecha

Estados documentados, fila/atribuição/transferência seguras, auditoria mínima, testes, anti cross-tenant.

### Esta etapa não faz

Tickets aprofundados (TOP 08), Leads/Kanban (TOP 09), redesign WebChat, Cloud API, billing, recarga IA, produção pronta.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `d63123c` — `chore(top): modos de atendimento 2.11.92` |
| Untracked (não commitados) | `data/`, `mocker/modelochat/` |
| Risco | Baixo |

---

## Escopo autorizado

Inbox, conversa, fila, atribuição, transferência, setores, eventos painel, testes, documentação.

---

## Diagnóstico atual da Inbox

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Modelo conversa | Sim | `models/InboxConversation.ts` | `clientId`, status, canal |
| Modelo mensagem | Sim | `models/InboxMessage.ts` | inbound/outbound/system/internal |
| Status conversa | Sim | `types/inbox.ts` | Enum `InboxConversationStatus` |
| Canal WebChat | Sim | `webchat-inbox-bridge.ts`, `WebChatService` | IDs `wc:` na lista |
| Canal WhatsApp | Sim | `InboxService.handleInboundMessage` | `whatsapp_qr` |
| Fila | Sim | `WAITING_QUEUE` + `queueEnteredAt` | Mongo, não in-memory |
| Atribuição | Sim | `assignConversation`, round-robin suggest | TOP 07: capacidade |
| Transferência | Sim | `transferConversation`, `InboxTransfer` | TOP 07: ownership + audit |
| Departamentos | Sim | `InboxDepartment` | `memberUserIds`, round-robin |
| Eventos painel | Sim | `PanelNotifications`, `emitInboxEvent` | + assigned/transferred |
| Notas internas | Sim | `direction: internal` | Supervisor/atendente |
| SLA | Sim | `inbox-inactivity.ts` | Aviso/encerramento |
| CSAT | Sim | `csat.util.ts` | Não alterado TOP 07 |
| Ticket | Sim | `InboxTicket` | TOP 08 |
| Contato | Sim | `Destination` | Vínculo 1:1 WA |
| Lead | Sim | `LeadFormService` | TOP 09 |
| Auditoria | Sim | `AttendanceEvent` | + inbox.* kinds TOP 07 |

---

## Diagnóstico atual dos modelos de conversa

| Modelo | Papel | Organização | Atribuição |
|--------|-------|-------------|------------|
| `InboxConversation` | Conversa WA principal | `clientId` | `assignedUserId`, `suggestedUserId` |
| `InboxMessage` | Timeline | `conversationId` | — |
| `WebChatConversation` | Chat site | `clientId` | Espelhado na lista unificada |
| `Destination` | Contato WA | `clientId` | `identifier` = telefone |
| `InboxTransfer` | Histórico transferência | `clientId` | `fromUserId`, deptos |

WebChat usa bridge `mapWebChatToInboxStatus` — sem duplicar `InboxConversation` para WC.

---

## Diagnóstico atual da fila

- Entrada: `handleTriageReply`, `routeHumanOnlyFromBotTriage` (TOP 06), `escalateToQueue` (WebChat).
- Atribuição automática: `pickNextRoundRobinUser` → `suggestedUserId` (não auto-assign).
- Persistência: Mongo (`WAITING_QUEUE`).
- Elegibilidade: `filterQueueEligibleAgentIds` + `isAgentAtCapacity` (TOP 05).
- Sem online: mensagem sistema + evento `inbox:priority_expired`.
- Todos ocupados: mensagem espera + permanece na fila.
- WebChat paridade via `suggestRoundRobinAgent` / `escalateToQueue`.

---

## Diagnóstico atual de atribuição

- Automática: round-robin sugere (`suggestedUserId`), atendente **assume** (`assign`).
- Manual: `POST /inbox/conversations/:id/assign` (`INBOX_REPLY`).
- Supervisor: `reassignConversation` (`INBOX_SUPERVISE`).
- WhatsApp `!assumir`: whitelist equipe (existente).
- TOP 07: `canAgentReceiveNewAssignment` ao assumir da fila.
- TOP 07: `assertInboxOrganizationMember` em acesso à conversa.

---

## Diagnóstico atual de transferência

- `transferConversation` → novo dept, `WAITING_QUEUE`, round-robin, mensagem cliente.
- `InboxTransfer` persiste histórico.
- Permissão API: `INBOX_TRANSFER`.
- Setor interno: `assertUserCanTransferToDepartment` (rank).
- TOP 07: atendente não transfere conversa de outro sem ser gestor/admin/dono.
- TOP 07: `inbox.transferred` audit + `inbox:transferred` painel.

---

## Estados oficiais de conversa

| Estado produto | Estado no código | Canal | Observação |
|----------------|------------------|-------|------------|
| `new` | (implícito pré-triagem) | WA/WC | Antes de `bot_triage` |
| `bot_triage` | `bot_triage` | WA/WC | Menu/IA/triagem |
| `waiting_queue` | `waiting_queue` | WA/WC | Fila humana |
| `with_agent` | `in_progress` | WA/WC | `assignedUserId` definido |
| `pending_agent` | `in_progress` | WA/WC | Última msg do cliente |
| `pending_customer` | `in_progress` | WA/WC | Última msg da equipe |
| `transferred` | `transferred` | WA | Estado transitório legado |
| `resolved` | `resolved` | WA/WC | Finalizada (CSAT) |
| `closed` | `closed` | WA/WC | Encerrada |
| `archived` | — | — | Não persistido; histórico via lista |

Helpers: `src/types/inbox-conversation-status.util.ts`.

---

## Regras oficiais de fila

1. Humano necessário → `waiting_queue` ou sugestão round-robin.
2. Só `online` elegível (`filterQueueEligibleAgentIds`).
3. Limite simultâneo por plano (`canAgentReceiveNewAssignment`).
4. `supervisor_online`, ocupado, ausente, offline → excluídos.
5. Sem elegível → conversa permanece na fila + mensagem espera.
6. Tenant isolado por `clientId`.
7. Setor respeitado via `departmentId` + membros do dept.

---

## Regras oficiais de atribuição

- Membro ativo da organização (`assertInboxOrganizationMember`).
- Assumir da fila: presença `online` + capacidade disponível.
- Prioridade (`suggestedUserId`): timeout ou atendente ocupado permite pull.
- Gestor/admin/dono podem reatribuir via supervisor.
- Evento `inbox:assigned` + audit `inbox.assigned`.

---

## Regras oficiais de transferência

- `INBOX_TRANSFER` na API.
- Não transferir conversa alheia sem override (OWNER/ADMIN/MANAGER).
- Depto destino na mesma org; rank interno validado.
- Histórico em `InboxTransfer`.
- Cliente notificado (setor público).
- Evento `inbox:transferred` + audit `inbox.transferred`.

---

## WebChat na Inbox

- Lista unificada `channel=all`, prefixo `wc:`.
- Fallback humano → `escalateToQueue` + round-robin.
- Modos TOP 06 via `runVisitorAutomationPipeline`.
- Assign/transfer via `WebChatService` espelhando Inbox API.

---

## WhatsApp na Inbox

- `handleInboundMessage` → triagem por modo (TOP 06).
- `disabled` → fila direta (`routeHumanOnlyFromBotTriage`).
- Menu/IA/híbrido → fallback fila validado TOP 06.
- `!assumir` operacional (equipe whitelist).

---

## Eventos em tempo real

| Evento painel | Quando |
|---------------|--------|
| `inbox:new_chat` | Nova fila / contato |
| `inbox:new_message` | Mensagem inbound |
| `inbox:priority` | Round-robin sugeriu |
| `inbox:priority_expired` | Sem online — fila aberta |
| `inbox:assigned` | Atendente assumiu (TOP 07) |
| `inbox:transferred` | Transferência de setor (TOP 07) |
| `inbox:agent_offline_risk` | TOP 05 |

Socket: `emitInboxEvent` (`inbox:message`, `inbox:conversation`).

---

## Auditoria e rastreabilidade

`AttendanceEvent` kinds TOP 07:

- `inbox.queued` — entrou na fila
- `inbox.assigned` — assumiu
- `inbox.transferred` — transferiu setor
- `inbox.reassigned` — supervisor reatribuiu

Auditoria completa → TOP 18.

---

## Correções ou ajustes aplicados

- `assertInboxOrganizationMember` em `getConversationIfAllowed` (anti cross-tenant).
- `assertCanModifyAssignedConversation` em transferência.
- Capacidade/presença ao assumir da fila.
- `filterQueueEligibleAgentIds` centralizado no round-robin.
- Audit + eventos painel assign/transfer/queue.

---

## Testes criados ou atualizados

- `inbox-conversation-status.util.test.ts` (3)
- `inbox-org-access.test.ts` (3)
- `inbox-queue-eligibility.test.ts` (2)
- `agent-availability.test.ts` (+1 capacidade)

Total projeto: **618** testes.

---

## Gates executados

```bash
npm run typecheck          # verde
npm run build              # verde
npm test                   # 618 passed
npm run qa:atendimento:gate # verde
```

Frontend não alterado — build frontend não obrigatório nesta etapa.

---

## Arquivos alterados

| Área | Arquivos |
|------|----------|
| Tipos | `inbox-conversation-status.util.ts`, `panel-events.ts` |
| Inbox | `InboxService.ts`, `inbox-org-access.util.ts`, `inbox-queue-eligibility.util.ts` |
| Modelo | `AttendanceEvent.ts` |
| Testes | 4 arquivos em `__tests__/` |
| Versão | `package.json` → `2.11.93` |
| Docs | Este arquivo, CHANGELOG, SISTEMA-REGISTRO, INDICE, INBOX-ATENDIMENTO |

---

## Riscos reduzidos

- Cross-tenant em operações de conversa.
- Atendente assumindo acima da capacidade.
- Transferência de conversa alheia sem permissão de gestão.
- Fila atribuindo indisponíveis (reforço via helper central).

---

## Riscos restantes

- `InboxService` continua monolítico — refatoração futura.
- `reassignConversation` só OWNER/ADMIN (MANAGER com `INBOX_SUPERVISE` na API mas assertSupervisor restrito).
- Presença in-memory — reinício do processo zera estado.
- Testes integrados E2E de transferência no painel não ampliados.

---

## Decisões pendentes para Benhur

1. `assertSupervisor` deve incluir `MANAGER` com `inbox:supervise`?
2. Supervisor pode atribuir a atendente offline explicitamente (override)?
3. Auto-assign direto (sem aceite) no futuro ou manter suggest+pull?

---

## Próximo passo recomendado

**TOP 08 — Tickets/Chamados** — aprofundar ciclo TK, SLA equipe, menu cliente, integração IA×ticket, sem misturar com fila Inbox já fechada neste TOP.
