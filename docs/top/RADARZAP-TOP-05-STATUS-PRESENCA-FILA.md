# RadarZap — TOP 05/20 — Status Operacional, Presença e Fila

**Data:** 2026-06-24  
**Versão após TOP 05:** `2.11.91`  
**Branch:** `main`

---

## Resumo executivo

O TOP 05 consolidou o **comportamento operacional de atendimento**: status oficiais tipados, regra central de fila (`somente online` recebe novo atendimento), validação de `supervisor_online` no backend (API + socket), ausência automática testada, limite simultâneo por plano no catálogo comercial, alerta de risco quando atendente desconecta com chat ativo, e testes automatizados ampliados.

**Já existia (TOP 01):** presença in-memory, heartbeat, `AgentStatusSelector`, round-robin com filtro de disponibilidade, `maxConcurrentChatsPerAgent` em `InboxSettings`.

**Ajustes TOP 05:** helper `agent-availability.ts`, teto por plano em `config/plans.json`, `preferOnlineCandidates` sem fallback perigoso, `filterHeartbeatOperationalStatus` no socket, evento `inbox:agent_offline_risk`.

**Gates:** typecheck, build, 602 testes, `qa:atendimento:gate` — verdes.

---

## Herança dos TOPs anteriores

### TOP 01

Presença/status parcialmente implementados; lacunas: política offline com chats ativos, limite simultâneo por plano, validação completa de distribuição.

### TOP 02

Baseline verde; `qa:atendimento:gate` obrigatório para mudanças em Inbox/WA/WebChat.

### TOP 03

Matriz comercial; limites de equipe; sem enforcement de capacidade simultânea no catálogo até esta etapa.

### TOP 04

RBAC/equipe; supervisor como perfil operacional (`MANAGER` + `inbox:supervise`).

### Esta etapa fecha

Status oficiais, fila segura, supervisor online, auto-ausente, limite simultâneo, política de chats ativos, testes.

### Esta etapa não faz

Modo de atendimento (TOP 06), billing, IA nova, redesign WebChat, reatribuição automática de chats ativos.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `e79323b` — TOP 04 RBAC 2.11.90 |
| Untracked | `data/`, `mocker/modelochat/` |
| Risco | Baixo |

---

## Escopo autorizado

Presença, status, fila, distribuição, UI mínima de status (já existente), testes e documentação.

---

## Diagnóstico atual de presença

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Status online | Sim | `src/types/agent-presence.ts` | `QUEUE_ELIGIBLE_STATUSES = ['online']` |
| Status ausente | Sim | idem | Manual ou `statusSource: auto` |
| Status ocupado | Sim | idem | Não recebe fila |
| Status offline | Sim | idem | Heartbeat expirado ou disconnect |
| Status supervisor_online | Sim | idem | Só `inbox:supervise` |
| Heartbeat | Sim | `useAgentPresenceHeartbeat.ts`, socket `agent:heartbeat` | 30s padrão |
| Timeout inatividade | Sim | `presenceIdleTimeoutSeconds` | Frontend → auto `ausente` |
| Timeout offline socket | Sim | `agentPresenceTimeoutSeconds` | Default 90s |
| Status manual | Sim | `PATCH /inbox/presence/me` | `statusSource: manual` |
| Status automático | Sim | Heartbeat + idle | `statusSource: auto` |
| Permissão supervisor_online | Sim | `inbox-agent-presence-api.ts` | TOP 05: também no socket |
| Persistência | Parcial | In-memory por processo | Reinício do servidor zera |
| Tempo real | Sim | Socket.IO `agent:presence:changed` | |
| UI seletor | Sim | `AgentStatusSelector.tsx` | Filtra por `selectableStatuses` |

---

## Diagnóstico atual de fila e distribuição

| Fluxo | Status atual | Lacuna |
|-------|--------------|--------|
| Novo WebChat | Round-robin + `isAgentAvailableForQueue` | — |
| Nova mensagem WA | Fila/setor + sugestão RR | — |
| Transferência manual | Supervisor/atendente com permissão | — |
| Fila por departamento | Sim | — |
| Fila sem atendente | Mensagem + evento painel | — |
| Atendente ocupado | Excluído da fila | — |
| Atendente ausente | Excluído da fila | — |
| Supervisor online | Excluído da fila | — |
| Limite simultâneo | `isAgentAtCapacity` + teto plano | UI não mostra X/Y |
| `preferOnlineCandidates` | TOP 05: não faz fallback para indisponíveis | — |

---

## Status oficiais

| Status | Nome UI | Novo atendimento auto | Chat ativo |
|--------|---------|----------------------|------------|
| `online` | Online | Sim | Sim |
| `supervisor_online` | Online sem receber | Não | Sim (manual) |
| `ocupado` | Ocupado | Não | Sim |
| `ausente` | Ausente | Não | Sim (atribuído) |
| `offline` | Offline | Não | Não recomendado responder |

---

## Regras oficiais de disponibilidade

```txt
Somente operationalStatus === 'online' E heartbeat válido → availableForQueue === true
```

Implementação: `isQueueEligibleStatus()` + `entryToSnapshot()` em `inbox-agent-presence.ts`.

Helper central: `src/services/inbox/agent-availability.ts` — `canAgentReceiveNewAssignmentByPresence`, `canAgentReceiveNewAssignment`.

---

## Supervisor online sem receber atendimento

- Seleção: `SUPERVISOR_SELECTABLE_STATUSES` quando capability `inbox:supervise`.
- Backend: `assertStatusAllowed` em `PATCH /inbox/presence/me` e admin `PATCH /inbox/presence/:userId`.
- **TOP 05:** `filterHeartbeatOperationalStatus` no socket impede atendente comum forjar status via heartbeat.
- Mensagem de erro: `Este status é exclusivo para supervisores e administradores.`

---

## Ausência automática por inatividade

- Config: `presenceIdleTimeoutSeconds` (padrão 300s) em InboxSettings.
- Frontend: `useAgentPresenceHeartbeat` — se `online` e idle ≥ timeout → `ausente` + `statusSource: auto` + prompt de retorno.
- **TOP 05:** Backend ignora auto-`ausente` se status atual é `ocupado` ou `supervisor_online` (`shouldApplyAutoAusente`).
- Retorno manual: `restoreFromAutoAusente()` → `lastManualStatus` ou `online`.

---

## Política para atendimentos ativos

| Mudança de status | Comportamento |
|-------------------|---------------|
| → `ocupado` / `ausente` | Chats ativos permanecem atribuídos; sem novos |
| → `offline` | Sem encerramento automático; evento `inbox:agent_offline_risk` para supervisão |
| Reatribuição automática | **Não implementada** — transferência manual pelo supervisor |

---

## Limite de atendimentos simultâneos

| Plano | `maxConcurrentChatsPerAgent` (catálogo) |
|-------|----------------------------------------|
| trial / free | 1 |
| starter | 3 |
| pro | 5 |
| enterprise | 10 |

- Campo em `config/plans.json` + `PlanCommercialLimits`.
- Resolução: `resolveMaxConcurrentChatsForPlan(planId, settingsValue)` — `min(configurado, teto do plano)`.
- Enforcement: `pickNextRoundRobinUser`, `processBusySuggestedPriority`, `assertCanTakeQueueConversation`.
- Contagem: `countAgentActiveChats` — Inbox `in_progress` + WebChat `with_agent` + bridge WA.

---

## Correções ou ajustes aplicados

1. `agent-availability.ts` — helpers de elegibilidade e teto por plano.
2. `inbox-agent-presence-api.ts` — mensagem supervisor + `filterHeartbeatOperationalStatus`.
3. `inbox-agent-presence.ts` — auto-ausente não sobrescreve ocupado; `preferOnlineCandidates` seguro.
4. `InboxService` — `resolveMaxConcurrentForClient`, `notifyAgentWentOffline`.
5. `DashboardService` — capabilities no socket + filtro heartbeat + alerta offline.
6. `config/plans.json` — `maxConcurrentChatsPerAgent` por plano.
7. `panel-events.ts` — tipo `inbox:agent_offline_risk`.

---

## Testes criados ou atualizados

| Arquivo | Cenários |
|---------|----------|
| `agent-availability.test.ts` | Plano, presença, auto-ausente |
| `inbox-agent-presence-api.test.ts` | supervisor_online RBAC |
| `inbox-agent-presence.test.ts` | + ocupado vs auto-ausente; preferOnline vazio |
| `plan-config.test.ts` | Limites simultâneos por plano |

**Total:** 602 testes passando.

---

## Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test` | Verde (602) |
| `npm run qa:atendimento:gate` | Verde |
| Frontend build | Não executado (sem alteração frontend) |

---

## Arquivos alterados

- `src/services/inbox/agent-availability.ts` (novo)
- `src/services/inbox/__tests__/agent-availability.test.ts` (novo)
- `src/services/inbox/__tests__/inbox-agent-presence-api.test.ts` (novo)
- `src/services/inbox/inbox-agent-presence.ts`
- `src/services/inbox/inbox-agent-presence-api.ts`
- `src/services/inbox/InboxService.ts`
- `src/services/web-dashboard/DashboardService.ts`
- `src/types/panel-events.ts`
- `config/plans.json`
- `src/services/billing/plan-config.ts`
- `src/services/billing/__tests__/plan-config.test.ts`
- `src/services/inbox/__tests__/inbox-agent-presence.test.ts`
- `docs/top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md` (novo)
- `docs/INBOX-ATENDIMENTO.md`
- `docs/CHANGELOG.md`, `docs/SISTEMA-REGISTRO.md`, `docs/INDICE-DOCUMENTACAO.md`
- `package.json`, `README.md`

---

## Riscos reduzidos

- Atendente indisponível não recebe fila via fallback de candidatos.
- Atendente comum não pode forjar `supervisor_online` via socket.
- Limite simultâneo respeita teto do plano.
- Supervisor alertado quando atendente desconecta com chat ativo.
- Auto-ausente não quebra status manual ocupado/supervisor.

---

## Riscos restantes

- Presença in-memory (não sobrevive restart do servidor).
- Reatribuição automática de chats ativos não implementada.
- UI não exibe contador de chats simultâneos vs limite.
- Posição na fila WebChat só quando cálculo seguro já existia.

---

## Decisões pendentes para Benhur

1. Persistir presença em Redis para multi-instância?
2. Reatribuição automática ao ficar offline — quando implementar?
3. Mostrar na UI “2/5 atendimentos simultâneos”?
4. Bloquear resposta em chat ativo quando `offline` (hard block)?

---

## Próximo passo recomendado

**TOP 06 — Modos de atendimento** (robotic, basic_triage, premium, híbrido) com gates de produto e validação E2E, usando presença/fila desta etapa como base.
