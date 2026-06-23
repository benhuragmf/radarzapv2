# RadarZap — Changelog

Registro append-only de entregas versionadas. Protocolo: [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md).

Espelho resumido: [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md).

---

---

## [2.11.60] — 2026-06-23

### Fix — Preview Leads embed vazio

- `form.js`: fallback quando `document.currentScript` é null (script injetado dinamicamente na preview).
- Preview dev auto-carrega formulário ativo via `GET /api/leads/dev/preview-config` (sem `?key=` na URL).

## [2.11.59] — 2026-06-23

### QA — Preview embed Leads + setup script

- `GET /leads/preview.html?key=lfm_…` — página de teste para QA § B.1.
- `npm run qa:leads:setup` — garante formulário ativo, `localhost` em `allowedDomains`, imprime URL.
- `qa:prep` lista formulários Leads ativos.

## [2.11.58] — 2026-06-22

### Feat — Lead → Inbox em um clique

- `POST /api/leads/captures/:id/open-inbox` (`inbox:reply`): cria ou reutiliza conversa, mensagem de sistema com dados do formulário, atribui ao atendente.
- Campo `inboxConversationId` em `LeadCapture`; botões **Iniciar atendimento** / **Continuar no Inbox** na UI Leads.
- `InboxService.openConversationFromLead`; E2E mock da rota.

## [2.11.57] — 2026-06-22

### Feat — Formulário público de Leads + fila por capacidade do atendente

- **Leads:** modelos `LeadForm` / `LeadCapture`, API pública `/api/leads/public`, embed `/leads/form.js`, menu **Contatos → Leads** (`/platform/leads`).
- Captura cria/atualiza `Destination` + segmento Lead (`ContactAutoSegmentService.tagLeadFromForm`).
- **Fila:** `maxConcurrentChatsPerAgent` (padrão 1), round-robin ignora atendentes no limite (Inbox + WebChat + bridge WA), mensagem com posição na fila, scan `processBusySuggestedPriority`.
- E2E mock `/platform/leads`; deep link `?search=` no Inbox; ação **Abrir Inbox** no detalhe do lead.

---

## [2.11.56] — 2026-06-22

### Fix — loop infinito presença no painel

- **Maximum update depth:** callbacks de presença em `actionsRef`; `setPresenceLocal` e sync `/inbox/presence/me` só atualizam quando o valor muda.
- **Build QA:** `CardTitle` aceita `className` (corrige `TeamMembers` / `qa:fase1:e2e`).
- **E2E local:** Playwright limita workers paralelos fora do CI (evita timeout no preview :4174).

---

## [2.11.55] — 2026-06-22

### Fix — bridge WA→WebChat com delay curto

- Respostas via bridge WhatsApp usam humanização **reduzida** (~0,35–1,1s) em vez de zero ou o delay do painel (1,5–10s).
- Painel continua com delay completo para parecer digitação natural no widget.

---

## [2.11.54] — 2026-06-22

### Fix — bridge WA → WebChat instantâneo

- Respostas do atendente via **bridge WhatsApp** (`!assumir`) usam delay curto (~0,35–1,1s) antes de aparecer no widget — não o delay longo do painel (1,5–10s).
- Sincronização do comentário no ticket roda em background para não bloquear a entrega da mensagem.

---

## [2.11.53] — 2026-06-22

### Fix — presença atendentes + fallback WA rotativo

- **Presença:** heartbeat inicial não rebaixa mais atendentes para `offline` (socket ativo → `online` no supervisor e round-robin).
- **Fallback WebChat:** alerta WhatsApp **um atendente por vez** (WA verificado na equipe); sem `!assumir` no timeout → próximo; esgotados → telefones manuais em `whatsappFallbackAlertPhones`.
- Escalação sem ninguém online no painel dispara alerta imediato ao 1º atendente com WA.

---

## [2.11.52] — 2026-06-22

### Fix — OTP WhatsApp perfil

- OTP de confirmação usa `sendOperationalTextMessage` — **não exige** número em Contatos/consentimento.
- Resolve variantes BR (9º dígito) via `onWhatsApp` antes do envio.

## [2.11.51] — 2026-06-22

### Fix — Meu perfil

- **Fix:** `/settings#perfil` travava em "Carregando perfil…" — frontend chamava `/api/auth/me/*` mas rotas estão em `/auth/me/*`; `sessionApi` no painel.

## [2.11.50] — 2026-06-22

### Equipe / Perfil — política e confirmações

- Dono define se atendentes **podem editar** dados em Meu perfil (`teamSettings.allowMembersEditOwnProfile`; padrão: bloqueado).
- Empresa cadastra nome, e-mail e WhatsApp; atendente **sempre confirma** e-mail (OTP) e WhatsApp (OTP), mesmo com edição bloqueada.
- Login **Google** dispensa confirmação de e-mail (já verificado pelo OAuth).
- API: `GET/PATCH /organization/team-settings`, `PATCH /team/members/:id/profile`, `POST /auth/me/email/*`.

## [2.11.49] — 2026-06-22

### Equipe / Perfil — verificação WhatsApp

- Dono/admin **pode** cadastrar WhatsApp do membro na equipe, mas o número **só é salvo após OTP** enviado ao próprio número.
- Membro também confirma em **Meu perfil** com o mesmo fluxo de código de segurança.
- Quando admin inicia o cadastro, o **dono da empresa** recebe aviso de auditoria no WhatsApp verificado dele.
- API: `POST /team/members/:id/whatsapp/request-code`, `…/confirm`, `DELETE …/whatsapp`.

## [2.11.48] — 2026-06-22

### Equipe / Perfil / Inbox

- WhatsApp pessoal: só o próprio membro cadastra com **código OTP** enviado no WA da empresa (`/auth/me/whatsapp/*`).
- Admin não edita mais telefone no modal de papel — `/settings#perfil` + link no header.
- Atendente sem setor atribuído **não vê** filas abertas — só conversas atribuídas a ele (WA + WebChat).

## [2.11.47] — 2026-06-22

### Painel / Notificações

- Notificações do sino **persistidas no Redis** — sobrevivem ao F5 (últimos 80 eventos / 14 dias).
- API: `GET /panel/notifications`, `POST …/read`, `POST …/read-all`, `POST …/ingest` (WA client).
- Página **Ver todas**: `/dashboard/notificacoes` + link no balão do sino.

## [2.11.46] — 2026-06-22

### WhatsApp / Sessões

- **Fix:** erro 440 (conexão substituída) — bloqueia auto-reconnect em loop; exige connect manual.
- **Fix:** dev lock mata processo órfão no hot-reload (ts-node-dev) antes de restaurar WA — causa raiz do 440 em dev.
- **Fix:** **Novo QR** usa `refreshQr` (reinicia socket sem apagar credenciais) em vez de `forceQr`.

## [2.11.45] — 2026-06-22

### WhatsApp / Sessões

- **Fix:** deadlock após escanear QR (código 515 `restartRequired`) — `sessionCreatePromises` impedia nova socket.
- **Fix:** reconexão agendada não bloqueia mais pedido explícito de connect; timers cancelados no `abort`.
- **Fix:** cooldowns de reconexão excessivos revertidos (2s→30s exponencial); auto-reconnect 60s.
- **Fix:** botão **Novo QR** envia `forceQr: true` para gerar QR fresco.

## [2.11.44] — 2026-06-22

### Inbox / Supervisão

- Chat interno: menção `@supervisor` dispara notificação no sino (`inbox:supervisor_help`) para quem tem `inbox:supervise`.
- Dashboard supervisor: card **Pedidos de ajuda**, badge nas conversas ativas e preview da mensagem interna.

---

## [2.11.43] — 2026-06-22

### Estabilidade WhatsApp

- Fix loop conectar/desconectar: `connectInstance` idempotente (não aborta sessão ativa); uma promise por `createWhatsAppSession` (evita erro 440 / ban).
- Reconexão automática: cooldown 30–120s, máx. 5 tentativas; auto-reconnect a cada 5 min via `restoreSession` (sem `abort`).
- Eventos painel: remove pub/sub duplicado; alertas WA com debounce 60s; erro 440 orienta reconexão manual.
- Dev: `ts-node-dev` ignora `sessions/`, `data/`, `test-results/` (Baileys gravava creds e reiniciava o backend em loop).

---

## [2.11.42] — 2026-06-22

### Equipe

- Fix convite de membro: índice `companyMembers` permite vários convites pendentes por empresa (partial `userId`).
- Convite vincula conta existente imediatamente (`linkedAccount`); login Google associa todos os convites pendentes do e-mail (multi-empresa).

---

## [2.11.41] — 2026-06-22

### Testes

- E2E presença operacional: `e2e/qa-fase1-presence.spec.ts` (seletor status + PATCH).
- Script `npm run qa:fase1:all` (Playwright + gate Jest); `qa:fase1:e2e` faz build do frontend antes do preview.
- Fix `InboxSectors.tsx`: `useMemo` antes do guard `canManage` (violação Rules of Hooks quebrava página após `auth/me` async).
- Docs QA: `QA-FASE1-RAPIDO.md`, `QA-FASE1-CHECKLIST.md` atualizados (§ B coberto por E2E mock).

---

## [2.11.40] — 2026-06-22

### Testes

- E2E Playwright § B painel: `e2e/qa-fase1-panel.spec.ts` (tickets, setores, bot, respostas, relatórios, webchat) — `npm run qa:fase1:e2e` (32 testes).
- Fix mock `webchat/stats` no fixture E2E (rota única `/api/webchat/**`).

---

## [2.11.39] — 2026-06-22

### Documentação

- Arquivados em `docs/concluidos/`: `ENTREGA-ATENDIMENTO-2.11.24-28.md`, `ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`; links atualizados em todo o repo.

---

## [2.11.38] — 2026-06-22

### Corrigido

- CI: `npm audit` — override `undici@6.27.0` (vulnerabilidade high via `discord.js`).

---

## [2.11.37] — 2026-06-22

### Corrigido

- E2E Supervisor: seletor strict mode para métrica «Em atendimento» (`inbox-authenticated.spec.ts`).

### Documentação

- `INDICE-DOCUMENTACAO.md` § QA; `SISTEMA-REGISTRO.md` 2.11.36; `qa-prep` aponta KICKOFF.

---

## [2.11.36] — 2026-06-22

### Corrigido

- Build TypeScript: import `CampaignDispatchService` / `CampaignPriority` em `DashboardService.ts`.

### Documentação

- `QA-FASE1-KICKOFF.md` — ponto de partida gate humano; checklist/ROADMAP sincronizados (2.11.35).

---

## [2.11.35] — 2026-06-22

### Adicionado

- Testes integrados `inbox-inbound-order.integration.test.ts` — ordem ticket → consent → inbox (espelho `WhatsAppService`), CSAT antes de ticket/inbox, complemento ticket, consent bloqueia inbox.

---

## [2.11.34] — 2026-06-22

### Adicionado

- Audit log append-only `AttendanceEvent` para ticket: `ticket.created`, `ticket.client_replied`, `ticket.closed` em `InboxService` (meta sem corpo de mensagem).
- Testes `attendance-audit.service.test.ts` e `inbox-ticket-audit.integration.test.ts` no gate.

---

## [2.11.33] — 2026-06-22

### Adicionado

- Webhooks outbound: `ticket.created`, `ticket.client_replied`, `ticket.closed`, `webchat.bridge.started`, `webchat.bridge.closed` — em `InboxService`, `webchat-whatsapp-bridge.service.ts`, catálogo `WEBHOOK_EVENTS` e UI Webhooks.
- Testes `webhook-events.test.ts` e `webchat-bridge-webhook.test.ts` no gate `qa:atendimento:gate`.
- Doc `WEBHOOKS.md` § payloads ticket/bridge.

---

## [2.11.32] — 2026-06-22

### Adicionado

- E2E Playwright autenticado (mock API): `e2e/inbox-authenticated.spec.ts` — Inbox (lista, fila, thread, Assumir, banner WebChat) + Supervisor (métricas, abas fila/atendimento).
- Fixture `e2e/fixtures/mock-inbox-api.ts` — mock `/auth/me` + APIs Inbox/Supervisor/presença.

---

## [2.11.31] — 2026-06-22

### Adicionado

- Testes integrados `inbox-ticket-inbound.integration.test.ts` — `handleTicketInboundMessage`: novo atendimento, janela 12h, expires inflado, competição fila, CSAT primeiro.

---

## [2.11.30] — 2026-06-22

### Adicionado

- Testes integrados `inbox-csat-reply.integration.test.ts` — `tryHandleCsatReply` + ordem CSAT em `handleInboundMessage` (6 casos no gate).

---

## [2.11.29] — 2026-06-22

### Adicionado

- Testes `panel-critical-alerts.service.test.ts` — cota mensagens/IA, dedup, config fallback e IA sem chave.
- Gate `qa:atendimento:gate` inclui `panel-critical-alerts`.

---

## [2.11.28] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md).

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

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §3.

### Adicionado

- **Status operacional:** `online`, `ausente`, `ocupado`, `offline`, `supervisor_online` — seletor header, auto-ausente por inatividade, RR/fila por `availableForQueue`.
- API `GET/PATCH /inbox/presence/me`, `GET /inbox/presence/team`, `PATCH /inbox/presence/:userId`, `GET /inbox/presence/config`.
- Campo `presenceIdleTimeoutSeconds` (60–3600s, padrão 300); constantes `src/constants/agent-presence.ts`.
- Frontend: `agentPresenceContext`, `useAgentPresenceHeartbeat`, `AgentStatusSelector`.

---

## [2.11.24] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §2.

### Adicionado

- **Supervisão avançada:** `GET /inbox/supervisor/dashboard` — equipe, presença, conversas ativas WA+WebChat, fila unificada, métricas 7d (TMA, puxar fila, CSAT).
- `InboxSupervisorDashboardService`, tipos `inbox-supervisor.ts`, `SupervisorMonitorDrawer`.
- Reassign supervisor inclui IDs `wc:`.

---

## [2.11.16] — 2026-06-21

### Adicionado / corrigido

- Auditoria completa reescrita: [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) (revisão 2, evidências no código).
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

- Consolidação rascunhos GG → `PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`, [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md), `RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`.
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
