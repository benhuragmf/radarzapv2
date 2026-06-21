# RadarZap — Análise crítica de atendimento e estabilização

**Versão analisada:** `2.11.16`  
**Data da auditoria:** 2026-06-21  
**Revisão:** 2 (auditoria com evidência no código — substitui rascunho GG)  
**Status:** Estabilização — **não go-live**  
**Escopo:** WhatsApp, Inbox, Ticket, CSAT, IA, WebChat, Bridge WA, QA, rate limit, produção

**Plano de aplicação:** [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md)

---

## 1. Resumo executivo

O RadarZap v2 tem **superfície ampla implementada** (painel, Inbox, tickets, WebChat, bridge WhatsApp, IA, modos de atendimento Fases 1–8, API, webhooks). Correções **2.11.10–2.11.13** endereçaram chamado WebChat (mensagem ao cliente vs `!nota`, consulta TK+token).

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
| 1–10 | `INDICE`, `CHANGELOG`, `SISTEMA-REGISTRO`, `VERSIONAMENTO`, `ROADMAP`, `INBOX`, `TICKET`, `WEBCHAT`, `WEBHOOKS`, `RADARZAP-MODOS-…` | Governança + comportamento |
| 11–13 | `concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-{1,3,4}.md` | Histórico modos |
| 14–17 | `QA-FASE1-*`, `QA-WEBCHAT-WA-*` | Roteiros manuais |
| 18–19 | `concluidos/RADARZAP_WHATSAPP_TICKET_FAQ_*` | FAQ/bridge entregue 2.10.75 |
| 20–26 | `concluidos/radarzap-inbox-upgrade`, `MENU-PAGES-REGISTRY`, `EQUIPE-RBAC`, `DESIGN-SYSTEM`, migração, `PREPARACAO`, `PRODUCTION` | Referência |

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
| B2 | Sem teste integrado ordem inbound em `InboxService` | Adicionar testes mínimos (mock Mongo) — Fase A | 🔴 |
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
| O6 | Testes integrados mínimos ordem inbound | A |

### 6.2 Melhorias futuras (produto — Fase D+)

Ver [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md): CRM leve, gatilhos WebChat (preço, UTM, exit), templates por segmento, wizard onboarding, relatórios conversão.

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
- **Hoje:** `WhatsAppService` usa fila BullMQ para campanhas; `checkWhatsAppSendingLimit` aplica **um** bucket por `clientId` — default `WHATSAPP_RATE_LIMIT` = **20/min** (`environment.ts` L262). **Não confirmado** limite 2/min nem jitter 30s dedicado.

### 8.2 Conversação IA / chat / humano

- **Desejado:** máx. **10 msg/min**, jitter ~6s mínimo.
- **Hoje:** mesmo bucket 20/min (prod) / 120/min (dev) — **não** distingue origem conversa vs campanha. `sendInternalAlert` **não** passa por rate limit (envio direto socket).

### 8.3 Prioridade entre filas

**Não implementado.** Proposta Fase B: conversa ativa > alertas > marketing.

### 8.4 Jitter / delay variável

Campanhas: delay fixo entre mensagens em loop L3197 (`WhatsAppService`) — **sem jitter documentado**.

### 8.5 Arquivos prováveis (Fase B)

- `src/cache/RateLimiter.ts`
- `src/services/whatsapp/WhatsAppService.ts` (`sendManualMessage`, campanhas)
- Novo: `src/utils/whatsapp-session-rate-limit.ts` (tipo: `marketing` | `conversation` | `alert`)

### 8.6 Testes necessários

- Unit: token bucket por tipo de origem.
- Integração: campanha + resposta humana simultânea não bloqueia conversa crítica.

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

## 10. QA obrigatório antes de piloto

| Doc | Uso |
|-----|-----|
| [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) | Checklist § A/B/C |
| [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) | Passo a passo |
| [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) | Bridge + comandos + chamado |
| [`QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md`](./QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md) | Registro |

### Scripts

| Script | O que faz |
|--------|-----------|
| `npm run qa:prep` | Mongo, sessão WA, CSAT, fallback |
| `npm run qa:webchat-wa` | Jest subset WebChat/WA + `qa:prep` |
| **`npm run qa:atendimento:gate`** | Jest atendimento crítico + `qa:webchat-wa` (**2.11.16**) |
| `npm run qa:gate` | test + build backend + frontend |

**Lacuna:** nenhum script substitui QA manual § A (10 cenários WhatsApp).

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

**Não existe** endpoint `GET /api/.../health/atendimento` nem painel dedicado.

**Proposta Fase B** — métricas mínimas:

- Conversas `bot_triage` > N min
- IA prometeu transferência sem escalação
- Tickets `unreadClientReply` > SLA
- CSAT pendente > limite
- Bridges ativos > 24h
- Comandos WA negados (contador)
- Sessão WA desconectada

---

## 13. Auditoria append-only Ticket e Bridge

**Não existe** modelo persistido (`TicketEvent`, `BridgeEvent`, `AttendanceEvent`).

Eventos mínimos propostos: ver prompt original §10 — implementar Fase B.

**Evitar persistir:** token puro, corpo completo de mensagens, PII desnecessária.

---

## 14. IA Básica local-first

**Status: IMPLEMENTADA (2.11.1)** — não pendente.

- Modo `basic_triage` em `src/types/attendance-mode.ts`
- Serviço `webchat-basic-triage.service.ts`
- Doc fase: [`concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md)

**Estabilização:** não expandir IA Básica até QA Fase 1 verde. Melhorias = patch isolado + testes.

---

## 15. Modo piloto seguro

**Não existe** `PILOT_MODE` no código (grep vazio).

Proposta Fase C: limites campanha/tenant, badge piloto, logs extras, bloqueio billing live.

---

## 16. Onboarding e templates

Backlog Fase D — wizard e seeds por segmento. Ver §6.2 e [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md).

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

### Fase A — Estabilização crítica (agora)

1. QA manual § A + § C WebChat
2. `npm run qa:atendimento:gate` verde
3. Corrigir regressões (patch 2.11.x)
4. Testes integrados mínimos InboxService (próximo patch)
5. Atualizar `WEBCHAT.md` § bridge operacional

### Fase B — Segurança operacional

Rate limit tipado, audit log, `health/atendimento`, webhooks ticket/bridge

### Fase C — Piloto seguro

`PILOT_MODE`, 1–3 tenants, monitoramento

### Fase D — Produto vendável

Expansão horizontal (CRM, gatilhos, templates, relatórios) — [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md)

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
| P1 | Testes ordem inbound integrados | Alta | Alto | Mock InboxService | 🔴 |
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
| Rate limit envio WA | Parcial 20/min global | `RateLimiter.checkWhatsAppSendingLimit` |
| Alerta sem rate limit | Confirmada | `sendInternalAlert` direto socket |
| IA Básica implementada | Confirmada | `basic_triage` + `webchat-basic-triage.service.ts` |
| Audit log ticket/bridge | Ausente | grep `TicketEvent` vazio |
| PILOT_MODE | Ausente | grep vazio |
| Anti-loop alerta | Implementado 2.11.16 | `filterFallbackAlertPhones` |

---

## 24. O que ainda precisa ser testado manualmente

| # | Cenário | Roteiro |
|---|---------|---------|
| 1 | Triagem → humano | QA-FASE1 § A.1 |
| 2 | Finalizar → CSAT imediato | § A.2 |
| 3 | `avaliar` → CSAT, não ticket | § A.3 |
| 4 | Nota `4` gravada | § A.4 |
| 5 | Pós-CSAT novo `Ola` | § A.5 |
| 6 | `falar com atendente` pós-CSAT | § A.6 |
| 7 | TK antigo fechado + msg nova | § A.7 |
| 8 | Ticket 12h complemento | § A.8 |
| 9 | IA promete transferência | § A.9 |
| 10 | Menu ticket `1/2` vs inbox | § A.10 |
| 11 | WebChat: msg cliente vs `!nota` | QA-WEBCHAT-WA |
| 12 | Consulta TK+token | QA-WEBCHAT-WA |
| 13 | `!encerrarchat` vs `!encerrar` | QA-WEBCHAT-WA |
| 14 | Bridge com 2 chamados abertos | QA-WEBCHAT-WA |

---

## 25. Arquivos que podem ser alterados (Fase A/B)

`src/services/inbox/*`, `src/services/webchat/*`, `src/services/whatsapp/*`, `src/utils/*`, `src/cache/RateLimiter.ts`, testes `__tests__`, docs módulo, `package.json` scripts.

---

## 26. Arquivos que NÃO alterar sem necessidade

`sessions/`, `.env`, credenciais, Cloud API Meta (stub), billing live, deploy VPS, refatoração total `InboxService.ts`, lint global.

---

## 27. Conclusão

A auditoria com evidência confirma: **funcionalidades existem**, **helpers testados**, **gaps em integração e QA manual**. Produção continua **bloqueada**. Próximo passo operacional: **executar QA-FASE1 § A** e registrar resultados; manter `qa:atendimento:gate` verde a cada patch de atendimento.

Expansão horizontal de produto (CRM, gatilhos, templates) permanece **Fase D** — após gate estabilização.

Visão comercial: [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md).
