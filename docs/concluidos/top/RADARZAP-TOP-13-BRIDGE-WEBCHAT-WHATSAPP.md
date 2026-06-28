# RadarZap — TOP 13/20 — Bridge WebChat ↔ WhatsApp

**Data:** 2026-06-24  
**Versão após TOP 13:** `2.11.99`  
**Branch:** `main`

---

## Resumo executivo

O TOP 13 consolidou a **Bridge WebChat ↔ WhatsApp** como ligação operacional entre conversas do site e atendentes via Baileys: fallback com alerta/rotação, `!assumir` ativando bridge bidirecional, sync visitante→WA e atendente WA→WebChat, anti-loop (filtro sessão, dedupe forward, bloqueio eco), eventos de auditoria ampliados, helpers testáveis (`webchat-bridge.util.ts`) e documentação mestre atualizada.

Não foi refeito WebChat (TOP 11), WhatsApp sessão (TOP 12), Inbox (TOP 07), Tickets (TOP 08) nem Leads (TOP 09). Comando `!responder` dedicado não existe — resposta por contexto ativo ou prefixo `TK-XXXX`. Produção não declarada pronta.

---

## Herança dos TOPs anteriores

### TOP 01

Bridge parcial identificada; QA `QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`; riscos: duplicidade, loop, cross-tenant.

### TOP 02–10

Baseline, planos, RBAC, presença/fila, modos, Inbox, tickets, leads, formulários — preservados.

### TOP 11

WebChat/widget/fallback deferido; bridge completa → TOP 13.

### TOP 12

WhatsApp Baileys, comandos `!`, rate limit, sessão/QR — não refeito.

### Documentação mestre

`RADARZAP-SISTEMA-COMPLETO.md` criada no TOP 12 — §16 atualizada neste TOP.

### Esta etapa fecha

Bridge operacional, fallback, assumir, sync bidirecional (com `!assumir`), anti-loop, testes, docs.

### Esta etapa não faz

IA profunda (14/15), créditos (16), billing (17), refazer módulos anteriores.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `e01cc81` — `chore(top): whatsapp e documentacao consolidada 2.11.98` |
| Modificados antes | Nenhum |
| Untracked (não commitar) | `data/`, `mocker/modelochat/` |
| Risco | Baixo |

---

## Escopo autorizado

Bridge, fallback, assumir, sync, alertas, anti-loop, dedupe, eventos, testes, documentação.

---

## Diagnóstico atual da Bridge

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Fallback WhatsApp | Sim | `webchat-whatsapp-fallback.service.ts` | Rotação equipe, cooldown 15 min |
| Alerta para equipe | Sim | `buildWhatsAppFallbackAlertBody` | `!assumir TK-…` sem tokens widget |
| Assumir via WhatsApp | Sim | `whatsapp-agent-command.service.ts` | `!assumir` → assign + `activateWhatsappBridge` |
| Responder WebChat pelo WA | Sim | `handleWhatsappBridgeAgentReply` | Contexto ativo ou `TK-XXXX texto` |
| Sync WebChat → WhatsApp | Sim | `forwardVisitorMessageToWhatsappBridge` | Só com bridge ativa |
| Sync WhatsApp → WebChat | Sim | `sendAgentMessage` via bridge handler | `humanDelay: bridge` |
| Bridge deferida | Sim | fila + timeout + rotação | Sem atendente online |
| Bridge ativa | Sim | `whatsappBridgeActive` em `WebChatConversation` | Badge Inbox |
| Estado bridge | Sim | campos conversa + `normalizeBridgeProductStatus` | TOP 13 helper |
| Idempotência | Sim | `shouldForwardBridgeMessage` | 8s dedupe |
| Anti-loop | Sim | `filterFallbackAlertPhones`, `isBridgeLoopRisk` | + evento `loop_prevented` |
| Comandos | Sim | `!assumir`, `!encerrarchat`, `!ticket`, etc. | Sem `!responder` |
| Eventos painel | Sim | WS + `AttendanceEvent` | |
| Auditoria | Sim | `bridge.*` kinds | + webhooks `webchat.bridge.*` |
| Testes | Sim | 4+ suites bridge/fallback | + `webchat-bridge.util.test.ts` |

---

## Diagnóstico de fallback WhatsApp no WebChat

| Aspecto | Status |
|---------|--------|
| Config | `InboxSettings.whatsappFallbackEnabled`, alert phones, timeout, mensagem visitante |
| UI painel | `/platform/inbox/bot` — seção fallback |
| Widget visitante | Mensagem offline/deferida via API; alerta server-side para equipe |
| Horário | Herda horário comercial WebChat |
| CTA WhatsApp direto no widget | Limitado — fallback principal é alerta equipe + fila |
| Sem vazamento interno | Alerta sem `wck_*`, `clientId` |

---

## Diagnóstico de alerta WhatsApp para equipe

- Enviado via `sendInternalAlert` / rotação `processFallbackWhatsappRotation`.
- Cooldown 15 min por conversa (`ALERT_COOLDOWN_MS`).
- `filterFallbackAlertPhones` evita número da sessão Baileys (anti-loop).
- Corpo com TK amigável e `!assumir NNNN`.
- Rate limit herdado TOP 12 (`alert` kind).

---

## Diagnóstico de assumir atendimento via WhatsApp

- `!assumir TK-…` → `assignConversation` + `activateWhatsappBridge`.
- Exige equipe WA verificada + `INBOX_REPLY`.
- Bloqueia se outro atendente já atribuído (TOP 07).
- Mensagem confirma bridge ativo e instrui `TK-XXXX resposta`.
- Cross-tenant: query filtra `clientId`.

---

## Diagnóstico de sync WebChat para WhatsApp

- **Com bridge ativa:** cada mensagem visitante → `formatVisitorBridgeMessage` → WA do atendente.
- **Sem bridge:** apenas alertas de fallback (não espelha cada mensagem).
- Dedupe 8s por corpo (`shouldForwardBridgeMessage`).
- Com bridge ativa, bot/IA não reprocessa inbound (`replies: []`).

---

## Diagnóstico de sync WhatsApp para WebChat

- Atendente responde texto livre (1 bridge) ou `TK-ABC123 resposta` (vários).
- `sendAgentMessage` → widget + Inbox; sync ticket se `ticketRef`.
- Não aciona pipeline visitante; `direction: outbound`.
- `!` tratado antes do bridge handler no `WhatsAppService`.

---

## Diagnóstico de comandos da Bridge

| Comando | Existe? | Canal | Quem pode usar | O que faz | Lacuna |
|---------|---------|-------|----------------|-----------|--------|
| `!assumir` | Sim | WA | Equipe verificada | Assign + bridge | — |
| `!responder` | Não | — | — | Usar texto livre ou `TK-XXXX` | Documentado |
| `!encerrar` | Sim | WA | Equipe | Fecha ticket | — |
| `!encerrarchat` | Sim | WA | Equipe | Encerra chat site, desativa bridge | — |
| `!ticket` | Sim | WA | Equipe | Consulta TK | — |
| `!nota` | Sim | WA | Equipe | Nota interna | — |
| `!ajuda` | Sim | WA | Equipe | Lista comandos | — |
| `!status` | Não | — | — | Ver painel/Inbox | — |

---

## Diagnóstico de anti-loop e idempotência

| Mecanismo | Onde |
|-----------|------|
| Alerta ≠ número sessão | `filterFallbackAlertPhones` |
| Cooldown alerta | 15 min |
| Dedupe forward visitante | `shouldForwardBridgeMessage` (8s) |
| Eco formato `*[Site…]*` | `isBridgeLoopRisk` bloqueia resposta WA |
| Bridge ativa pula bot/IA | `WebChatService` inbound |
| Comandos antes de bridge | `WhatsAppService` ordem handlers |

Eventos: `bridge.loop_prevented`, `bridge.message_forwarded`.

---

## Diagnóstico de segurança multiempresa

- Widget/API pública: `publicKey` `wck_*` — sem `clientId` ao visitante.
- Bridge opera só com `clientId` da sessão WA autenticada.
- `assertBridgeClientMatch` na ativação.
- Comandos filtram conversa por `clientId` Mongo.

---

## Diagnóstico de Inbox, Tickets, Contatos e Leads na Bridge

### Inbox

Conversa única `wc:{id}`; histórico unificado; badge bridge.

### Tickets

`ticketRef` no alerta; `!ticket`/`!abrir`; token não no alerta WA.

### Contatos

Visitante vinculado por telefone/e-mail; dedupe TOP 09.

### Leads

Bridge não cria lead genérico; `maybeCaptureWhatsAppInbound` / WebChat inbound inalterados.

---

## Estados oficiais da Bridge

| Produto | Derivação |
|---------|-----------|
| `disabled` | fallback off, bridge off |
| `available` | fallback on, bridge off |
| `pending` | fila + fallback |
| `active` | `whatsappBridgeActive` |
| `closed` | conversa `closed` |
| `paused` | não persistido — usar fila |
| `failed` | erro envio — log operacional |

Helper: `normalizeBridgeProductStatus`.

---

## Regras oficiais da Bridge

1. Inbox é fonte única de histórico.
2. Bridge ativa só após `!assumir` (ou fluxo assign equivalente).
3. Visitante→WA só com bridge ativa.
4. Atendente→WebChat só equipe autorizada com bridge ativa.
5. Sem lead/ticket automático por bridge.
6. Sem tokens/QR/widget key em alertas.

---

## Regras oficiais de fallback

1. Habilitado em `InboxSettings`.
2. Rotação por atendente verificado online no WA.
3. Timeout antes de rotacionar (configurável).
4. Mensagem ao visitante customizável.
5. Cooldown entre alertas.

---

## Regras oficiais de comandos

Ver tabela diagnóstico. Cliente comum não executa `!`.

---

## Regras oficiais de anti-loop

1. Marcar origem (formato forward, dedupe key).
2. Não reprocessar eco de alerta/forward.
3. Registrar `bridge.loop_prevented` quando bloqueado.

---

## Eventos, auditoria e rastreabilidade

| Evento | Kind / webhook |
|--------|----------------|
| Bridge criada/ativada | `bridge.started`, `webchat.bridge.started` |
| Encerrada | `bridge.closed`, `webchat.bridge.closed` |
| Resposta atendente | `bridge.agent_reply` |
| Forward visitante | `bridge.message_forwarded` |
| Loop bloqueado | `bridge.loop_prevented` |

---

## Atualização da documentação mestre

- `docs/RADARZAP-SISTEMA-COMPLETO.md` §16 expandida.
- `README.md`, `INDICE`, `CHANGELOG`, `SISTEMA-REGISTRO`, `.cursor/rules` → `2.11.99`.

---

## Correções ou ajustes aplicados

1. **`src/utils/webchat-bridge.util.ts`** — estados, idempotência, anti-loop, cross-tenant, alert safety.
2. **`webchat-whatsapp-bridge.service.ts`** — dedupe forward, loop block em reply, eventos audit.
3. **`AttendanceEvent`** — `bridge.message_forwarded`, `bridge.loop_prevented`.
4. Testes `webchat-bridge.util.test.ts`; fallback test ampliado.
5. Versão `2.11.99`.

---

## Testes criados ou atualizados

| Arquivo | Cobertura |
|---------|-----------|
| `webchat-bridge.util.test.ts` | **novo** — estados, dedupe, loop, cross-tenant, alert safe |
| `webchat-whatsapp-fallback.service.test.ts` | sem tokens sensíveis |
| Existentes | `webchat-whatsapp-bridge.util`, `webchat-bridge-webhook`, `webchat-inbox-bridge`, `qa:webchat-wa` |

---

## Gates executados

```bash
npm run typecheck   # OK
npm run build       # OK
npm test            # OK
npm run qa:atendimento:gate  # OK
npm run qa:webchat-wa        # OK
```

Frontend/widget: **não alterado** — build frontend não obrigatório.

---

## Arquivos alterados

- `src/utils/webchat-bridge.util.ts` (novo)
- `src/utils/__tests__/webchat-bridge.util.test.ts` (novo)
- `src/services/webchat/webchat-whatsapp-bridge.service.ts`
- `src/models/AttendanceEvent.ts`
- `src/services/webchat/__tests__/webchat-whatsapp-fallback.service.test.ts`
- `docs/top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md` (novo)
- `docs/RADARZAP-SISTEMA-COMPLETO.md`
- `docs/INDICE-DOCUMENTACAO.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`
- `README.md`, `package.json`, `.cursor/rules/radarzap-v2-system-registry.mdc`

---

## Riscos reduzidos

- Loop alerta→sessão (já existia, documentado).
- Duplicata forward visitante (dedupe 8s).
- Eco mensagem forward como resposta atendente.
- Cross-tenant na ativação bridge.
- Tokens widget em alertas (validado por teste).

---

## Riscos restantes

- QA manual bridge com WA real (`QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`).
- Vários bridges simultâneos exigem prefixo `TK-XXXX`.
- CTA WhatsApp direto no widget limitado.
- Edge cases Baileys em produção.

---

## Decisões pendentes para Benhur

1. Implementar `!responder` dedicado ou manter `TK-XXXX texto`.
2. Botão “Continuar no WhatsApp” explícito no widget para visitante.
3. Persistir dedupe forward em Mongo (hoje memória processo).

---

## Próximo passo recomendado

**TOP 14 — IA Básica profunda:** classificador, KB, encaminhamento WA/WebChat, testes e docs — sem refazer bridge.
