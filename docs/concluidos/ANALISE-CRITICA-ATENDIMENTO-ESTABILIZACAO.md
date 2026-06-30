# Radar Chat — Análise crítica de atendimento e estabilização

**Versão analisada:** `2.11.16`  
**Data da auditoria:** 2026-06-21  
**Revisão:** 2 (auditoria com evidência no código — substitui rascunho GG)  
**Status:** Estabilização — **não go-live**  
**Escopo:** WhatsApp, Inbox, Ticket, CSAT, IA, WebChat, Bridge WA, QA, rate limit, produção

**Plano de aplicação:** [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md)

> **Atualização código (2026-06-21):** desde a auditoria **2.11.16**, o repositório entregou **2.11.17–2.11.28** (rate limit WA, saúde atendimento, supervisão, presença operacional, fallback deferido, sino vermelho alertas críticos, fix IA Básica WebChat). Este documento permanece como **snapshot da revisão 2**; lacunas abaixo marcadas 🔴/🟡 devem ser lidas junto com [`CHANGELOG.md`](./CHANGELOG.md) e [`INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md). **QA manual §10 continua pendente** — não substitui gate automático.

| Entrega | Versão | Impacto na análise |
|---------|--------|-------------------|
| Rate limit 2/10/min + jitter | 2.11.17 | Item P1 rate limit — ✅ implementado |
| `GET /platform/health/atendimento` | 2.11.17 | Observabilidade P2 — ✅ |
| Supervisão dashboard/monitor | 2.11.24 | Lacuna supervisão — ✅ código |
| Presença operacional + RR | 2.11.25 | Presença heartbeat-only — ✅ evoluído |
| Fallback deferido + `webchat:fallback_missed` | 2.11.28 | Fallback imediato com online — ✅ corrigido |
| Alertas críticos (`billing:*`, `ai:quota_*`, config) | 2.11.28 | Notificações plano/cota — ✅ painel |
| Testes unitários | 2.11.28 | 463 testes + `qa:atendimento:gate` verde | Gate automático ✅; integração InboxService ⏳ |

---

## 1. Resumo executivo

O Radar Chat v2 tem **superfície ampla implementada** (painel, Inbox, tickets, WebChat, bridge WhatsApp, IA, modos de atendimento Fases 1–8, API, webhooks). Correções **2.11.10–2.11.13** endereçaram chamado WebChat (mensagem ao cliente vs `!nota`, consulta TK+token).

**Conclusão honesta:** o **código** dos fluxos críticos existe e há **testes unitários** em helpers (CSAT, routing ticket, janela 12h, comandos WA, consulta pública). Falta **validação integrada** em `InboxService` (~4.8k linhas) e **QA manual Fase 1** completo. **Produção/VPS permanece bloqueada** até gate em [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md).

**Entrega desta revisão (2.11.16):**

- Documento reescrito com evidências de código.
- Script `npm run qa:atendimento:gate` (testes críticos + `qa:webchat-wa`).
- Fix seguro: filtro anti-loop alerta fallback quando telefone = sessão Baileys (`filterFallbackAlertPhones`).

---

## 2. Fontes analisadas

### Documentação (lida)

| # | Documento | Uso |
|---|-----------|-----|
| 1–10 | `INDICE`, `CHANGELOG`, `SISTEMA-REGISTRO`, `VERSIONAMENTO`, `ROADMAP`, `INBOX`, `TICKET`, `WEBCHAT`, `WEBHOOKS`, `RADARCHAT-MODOS-…` | Governança + comportamento |
| 11–13 | `concluidos/RADARCHAT-ATTENDANCE-MODES-PHASE-{1,3,4}.md` | Histórico modos |
| 14–17 | `QA-FASE1-*`, `QA-WEBCHAT-WA-*` | Roteiros manuais |
| 18–19 | `concluidos/RADARCHAT_WHATSAPP_TICKET_FAQ_*` | FAQ/bridge entregue 2.10.75 |
| 20–26 | `concluidos/radarchat-inbox-upgrade`, `MENU-PAGES-REGISTRY`, `EQUIPE-RBAC`, `DESIGN-SYSTEM`, migração, `PREPARACAO`, `PRODUCTION` | Referência |

### Código inspecionado (2026-06-21)

| Área | Arquivos principais |
|------|---------------------|
| Ordem inbound WA | `WhatsAppService.ts` L2475–2562 |
| Ticket inbound | `InboxService.ts` L892–1030, `inbound-routing.ts` |
| Inbox inbound | `InboxService.ts` L1744–1820 |
| CSAT | `csat.util.ts`, `InboxService.tryHandleCsatReply` L4150+ |
| Consent vs ticket | `ConsentService.shouldDeferToConsentFlow` L202–207 |
| `sair` ticket vs LGPD | `inbox-ticket.ts` L28–38 |
| Bridge WA↔WebChat | `webchat-whatsapp-bridge.service.ts`, `whatsapp-agent-command.service.ts` |
| Fallback alerta | `webchat-whatsapp-fallback.service.ts` |
| Rate limit WA | `RateLimiter.ts` L158–172, `WhatsAppService.ts` L2754+ |
| Presença agente | `DashboardService.ts` (socket `agent:heartbeat`), `useAgentPresenceHeartbeat.ts` |
| IA Básica | `webchat-basic-triage.service.ts`, `attendance-mode.ts` |
| Webhooks | `WEBHOOKS.md`, `WebhookDispatcherService` (via docs + grep eventos) |
| Testes | `__tests__/inbound-routing`, `csat.util`, `inbox-csat-gate`, `ticket-reply-window`, `ticket-public-access`, `whatsapp-agent`, `webchat-whatsapp-fallback` |

---

## 3. Estado atual do sistema

| Módulo | Situação | Evidência |
|--------|----------|-----------|
| Ordem inbound WA | 🟡 | Comandos `!` → bridge → ticket → consent → inbox (`WhatsAppService.ts`) |
| Ticket routing | 🟡 | `evaluateTicketInboundRouting` + unit tests; sem teste integrado InboxService |
| CSAT | 🟡 | `tryHandleCsatReply` + `shouldBypassCsatForNewService`; QA manual pendente |
| IA escalação | 🟡 | Fix 2.8.7 documentado; validar QA cenário 9 |
| Ticket WebChat + token | 🟢 | 2.10.70+ ; visibilidade cliente 2.11.13 |
| Bridge WA ↔ WebChat | 🟡 | Código completo; anti-loop alerta **2.11.16** |
| Modos atendimento 1–8 | 🟢 | Consolidado + fases em `concluidos/` |
| IA Básica (`basic_triage`) | 🟢 | **Implementada 2.11.1** — `webchat-basic-triage.service.ts` |
| Rate limit WA unificado 2/10 | 🔴 | Bucket genérico `RATE_LIMIT_MESSAGES_PER_MINUTE` (default **20/min**) — não separa marketing vs conversa |
| Audit log Ticket/Bridge | 🔴 | Não persistido |
| PILOT_MODE | 🔴 | Não existe |
| Produção / VPS | 🔴 | Gate Fase 1 não verde |

---

## 4. Bloqueadores críticos

| # | Item | Ação | Status |
|---|------|------|--------|
| B1 | QA manual § A WhatsApp incompleto | `QA-FASE1-CHECKLIST.md` + registrar em `QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md` | 🔴 |
| B2 | Sem teste integrado ordem inbound em `InboxService` | ✅ `inbox-inbound-order` (2.11.35) | 🟢 |
| B3 | Gate estabilização ROADMAP não marcado | Repetir QA até verde | 🔴 |
| B4 | Rate limit 2/min marketing + 10/min conversa + prioridade | Fase B — ver §8 | ⏳ |

---

## 5. Riscos altos

| # | Risco | Mitigação | Verificado no código |
|---|-------|-----------|----------------------|
| R1 | Ticket antigo captura mensagem | `inbound-routing.ts` `release_inbox` + `findTicketForClientReply` | 🟡 unit OK, QA cenário 7 pendente |
| R2 | CSAT pendente bloqueia novo atendimento | `shouldBypassCsatForNewService` + clear `csatPending` | 🟡 unit OK (`inbox-csat-gate.test.ts`) |
| R3 | Loop alerta = sessão WA | `filterFallbackAlertPhones` **2.11.16** | 🟢 implementado |
| R4 | Comando `!` vaza ao visitante | Bridge: `trimmed.startsWith('!') return false` L142 | 🟢 |
| R5 | `!encerrarchat` vs status ticket | Doc comando em `whatsapp-agent-command.service.ts`; chat encerra, ticket pode ficar aberto | 🟡 regra produto |
| R6 | Marketing + atendimento mesma sessão | Rate limit único — sem prioridade | 🔴 Fase B |

---

## 6. Riscos médios

- `InboxService.ts` ~4.8k linhas — refatorar só com cobertura.
- Lint ~7k issues — estratégia: lint só em arquivos alterados (`package.json` `lint` já restrito).
- OTP token reenvio in-memory em auditoria incremental — inviável em múltiplas instâncias (Fase 3 infra).
- Observabilidade limitada — sem endpoint `health/atendimento` ainda.
- WebChat robotizado mais fraco que WA (doc modos).

### 6.1 Melhorias obrigatórias antes de piloto

| # | Melhoria | Fase |
|---|----------|------|
| O1 | Executar QA Fase 1 completo (§ A + § C WebChat) | A |
| O2 | `npm run qa:atendimento:gate` verde antes de cada release atendimento | A |
| O3 | Rate limit WA por tipo (marketing vs conversa) + jitter | B |
| O4 | Audit log append-only Ticket/Bridge | B |
| O5 | Documentar operação bridge: celular **pessoal** do atendente, não número da sessão | A/B |
| O6 | Testes integrados mínimos ordem inbound | ✅ 2.11.35 |

### 6.2 Melhorias futuras (produto — Fase D+)

Ver [`RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md): CRM leve, gatilhos WebChat (preço, UTM, exit), templates por segmento, wizard onboarding, relatórios conversão.

**Não iniciar** antes do gate § Estabilização.

---

## 7. Verificação: celular próprio conectado para atender WebChat pelo WhatsApp

### 7.1 Como funciona hoje

**FUNCIONA PARCIALMENTE** (confirmado no código)

1. **Alerta sem atendente online:** `handleWebChatNoAgentOnline` → `sendInternalAlert` para `whatsappFallbackAlertPhones` (`webchat-whatsapp-fallback.service.ts`).
2. **Atendente assume:** `!assumir` → `activateWhatsappBridge` (`webchat-whatsapp-bridge.service.ts` L20–46).
3. **Visitante → WA:** `forwardVisitorMessageToWhatsappBridge` → `sendWhatsappInternalReply` para `CompanyMember.whatsappPhone`.
4. **WA → visitante:** `handleWhatsappBridgeAgentReply` → `sendAgentMessage` + `recordTicketClientVisibleCommentFromBridge` (L138–196).
5. **Comandos:** `whatsapp-agent-command.service.ts` — `!assumir`, `!abrir`, `!token`, `!nota`, `!encerrar`, `!encerrarchat`, `!ajuda`, `!abertos`, `!meus`.
6. **Auth:** `resolveAuthorizedWhatsappAgentFromContext` + `whatsappPhone` em `CompanyMember`.
7. **Presença online:** painel emite `agent:heartbeat` a cada 45s (`useAgentPresenceHeartbeat.ts`); servidor em `DashboardService.ts`.

**Recomendação operacional:** alertas para **celular pessoal** do atendente; bridge responde desse número. **Não** usar o mesmo número da sessão Baileys da empresa na whitelist de alertas.

### 7.2 Riscos de loop

| Risco | Antes 2.11.16 | Depois 2.11.16 |
|-------|---------------|----------------|
| Alerta enviado ao JID da própria sessão | Possível | `filterFallbackAlertPhones` + log `bridge:alert_skipped_same_session` |
| Resposta bridge reentra como comando | Não — mensagens bridge não começam com `!` | 🟢 |
| Alerta re-dispara inbound como cliente | Possível se sessão recebe alerta | Mitigado se O5 seguido + filtro |

### 7.3 Separação de números

| Papel | Origem no código |
|-------|------------------|
| Cliente final | JID inbound / visitante WebChat |
| Sessão empresa | Baileys `sessions.get(clientId).user.id` |
| Atendente autorizado | `CompanyMember.whatsappPhone` |
| Alerta fallback | `InboxSettings.whatsappFallbackAlertPhones[]` |

### 7.4 Resultado da análise

**FUNCIONA PARCIALMENTE** — fluxo principal implementado; anti-loop alerta adicionado 2.11.16; **QA manual bridge ainda obrigatório**.

### 7.5 Correções recomendadas (restantes)

1. ~~Rejeitar telefone alerta = sessão~~ ✅ 2.11.16
2. Documentar em `WEBCHAT.md` § Bridge operacional (celular pessoal vs sessão) — Fase A doc
3. Validar `!encerrarchat` não fecha ticket inadvertidamente — QA manual

**Arquivos:** `webchat-whatsapp-fallback.service.ts`, `WhatsAppService.getConnectedSessionPhoneDigits`, `WEBCHAT.md`

---

## 8. Limites de mensagens por minuto e delay humanizado

### 8.1 Marketing / disparo / agendado

- **Desejado:** máx. **2 msg/min**, jitter ~30s, fila (não descartar).
- **Hoje (2.11.17):** bucket `marketing` em `checkWhatsAppSendLimit` — **2/min** + jitter 25–35s via `whatsapp-session-rate-limit.ts`. Campanhas e fila `send-message` com `ruleId` usam kind `marketing`.

### 8.2 Conversação IA / chat / humano

- **Desejado:** máx. **10 msg/min**, jitter ~6s mínimo.
- **Hoje (2.11.17):** bucket `conversation` — **10/min** + jitter 4–8s. Inbox reply (`inbox-reply`) deixou de usar `skipRateLimit`. `sendInternalAlert` continua fora do bucket (kind `alert`).

### 8.3 Prioridade entre filas

**Parcial.** Buckets Redis separados (`marketing` vs `conversation`) — conversa não consome tokens de marketing. Prioridade BullMQ campanha vs inbox ainda não unificada.

### 8.4 Jitter / delay variável

**Implementado (2.11.17)** em `computeSendJitterMs` antes do envio em `handleSendMessage`.

### 8.5 Arquivos

- `src/utils/whatsapp-session-rate-limit.ts` ✅
- `src/cache/RateLimiter.ts` — `checkWhatsAppSendLimit` ✅
- `src/services/whatsapp/WhatsAppService.ts` ✅

### 8.6 Testes

- Unit: `whatsapp-session-rate-limit.test.ts` ✅
- Integração: campanha + resposta humana simultânea — ⏳

---

## 9. Análise detalhada — WhatsApp Inbox × Ticket × CSAT × IA

### 9.1 Ordem inbound (confirmada)

Em `WhatsAppService.ts` (handler de mensagens):

1. Comandos `!` → `handleWhatsappAgentCommand`
2. Bridge agente → `handleWhatsappBridgeAgentReply` (ignora `!`)
3. Ticket → `handleTicketInboundMessage` (**antes** do consent/inbox)
4. Consent → `ConsentService.handleInboundMessage`
5. Inbox → `handleInboundMessage`

Dentro de `handleTicketInboundMessage`: consent defer → **CSAT** → ticket capture → `sair`/finalizar.

Dentro de `handleInboundMessage`: CSAT → criar/abrir conversa → triagem/bot/IA.

### 9.2 Ticket antigo vs novo atendimento

- `evaluateTicketInboundRouting` retorna `release_inbox` quando triagem ativa, `wantsNewInboundService`, ticket fechado fora 12h, menu inbox `1/2/3/4` em contexto triagem.
- `wantsNewInboundService` libera tickets e retorna ao inbox (`InboxService` L935–938).

### 9.3 CSAT

- `tryHandleCsatReply`: só atua se **sem** conversa aberta e **sem** triagem ativa.
- `shouldBypassCsatForNewService`: `Ola`, `gostaria de atendimento`, `falar com atendente`, etc. → limpa `csatPending` e deixa inbox seguir.
- `isCsatIntent('avaliar')` → **não** bypass (permanece CSAT).
- Notas `1`–`5` → gravam score + webhook `inbox.csat.rated`.

### 9.4 `sair` no ticket vs LGPD

- `parseTicketClientExit` (`inbox-ticket.ts`) — keyword **`sair`** = sair do **ticket**, documentado como ≠ opt-out LGPD.
- Ticket handler roda **antes** do consent flow genérico para evitar confusão (`InboxService` comentário L891).

### 9.5 IA escalação

- Documentado fix 2.8.7 — **validar QA** cenário “IA promete transferir”.
- Código IA: `AiTriageService`, `InboxService` escalação — não re-auditado linha a linha nesta rodada.

### 9.6 Janelas ticket (12h / 2h / 30min)

- Helpers em `ticket-reply-window.util.ts` + testes unitários ✅.
- `lastTeamMessageAt`, `clientReplyGraceUntil`, `clientReplyPaused` — ver `TICKET-ATENDIMENTO.md`.

---

## 10. QA manual — ver §28 (última etapa)

Checklists e roteiros permanecem válidos; **não executar antes** de concluir Fase B e gate automático verde. Detalhes consolidados em **§28**.

---

## 11. Testes automatizados — existentes e faltantes

| Fluxo | Arquivo teste | Status |
|-------|---------------|--------|
| CSAT bypass novo atendimento | `csat.util.test.ts`, `inbox-csat-gate.test.ts` | ✅ |
| Ticket janela 12h | `ticket-reply-window.util.test.ts` | ✅ |
| Routing ticket vs inbox | `inbound-routing.test.ts` | ✅ |
| Consulta TK+token | `ticket-public-access.service.test.ts` | ✅ |
| Comandos WA | `whatsapp-agent-command.util.test.ts` | ✅ |
| Anti-loop alerta | `webchat-whatsapp-fallback.service.test.ts` | ✅ 2.11.16 |
| Consent defer ticket | `consent-defer.test.ts` | ✅ |
| Ordem inbound **integrada** InboxService | — | ❌ |
| Bridge E2E WA real | — | ❌ manual |
| IA escalação pós-promessa | — | ❌ |

---

## 12. Observabilidade e saúde do atendimento

**Implementado (2.11.17):** `GET /api/platform/health/atendimento` (perm `inbox:view`).

Métricas retornadas:

- Conversas `bot_triage` stale (>15 min)
- CSAT pendente (alerta se ≥50)
- Tickets `unreadClientReply` (alerta se ≥20)
- Bridges ativos / stale (>24h)
- Sessão WA conectada e healthy (`monitorSessionHealth`)

Serviço: `src/services/attendance/attendance-health.service.ts`

---

## 13. Auditoria append-only Ticket e Bridge

**Implementado (2.11.17):** modelo `AttendanceEvent` (`attendanceEvents`) + `recordAttendanceEvent`.

Eventos bridge gravados: `bridge.started`, `bridge.closed`, `bridge.agent_reply`.

**Pendente:** `ticket.created`, `ticket.client_replied`, `ticket.closed` nos handlers de ticket.

**Evitar persistir:** token puro, corpo completo de mensagens, PII desnecessária.

---

## 14. IA Básica local-first

**Status: IMPLEMENTADA (2.11.1)** — não pendente.

- Modo `basic_triage` em `src/types/attendance-mode.ts`
- Serviço `webchat-basic-triage.service.ts`
- Doc fase: [`RADARCHAT-ATTENDANCE-MODES-PHASE-5.md`](./RADARCHAT-ATTENDANCE-MODES-PHASE-5.md)

**Estabilização:** não expandir IA Básica até QA Fase 1 verde. Melhorias = patch isolado + testes.

---

## 15. Modo piloto seguro

**Implementado (2.11.17):** `PILOT_MODE=true` em `environment.ts` → `config.PILOT.ENABLED`.

- Limite campanha: `PILOT_MAX_CAMPAIGN_RECIPIENTS` (default 50) em `CampaignDispatchService.createCampaign`
- Health expõe `pilotMode: true` em `/platform/health/atendimento`

**Pendente:** badge UI piloto, billing live bloqueado, tenants piloto assinados (§28).

---

## 16. Onboarding e templates

Backlog Fase D — wizard e seeds por segmento. Ver §6.2 e [`RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md).

---

## 17. Webhooks

**Existentes** ([`WEBHOOKS.md`](./WEBHOOKS.md)): `inbox.conversation.*`, `inbox.message.received`, `inbox.csat.rated`, `webchat.message.received`, `webchat.conversation.escalated|closed`.

**Futuros propostos:** `ticket.created`, `ticket.client_replied`, `ticket.closed`, `webchat.bridge.started|closed|command_denied`.

---

## 18. Produção, VPS e staging

- [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) e [`PRODUCTION.md`](./PRODUCTION.md) = **referência apenas**.
- **Não executar** deploy/VPS até gate § Estabilização.
- Nenhum script de deploy alterado nesta auditoria.

---

## 19. Plano de correção por fases

### Fase A — Gate automático + correções

1. ✅ `npm run qa:atendimento:gate` (2.11.16)
2. ✅ Anti-loop alerta fallback
3. Corrigir regressões (patch 2.11.x)
4. Testes integrados mínimos InboxService — ⏳

### Fase B — Segurança operacional

1. ✅ Rate limit tipado + jitter (2.11.17)
2. ✅ Audit log bridge (`AttendanceEvent`)
3. ✅ `health/atendimento`
4. ⏳ Webhooks ticket/bridge
5. ⏳ Audit ticket events

### Fase C — Piloto seguro

1. ✅ `PILOT_MODE` env (2.11.17)
2. **QA manual §28** — última etapa
3. 1–3 tenants com roteiro assinado

### Fase D — Produto vendável

Expansão horizontal (CRM, gatilhos, templates, relatórios) — [`RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md)

### Fase E — Evolução IA Básica

Refinamentos pós-estabilização (não Fase 5 greenfield)

---

## 20. Checklist técnico por módulo

| Módulo | Verificado (código/doc) | QA manual | Testes auto |
|--------|-------------------------|-----------|-------------|
| **WhatsApp inbound ordem** | ✅ `WhatsAppService.ts` | 🔴 | 🟡 helpers |
| **Inbox triagem/fila** | 🟡 doc + parcial código | 🔴 | 🟡 |
| **Ticket WA 12h/2h/30m** | ✅ utils + doc | 🔴 | ✅ unit |
| **Ticket WebChat + token** | ✅ 2.11.13 | 🔴 | ✅ lookup |
| **CSAT** | ✅ `csat.util` | 🔴 cenários 2–6 | ✅ |
| **IA triagem/escalação** | 🟡 doc 2.8.7 | 🔴 cenário 9 | ❌ |
| **WebChat widget** | ✅ `WEBCHAT.md` | 🟡 | 🟡 |
| **Bridge + comandos WA** | ✅ serviços | 🔴 roteiro WA | 🟡 |
| **Fallback alerta** | ✅ + anti-loop 2.11.16 | 🔴 | ✅ filter |
| **Rate limit WA** | ✅ parcial 20/min | — | 🟡 |
| **Modos atendimento** | ✅ F1–8 | 🟡 | ✅ E2E smoke |
| **Webhooks** | ✅ lista | — | — |
| **Produção/VPS** | ✅ bloqueado doc | — | — |

---

## 21. Tabela final de prioridades

| Prioridade | Item | Severidade | Impacto | Ação | Status |
|------------|------|------------|---------|------|--------|
| P1 | QA WA Inbox×Ticket×CSAT×IA | Crítica | Alto | Executar checklist | 🔴 |
| P1 | Testes ordem inbound integrados | Alta | Alto | Mock InboxService | ✅ 2.11.35 |
| P1 | Rate limit WA 2/10 + jitter | Alta | Alto | Fase B | ⏳ |
| P1 | Bridge + loop alerta | Alta | Alto | Filtro 2.11.16 + QA | 🟡 |
| P1 | Chamado WebChat visibilidade | Alta | Médio | 2.11.13 + QA | 🟡 código |
| P2 | `qa:atendimento:gate` | Média | Médio | Script 2.11.16 | 🟢 |
| P2 | Audit Ticket/Bridge | Média | Médio | Modelo eventos | ⏳ |
| P2 | Saúde atendimento API | Média | Médio | Fase B | ⏳ |
| P2 | PILOT_MODE | Média | Médio | Fase C | ⏳ |
| P3 | Expansão horizontal produto | Baixa | Produto | Fase D | ⏳ |
| P3 | Webhooks ticket/bridge | Baixa | Médio | Fase B | ⏳ |

---

## 22. Comandos de validação

```bash
npm run qa:atendimento:gate   # gate atendimento (recomendado antes de release)
npm run qa:prep
npm run qa:webchat-wa
npm test
npm run qa:gate               # completo CI local
npm run build --prefix src/services/web-dashboard/frontend
```

---

## 23. O que foi verificado no código (evidências)

| Item | Resultado | Referência |
|------|-----------|------------|
| Ordem inbound WA | Confirmada | `WhatsAppService.ts` L2475–2562 |
| CSAT antes inbox/ticket | Confirmada | `handleTicketInboundMessage` L909; `handleInboundMessage` L1777 |
| Bypass CSAT novo atendimento | Confirmada | `csat.util.ts` L24–61 |
| `sair` ≠ LGPD | Confirmada | `inbox-ticket.ts` L28–38 |
| Bridge ignora `!` | Confirmada | `webchat-whatsapp-bridge.service.ts` L142 |
| Comandos WA whitelist | Confirmada | `whatsapp-agent-auth.service.ts` (via bridge/command) |
| Rate limit envio WA | Tipado 2/10/min (2.11.17) | `whatsapp-session-rate-limit.ts` |
| Alerta sem rate limit | Confirmada | `sendInternalAlert` direto socket |
| IA Básica implementada | Confirmada | `basic_triage` + `webchat-basic-triage.service.ts` |
| Audit log bridge | Implementado 2.11.17 | `AttendanceEvent` |
| Health atendimento | Implementado 2.11.17 | `GET /platform/health/atendimento` |
| PILOT_MODE | Implementado 2.11.17 | `config.PILOT.ENABLED` |
| Anti-loop alerta | Implementado 2.11.16 | `filterFallbackAlertPhones` |

---

## 24. O que ainda precisa ser testado manualmente

> Lista completa e ordem de execução em **§28** (última etapa — após Fase B).

---

## 25. Arquivos que podem ser alterados (Fase A/B)

`src/services/inbox/*`, `src/services/webchat/*`, `src/services/whatsapp/*`, `src/utils/*`, `src/cache/RateLimiter.ts`, testes `__tests__`, docs módulo, `package.json` scripts.

---

## 26. Arquivos que NÃO alterar sem necessidade

`sessions/`, `.env`, credenciais, Cloud API Meta (stub), billing live, deploy VPS, refatoração total `InboxService.ts`, lint global.

---

## 27. Conclusão

Fase B entregou rate limit tipado, health API, audit bridge e `PILOT_MODE`. Gate automático (`qa:atendimento:gate`) deve permanecer verde a cada patch. **Produção continua bloqueada** até §28 (QA manual) assinado.

Próximo implementação: webhooks ticket/bridge + audit ticket + testes integrados InboxService.

Expansão horizontal (CRM, gatilhos) = **Fase D**. Visão: [`RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARCHAT-VISAO-PRODUTO-DIFERENCIACAO.md).

---

## 28. QA manual — última etapa

Execute **após** `npm run qa:atendimento:gate` verde e Fase B implementada.

### Documentos

| Doc | Uso |
|-----|-----|
| [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) | Checklist § A/B/C |
| [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) | Passo a passo (10 cenários WA) |
| [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) | Bridge + comandos + chamado |
| [`QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md`](./QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md) | Registro |

### Scripts (gate automático — antes do manual)

| Script | O que faz |
|--------|-----------|
| `npm run qa:prep` | Mongo, sessão WA, CSAT, fallback |
| `npm run qa:webchat-wa` | Jest subset WebChat/WA + `qa:prep` |
| **`npm run qa:atendimento:gate`** | Jest atendimento crítico + `qa:webchat-wa` |
| `npm run qa:gate` | test + build backend + frontend |

### Cenários manuais obrigatórios

| Cenário | Doc |
|---------|-----|
| Triagem → humano | QA-FASE1 § cenário 1 |
| CSAT 1–5 + bypass novo atendimento | QA-FASE1 § cenários 2–6 |
| Ticket 12h / sair / reabrir | QA-FASE1 § cenários 7–8 |
| IA promete transferir | QA-FASE1 § cenário 9 |
| WebChat bridge + TK + `!nota` | QA-WEBCHAT-WA-FALLBACK-BRIDGE |
| Consulta pública TK+token | QA-WEBCHAT-WA |
| Chamado fechado — histórico consulta | QA-WEBCHAT-WA |
| Fallback alerta sem loop | QA-WEBCHAT-WA |

**Gate ROADMAP § Estabilização** → 🟢 somente com §28 registrado.
