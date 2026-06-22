# RadarZap — Changelog

Registro append-only de entregas versionadas. Protocolo: [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md).

Espelho resumido: [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md).

---

## [2.11.28] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./ENTREGA-ATENDIMENTO-2.11.24-28.md).

### Adicionado

- **Fallback WhatsApp deferido:** campo `whatsappFallbackAcceptTimeoutSeconds` (30–900s, padrão 60); após escala na fila aguarda aceite no painel; scan ~60s (`processWebChatFallbackAcceptTimeouts`); evento `webchat:fallback_missed` (urgente, `targetUserId`).
- **Notificações críticas (sino vermelho):** `src/types/panel-events.ts` + `PanelCriticalAlertsService` — plano, cota IA/mensagens, config incompleta; urgentes operacionais: `whatsapp:disconnected`, `inbox:queue_sla`, `inbox:ticket_sla`.
- Eventos `billing:*`, `ai:quota_*`, `system:critical_config` — `ownerOnly` (`billing:view`).

### Corrigido

- **WebChat IA Básica:** `WebChatBasicTriageService` / `isBasicTriageMode` — não cai no menu robotizado na 1ª mensagem.
- **Fallback com atendente online:** presença por heartbeat (`availableForQueue`); fallback removido de `escalateToQueue` imediato.
- **Testes:** mock `whatsapp-send-policy` em `WhatsAppService.test.ts`.

---

## [2.11.25] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./ENTREGA-ATENDIMENTO-2.11.24-28.md) §3.

### Adicionado

- **Status operacional:** `online`, `ausente`, `ocupado`, `offline`, `supervisor_online` — seletor header, auto-ausente por inatividade, RR/fila por `availableForQueue`.
- API `GET/PATCH /inbox/presence/me`, `GET /inbox/presence/team`, `PATCH /inbox/presence/:userId`, `GET /inbox/presence/config`.
- Campo `presenceIdleTimeoutSeconds` (60–3600s, padrão 300); constantes `src/constants/agent-presence.ts`.
- Frontend: `agentPresenceContext`, `useAgentPresenceHeartbeat`, `AgentStatusSelector`.

---

## [2.11.24] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./ENTREGA-ATENDIMENTO-2.11.24-28.md) §2.

### Adicionado

- **Supervisão avançada:** `GET /inbox/supervisor/dashboard` — equipe, presença, conversas ativas WA+WebChat, fila unificada, métricas 7d (TMA, puxar fila, CSAT).
- `InboxSupervisorDashboardService`, tipos `inbox-supervisor.ts`, `SupervisorMonitorDrawer`.
- Reassign supervisor inclui IDs `wc:`.

---

## [2.11.16] — 2026-06-21

### Adicionado / corrigido

- Auditoria completa reescrita: [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) (revisão 2, evidências no código).
- Script `npm run qa:atendimento:gate` — jest atendimento crítico + `qa:webchat-wa`.
- Anti-loop alerta fallback WebChat: ignora telefones que coincidem com sessão Baileys (`filterFallbackAlertPhones`).

---

## [2.11.15] — 2026-06-21

### Documentação

- Pasta [`concluidos/`](./concluidos/README.md) — 12 entregas finalizadas arquivadas (fases modos 1–8, FAQ WA, upgrade Inbox, audit menus).
- Links atualizados em índice, consolidado, CHANGELOG e protocolo de versionamento.

---

## [2.11.14] — 2026-06-21

### Documentação

- Consolidação rascunhos GG → `PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`, `ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`, `RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`.
- `TICKET-ATENDIMENTO.md` § mensagens visíveis vs `!nota` interna.
- `INDICE-DOCUMENTACAO.md` atualizado.

---

## [2.11.13] — 2026-06-21

### Adicionado

- Chamado WebChat: mensagens ao cliente (`comments`) publicadas no chat e consulta TK+token; `!nota` e notas internas só equipe.
- Bridge WA `TK-…` sincroniza `comments`; visitante sincroniza `clientReplies`.

---

## [2.11.11] — 2026-06-21

### Corrigido

- Consulta pública: oculta intake/bridge; rejeita assunto placeholder do alerta WA `!abrir`.

---

## [2.11.10] — 2026-06-21

### Corrigido

- Atualização de chamado WebChat enviada ao visitante (não WhatsApp); consulta TK+token prioriza token e ampliada.

---

## [2.11.9] — 2026-06-19

### Adicionado / alterado

- Menu `!ajuda` reorganizado por seções (atendimento, consulta, encerrar).
- **`!abertos`** / **`!meus`** — listar chamados abertos ou atribuídos ao atendente.
- **`!nota TK-…`** — nota interna no chamado.
- **`!abrir TK-… motivo`** — texto após a referência vira assunto + nota interna (@setores); visitante só recebe token.

---

## [2.11.8] — 2026-06-19

### Adicionado

- Comando WhatsApp **`!abrir TK-XXXX`** (alias `!abrirchamado`) — abre chamado formal no chat do site e envia token ao visitante (paridade com painel Inbox).
- Alerta fallback WA e `!ajuda` atualizados com `!abrir`.

---

## [2.11.7] — 2026-06-19

### Corrigido

- **`!assumir`** no WebChat volta a **não abrir chamado** — só assume conversa + bridge WhatsApp.
- Abertura formal + token ao visitante permanecem só em **Inbox → Abrir chamado** (ou IA quando configurada).
- **`!token`** exige chamado já aberto no painel.

---

## [2.11.6] — 2026-06-19

### Corrigido (revertido em 2.11.7)

- ~~`!assumir` abria chamado automaticamente~~ — comportamento incorreto para o produto.

---

## [2.11.5] — 2026-06-19

### Adicionado / alterado

- **WebChat painel:** editor guiado (navegação lateral, simples/avançado, visão geral, barra de salvar, duplicar widget).
- **Preview:** `livePreviewTemplateId`, prévia interativa Chat Box, fixes overlay e sessão local.
- **Widget/API:** `previewTemplateId` na config pública; localhost liberado em dev; notas de contato truncadas (2000 chars).

### Documentação

- `docs/WEBCHAT.md` — seção contrato painel ↔ widget (2.10.100–2.10.105).

---

## [2.11.4] — 2026-06-19

### Adicionado

- **Fase 8:** E2E Playwright autenticado (mock API) dos 4 modos em `/platform/inbox/ia`.
- Fixtures `e2e/fixtures/mock-panel-api.ts` + spec `e2e/attendance-modes.spec.ts`.
- `data-testid` nos cards de `AttendanceModePicker`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-8.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-8.md)

---

## [2.11.3] — 2026-06-19

### Adicionado

- **Fase 7:** campo `usageKind` em `AiUsage` — contadores Premium vs IA Básica (LLM fallback).
- `GET /platform/ai/usage` retorna `totals.byKind` e linhas tipadas.
- UI Logs: breakdown por modo + tabela de chamadas; Geral mostra uso diário por modo.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-7.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-7.md)

---

## [2.11.2] — 2026-06-19

### Alterado

- **Fase 6:** WebChat alinhado ao modo global — IA Premium conversacional só com `premium_assistant` + toggle do widget.
- `GET /webchat/ai-status` retorna `attendanceMode`, `premiumAiAllowed`, `globalModeHint`.
- UI WebChat: checkbox renomeado; desabilitado fora de Premium.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-6.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-6.md)

---

## [2.11.1] — 2026-06-19

### Adicionado

- **IA Básica (Fase 5):** modo `basic_triage` com classificador local, auto-resolve KB/skills, encaminhamento por setor (WA + WebChat).
- `AiBasicTriageService`, `WebChatBasicTriageService`, `basic-triage-classifier.ts`.
- Campo `basicTriageLlmFallbackEnabled` em `AiPrompt` — LLM RadarZap opcional em ambiguidade.
- `AiProviderService.completeForBasicTriage()` — fallback econômico.

### Alterado

- UI `/platform/inbox/ia`: card IA Básica habilitado; banner e toggle LLM fallback.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md)
- Consolidado modos atualizado para `2.11.1`.

---

## [2.11.0] — 2026-06-19

### Adicionado

- **Governança:** protocolo oficial de versionamento e documentação em `.md` ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).
- **Índice:** [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) com mapa de todos os docs relevantes.
- **Modos de atendimento (baseline minor):** Fases 1–4 agrupadas sob versão de produto `2.11.0`.

### Documentação

- Consolidado modos: [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md).
- Análise: [`ANALISE-MODOS-ATENDIMENTO.md`](./concluidos/ANALISE-MODOS-ATENDIMENTO.md).
- Fases: [`PHASE-1`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-1.md), [`PHASE-3`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-3.md), [`PHASE-4`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-4.md).
- [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) sincronizado até `2.11.0`.

**Commits:** `171b078`, `f899af0`, `b240284`, `2cc2b2a`

---

## [2.10.108] — 2026-06-19

### Adicionado

- WebChat: menu robotizado quando `AiSettings.attendanceMode === robotic` (`WebChatRoboticTriageService`, reusa `inbox-triage.ts`).

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-4.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-4.md)

**Commit:** `f899af0`

---

## [2.10.107] — 2026-06-19

### Adicionado

- Campo `attendanceMode` em `AiSettings` (Mongo) com backfill lazy.
- API `GET/PATCH /platform/ai/settings` inclui `settings.attendanceMode`.
- `isAiActive()` exige `premium_assistant`; helper `shouldRunGenerativeAi()`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-3.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-3.md)

**Commit:** `b240284`

---

## [2.10.106] — 2026-06-19

### Adicionado

- Tipos e adapter `src/types/attendance-mode.ts` (modo × provedor legado).
- UI `/platform/inbox/ia`: 4 cards de modo + seção Provedor da IA.
- Componentes `AttendanceModePicker`, `lib/attendanceMode.ts`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-1.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-1.md)
- [`ANALISE-MODOS-ATENDIMENTO.md`](./concluidos/ANALISE-MODOS-ATENDIMENTO.md)

**Commit:** `2cc2b2a`

---

## Entregas anteriores

Ver changelog completo em [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) (versões `2.0.0` – `2.10.105` e demais patches WebChat/Inbox).

---

## Próxima entrada (template)

```markdown
## [2.11.x] — YYYY-MM-DD

### Adicionado / Alterado / Corrigido
- …

### Documentação
- …

**Commit:** `…`
```
