# RadarZap — Análise crítica de atendimento e estabilização

**Versão analisada:** `2.11.13`  
**Data:** 2026-06-21  
**Status:** Estabilização — **não go-live**  
**Escopo:** WhatsApp, Inbox, Ticket, CSAT, IA, WebChat, Bridge WA, QA, rate limit, produção

**Plano de aplicação:** [`PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`](./PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md)

---

## 1. Resumo executivo

O RadarZap v2 tem **superfície ampla implementada** (painel, Inbox, tickets, WebChat, bridge WhatsApp, IA, API, webhooks). Correções recentes **2.11.10–2.11.13** endereçaram chamado WebChat: atualizações ao visitante, consulta TK+token, separação **mensagem ao cliente** vs **`!nota` interna**.

O núcleo **WhatsApp Inbox × Ticket × CSAT × IA** ainda depende de **QA manual completo** antes de piloto externo. **Não** executar `PREPARACAO-PRODUCAO.md` nem VPS até o gate em [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md) § Estabilização.

---

## 2. Fontes analisadas

- Documentação listada em `gg.md` / `INDICE-DOCUMENTACAO.md`
- Código: `InboxService`, `WhatsAppService`, `WebChatService`, `webchat-whatsapp-bridge.service.ts`, `whatsapp-agent-command.service.ts`, `ticket-public-access.service.ts`
- Testes: `inbound-routing`, `csat.util`, `ticket-reply-window`, `ticket-public-access`, `whatsapp-agent-command`
- Commits recentes: 2.11.8–2.11.13 (comandos WA, chamado WebChat, consulta pública)

---

## 3. Estado atual do sistema

| Módulo | Situação | Notas |
|--------|----------|-------|
| Inbox WA triagem/fila | 🟡 | Fixes 2.8.x; QA manual pendente |
| Ticket WhatsApp | 🟡 | Janelas 12h/2h/30min testadas em unit |
| Ticket WebChat + token | 🟢 | 2.10.70+ lookup; 2.11.10–13 visibilidade cliente |
| CSAT | 🟡 | Fixes 2.8.8–2.8.11; validar QA |
| IA escalação | 🟡 | Fix 2.8.7; validar QA |
| WebChat widget | 🟢 | Fila, IA, FAQ, pré-chat, consulta chamado |
| Bridge WA ↔ WebChat | 🟡 | `!assumir`, `TK-…`, `!nota`; QA recomendado |
| Modos atendimento F1–4 | 🟢 | Código + docs Fases 1–4 |
| IA Básica Fase 5 | ⏳ | Proposta — não implementar na estabilização |
| Cloud API Meta | ⏳ | Stub Fase 2 |
| Produção / VPS | 🔴 | Bloqueado — gate Fase 1 |

---

## 4. Bloqueadores críticos

| # | Item | Ação |
|---|------|------|
| B1 | QA manual § A WhatsApp incompleto | Executar `QA-FASE1-CHECKLIST.md` |
| B2 | Sem teste integrado ordem inbound em `InboxService` | Adicionar testes mínimos nos fluxos que falharam historicamente |
| B3 | Gate estabilização não marcado | Repetir QA até checklist verde |
| B4 | Rate limit WA conversa vs marketing não unificado | Fase B — ver §8 |

---

## 5. Riscos altos

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | Ticket antigo sequestra atendimento | Testes `inbound-routing` + QA cenário 7 |
| R2 | CSAT pendente bloqueia novo atendimento | `csat.util` + QA cenários 2–6 |
| R3 | Loop alerta WA se número sessão = alerta | Auditar `whatsappFallbackAlertPhones` vs JID sessão |
| R4 | Comando `!` vaza ao visitante | Bridge ignora `!`; validar em QA |
| R5 | Ticket “Em andamento” com chat encerrado | Definir regra produto `!encerrarchat` vs status ticket |
| R6 | Marketing + atendimento mesma sessão WA | Rate limit prioritário (§8) |

---

## 6. Riscos médios

- Lint ~7k issues — estratégia progressiva (lint por módulo alterado)
- `InboxService` ~4.7k linhas — evitar refatoração sem cobertura
- WebChat triagem robotizada mais fraca que WA (doc modos)
- Observabilidade limitada — conversas travadas podem passar despercebidas
- Sem audit log append-only Ticket/Bridge persistido

---

## 7. Verificação: celular próprio conectado para atender WebChat pelo WhatsApp

### 7.1 Como funciona hoje

**FUNCIONA PARCIALMENTE**

- Sessão Baileys da empresa envia alertas (`sendInternalAlert`) para telefones em `whatsappFallbackAlertPhones`
- Atendente autorizado responde via bridge (`handleWhatsappBridgeAgentReply`) → `sendAgentMessage` no WebChat
- Comandos `!assumir`, `!abrir`, `!token`, `!nota` via `whatsapp-agent-command.service.ts`
- Whitelist: `resolveAuthorizedWhatsappAgentFromContext` + membro equipe com `whatsappPhone`

### 7.2 Riscos de loop

- Se o **mesmo número** da sessão WA estiver em `whatsappFallbackAlertPhones`, alerta pode voltar para a sessão — **não confirmado bloqueio explícito no código atual**
- Mensagens bridge não começam com `!` — não reentram como comando

### 7.3 Separação de números

| Papel | Origem |
|-------|--------|
| Cliente final | JID inbound normal / visitante WebChat |
| Sessão empresa | Baileys `clientId` session |
| Atendente autorizado | `CompanyMember.whatsappPhone` |
| Alerta fallback | `InboxSettings.whatsappFallbackAlertPhones` |

### 7.4 Resultado da análise

**FUNCIONA PARCIALMENTE** — fluxo principal operacional; falta validação QA de loop e documentação operacional “use celular do atendente, não da sessão”.

### 7.5 Correções recomendadas (Fase B)

1. Rejeitar ou deduplicar `whatsappFallbackAlertPhones` que coincide com JID da sessão conectada
2. Log `bridge:alert_skipped_same_session`
3. Documentar em `WEBCHAT.md` § Bridge operacional

**Arquivos:** `webchat-whatsapp-fallback.service.ts`, `WhatsAppService.ts`, `InboxSettings`

---

## 8. Limites de mensagens por minuto e delay humanizado

### 8.1 Marketing / disparo / agendado

- **Desejado:** máx. 2 msg/min por sessão WA, jitter ~30s, fila (não descartar)
- **Hoje:** campanhas com fila BullMQ — **limites exatos não confirmados como 2/min uniforme**

### 8.2 Conversação IA / chat / humano

- **Desejado:** máx. 10 msg/min, jitter ~6s mínimo
- **Hoje:** rate limit parcial em envios manuais — **auditoria completa pendente**

### 8.3 Prioridade entre filas

Conversa ativa > alertas internos > marketing (documentar e implementar na Fase B).

### 8.4 Jitter / delay variável

Evitar delay fixo idêntico — usar randomização segura na fila de envio.

### 8.5 Arquivos prováveis

- `WhatsAppService.ts` (sendManualMessage, campanhas)
- Filas BullMQ campanhas / notifications
- Novo helper `whatsapp-session-rate-limit.ts` (proposta)

### 8.6 Testes necessários

- Unit: token bucket por `clientId` + tipo origem
- Integração: campanha + inbound simultâneo não bloqueia resposta humana crítica

---

## 9. QA obrigatório antes de piloto

| Doc | Uso |
|-----|-----|
| [`QA-FASE1-CHECKLIST.md`](./QA-FASE1-CHECKLIST.md) | Checklist imprimível |
| [`QA-FASE1-ROTEIRO.md`](./QA-FASE1-ROTEIRO.md) | Passo a passo |
| [`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`](./QA-WEBCHAT-WA-FALLBACK-BRIDGE.md) | Bridge + comandos |
| [`QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md`](./QA-WEBCHAT-WA-RESULTADO-TEMPLATE.md) | Registro resultados |

**Scripts:** `npm run qa:prep`, `qa:webchat-wa`, `qa:gate`

**Proposta:** `npm run qa:atendimento:gate` — agrupador (ainda não implementado)

---

## 10. Testes automatizados faltantes

| Fluxo | Status |
|-------|--------|
| CSAT bypass novo atendimento | ✅ `csat.util.test.ts` |
| Ticket janela 12h | ✅ `ticket-reply-window.util.test.ts` |
| Routing ticket vs inbox | ✅ `inbound-routing.test.ts` |
| Consulta pública TK+token | ✅ `ticket-public-access.service.test.ts` |
| Comandos WA agente | ✅ `whatsapp-agent-command.util.test.ts` |
| Ordem inbound integrada `InboxService` | ❌ falta |
| Bridge E2E com WA real | ❌ manual only |
| Ticket WebChat mensagem cliente × !nota | 🟡 parcial via unit lookup + manual |

---

## 11. Observabilidade e saúde do atendimento

**Proposta (Fase B)** — doc/painel mínimo “Saúde do Atendimento”:

- Conversas em `bot_triage` > N min
- IA prometeu transferência sem escalação
- Tickets com `unreadClientReply` > SLA
- CSAT pendente > limite
- Bridges ativos > 24h
- Comandos WA negados (contador)
- Sessão WA desconectada

Implementação inicial: métricas em `GET /api/.../health/atendimento` + doc — **sem painel grande na Fase A**.

---

## 12. Auditoria append-only Ticket e Bridge

**Não existe** modelo persistido hoje.

**Proposta:** `AttendanceEvent` ou coleções `TicketEvent` / `BridgeEvent`:

- ticket_created, token_generated, token_rotated, public_lookup_ok/fail
- team_message, client_reply, bridge_activated, bridge_closed
- wa_command: assumir, nota, encerrar, encerrarchat (autorizado/negado)

Evitar: corpo completo de mensagens, tokens puros, PII desnecessária.

---

## 13. IA Básica local-first — proposta futura

Ver [`concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md).

**Não implementar** durante estabilização. Ao implementar: atualizar CHANGELOG, SISTEMA-REGISTRO, INDICE, registry `.mdc`.

---

## 14. Modo piloto seguro

**Não existe** `PILOT_MODE` hoje.

**Proposta `PILOT_MODE=true`:**

- Limita campanhas / tenants
- Logs extras Inbox/Ticket/WebChat
- Badge “Piloto” no painel
- Bloqueia billing live / ações destrutivas
- Auditoria reforçada

---

## 15. Onboarding e templates

Backlog produto (Fase D) — wizard: WA → setores → horário → modo → widget → equipe → teste.

Templates por segmento (clínica, oficina, loja, etc.) — seeds futuros.

Detalhes: [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md)

---

## 16. Webhooks e eventos futuros

**Existentes:** ver [`WEBHOOKS.md`](./WEBHOOKS.md) — inbox, webchat escalated, etc.

**Proposta futura:**

- `ticket.created`, `ticket.client_replied`, `ticket.closed`
- `webchat.bridge.started`, `webchat.bridge.closed`, `webchat.bridge.command_denied`

---

## 17. Produção, VPS e staging

- [`PREPARACAO-PRODUCAO.md`](./PREPARACAO-PRODUCAO.md) e [`PRODUCTION.md`](./PRODUCTION.md) são **referência**
- **Não executar** deploy dedicado até gate Fase 1
- Remover/suavizar qualquer doc que sugira “pronto para produção” sem gate

---

## 18. Plano de correção por fases

### Fase A — Estabilização crítica (agora)

1. QA manual completo
2. Corrigir regressões (patch 2.11.x / 2.12.0)
3. `qa:atendimento:gate`
4. Atualizar `TICKET-ATENDIMENTO.md` / `WEBCHAT.md` com regras 2.11.13

### Fase B — Segurança operacional

Rate limit, anti-loop alerta, audit log, saúde atendimento

### Fase C — Piloto seguro

`PILOT_MODE`, 1–3 clientes, monitoramento

### Fase D — Produto vendável

Visão gg1 — CRM leve, gatilhos, relatórios conversão

### Fase E — IA Básica

Fase 5 modos

---

## 19. Checklist técnico (resumo)

- [ ] QA-FASE1 § A passou
- [ ] QA WebChat bridge passou
- [ ] Chamado WebChat: mensagem cliente vs !nota validado
- [ ] `npm run qa:gate` verde
- [ ] Gate ROADMAP § Estabilização marcado
- [ ] Rate limit WA documentado/implementado (Fase B)
- [ ] Audit log proposta aprovada (Fase B)

---

## 20. Tabela final de prioridades

| Prioridade | Item | Severidade | Impacto | Ação | Status |
|------------|------|------------|---------|------|--------|
| P1 | QA WA Inbox×Ticket×CSAT×IA | Crítica | Alto | Executar checklist | 🔴 Pendente |
| P1 | Testes ordem inbound integrados | Alta | Alto | Testes InboxService | 🔴 Pendente |
| P1 | Bridge + celular + loop | Alta | Alto | QA + anti-loop Fase B | 🟡 Parcial |
| P1 | Rate limit WA | Alta | Alto | Implementar Fase B | ⏳ Planejado |
| P1 | Chamado WebChat visibilidade | Alta | Médio | 2.11.13 + QA | 🟢 Código |
| P2 | qa:atendimento:gate | Média | Médio | Script package.json | ⏳ |
| P2 | Audit Ticket/Bridge | Média | Médio | Modelo eventos | ⏳ |
| P2 | PILOT_MODE | Média | Médio | Env flag | ⏳ |
| P3 | IA Básica Fase 5 | Baixa | Médio | Após estabilização | ⏳ |
| P3 | CRM / gatilhos / templates | Baixa | Produto | Fase D | ⏳ |

---

## 21. Comandos de validação

```bash
npm run qa:prep
npm run qa:webchat-wa
npm test
npm run qa:gate
npm run build --prefix src/services/web-dashboard/frontend
```

---

## 22. Arquivos que podem ser alterados

`src/services/inbox/`, `src/services/webchat/`, `src/services/whatsapp/`, `src/utils/`, testes relacionados, docs de módulo, scripts `qa:*`, componentes inbox frontend.

---

## 23. Arquivos que NÃO alterar sem necessidade

`sessions/`, `.env`, Cloud API produção, billing live, deploy scripts, refatoração total `InboxService`.

---

## 24. Conclusão

O RadarZap v2 está **maduro em funcionalidades**, **imature em validação de ponta a ponta**. A consolidação dos GGs aponta: **estabilizar antes de vender**, **separar claramente mensagem ao cliente vs nota interna** (implementado 2.11.13), e **executar QA manual** como próximo passo obrigatório.

Visão comercial de longo prazo: [`RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`](./RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md).
