# RadarZap — TOP 12/20 — WhatsApp, Sessão, QR, Reconexão e Comandos

**Data:** 2026-06-24  
**Versão após TOP 12:** `2.11.98`  
**Branch:** `main`

---

## Resumo executivo

O TOP 12 consolidou o **WhatsApp profundo** como canal operacional Baileys: sessão por organização com credenciais criptografadas, QR protegido por RBAC, reconexão com backoff documentada, inbound/outbound integrados à Inbox, comandos `!` para equipe autorizada, rate limit e envio humanizado alinhados à tabela oficial, segurança multi-tenant validada por helpers/testes, Cloud API documentada como stub 503, e **documentação mestre** `RADARZAP-SISTEMA-COMPLETO.md` criada (pendência herdada do TOP 11).

Não foi implementada Bridge completa (TOP 13), IA profunda (TOP 14/15), créditos IA (TOP 16) nem billing novo (TOP 17). Produção não declarada pronta.

---

## Herança dos TOPs anteriores

### TOP 01

WhatsApp via Baileys maduro; Cloud API ausente/stub; sessão por org; inbound → Inbox; comandos `!assumir`, `!ticket`, `!encerrar`, `!ajuda`; riscos: instabilidade Baileys, reconexão, multiempresa, rate limit.

### TOP 02

Baseline técnico verde (`typecheck`, `build`, `test`, `qa:atendimento:gate`).

### TOP 03

`messagesPerDay`, `whatsappDestinations` na matriz — enforcement billing completo fora de escopo.

### TOP 04

`WHATSAPP_SESSION_VIEW` / `WHATSAPP_SESSION_MANAGE`; atendente comum não conecta WA da empresa.

### TOP 05

Fila/atribuição só para `online`; capacidade simultânea por plano.

### TOP 06

Modos `disabled`/`robotic`/`basic_triage`/`premium_assistant`/`hybrid` no pipeline WA.

### TOP 07

Inbox unificada; fila, transferência, round-robin — não refeito.

### TOP 08

Tickets `TK-…`, token, janela 12h, `!nota` interna — não refeito.

### TOP 09

Contato sempre no inbound; lead só intenção comercial; `oi` não cria lead.

### TOP 10

Formulários públicos preservados.

### TOP 11

WebChat fechado; fallback widget deferido; Bridge completa → TOP 13.

### Pendência documental

`docs/RADARZAP-SISTEMA-COMPLETO.md` **não existia** antes do TOP 12 — criado nesta etapa. README e índice atualizados.

### Esta etapa fecha

Sessão, QR, reconexão, inbound/outbound WA, comandos, rate limit/humanizado, segurança multi-tenant, helpers/testes, doc mestre.

### Esta etapa não faz

Bridge completa (TOP 13), IA profunda (14/15), créditos (16), billing (17), Cloud API real, produção pronta.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `02c8feb` — `chore(top): webchat widget e fallback 2.11.97` |
| Modificados antes | Nenhum (working tree limpo) |
| Untracked (não commitar) | `data/`, `mocker/modelochat/` |
| Risco | Baixo |

---

## Escopo autorizado

Sessão WA, QR, status, reconexão, persistência, inbound/outbound, comandos `!`, rate limit, envio humanizado, fila envio, segurança org, Inbox WA, integração tickets/leads/contatos (sem refazer TOP 08/09), testes, documentação consolidada.

---

## Diagnóstico atual do WhatsApp

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Serviço WhatsApp | Sim | `WhatsAppService.ts` | Baileys, ~4k linhas, núcleo canal |
| Baileys | Sim | `@whiskeysockets/baileys` | Canal padrão |
| Sessão por organização | Sim | `clientId` = org id | Map `sessions`, lock único |
| QR Code | Sim | `connection.update` + `QRCODE_UPDATED` | Base64 ao painel via WS |
| Status da sessão | Sim | cache + `liveStateToStatus` | Mapeado para produto em `whatsapp-session.util.ts` |
| Reconexão | Sim | `reconnectingClients`, backoff | `manualDisconnect` bloqueia auto-reconnect |
| Persistência credenciais | Sim | `WhatsAppSession.ts` | AES `SESSION_ENCRYPTION_KEY` |
| Inbound | Sim | `message.upsert` → `InboxService` | Contato, conversa, modos, comandos |
| Outbound | Sim | fila BullMQ + `sendOperationalTextMessage` | Humanizado + rate limit |
| Rate limit | Sim | `whatsapp-session-rate-limit.ts` | 10/min conversa, 2/min marketing |
| Envio humanizado | Sim | `whatsapp-human-send.util.ts` | typing delay + jitter |
| Comandos | Sim | `whatsapp-agent-command.*` | Equipe com `INBOX_REPLY` + WA verificado |
| Inbox | Sim | `InboxService.ts` | Integração WA nativa |
| Contatos | Sim | `Destination` no inbound | Dedupe telefone |
| Leads | Sim | `maybeCaptureWhatsAppInbound` | Sem lead em `oi` genérico |
| Tickets | Sim | `whatsapp-agent-command.service.ts` | `!ticket`, `!nota`, `!abrir` |
| Eventos painel | Sim | `emitPanelEvent`, WS sessão | Sem QR em logs |
| Logs/auditoria | Sim | `AttendanceEvent`, logs envio | |
| Segurança multiempresa | Sim | RBAC + `assertWhatsappSessionClientMatch` | APIs filtram org |
| Cloud API stub | Sim | `DashboardService.ts` L339–366 | HTTP 503 explícito |
| Testes | Sim | múltiplas suites | + `whatsapp-session.util.test.ts` TOP 12 |

---

## Diagnóstico de sessão e QR

| Aspecto | Implementação |
|---------|----------------|
| Criação sessão | `POST /api/sessions/:id/connect` → `WhatsAppService.connectClient` |
| Armazenamento QR | Memória runtime + evento `QRCODE_UPDATED` (não persiste string QR em Mongo) |
| Emissão painel | WebSocket / polling `connectionState` |
| Quem vê QR | `Cap.WHATSAPP_SESSION_MANAGE` + `requireSelfOrStaff` |
| Associação org | `:id` = `clientId` da organização |
| Credenciais | `WhatsAppSession.sessionData` criptografado |
| Criptografia | `SESSION_ENCRYPTION_KEY` obrigatória em prod |
| QR em log | Proibido — helper `isWhatsappQrLogSafe` |
| Desconectar | `POST .../disconnect` → `manualDisconnect: true` |
| Limpar sessão | `DELETE .../logout` remove credenciais |
| Status painel | `connected` \| `disconnected` \| `connecting` \| `qr-required` |
| Status produto | `normalizeWhatsappSessionStatus` → `qr_pending`, `reconnecting`, etc. |
| Isolamento org | Sessão keyed por `clientId`; APIs com auth tenant |

---

## Diagnóstico de reconexão

| Aspecto | Comportamento |
|---------|---------------|
| `connection.update` | Tratado em `WhatsAppService` — open/close/connecting |
| Auto-reconnect | Sim, com `reconnectAttempts` e timer |
| Logout real | `statusReason` 401/403/428 → `logged_out` |
| `manualDisconnect` | Impede reconexão automática |
| Backoff | Incremental por tentativas |
| Servidor reinicia | `restoreSessionsOnBoot` reconecta orgs com credenciais |
| Painel | Evento `CONNECTION_UPDATE`; flag `reconnecting` no helper |
| Risco | Baileys instável — QA manual necessário antes de prod |

---

## Diagnóstico de inbound WhatsApp

Fluxo: **mensagem WA** → normalização telefone → `Destination` → conversa Inbox → (comando equipe **ou** pipeline modo atendimento) → fila/ticket/lead.

| Regra | Status |
|-------|--------|
| Telefone normalizado | Sim (`brazilPhoneLookupVariants`, etc.) |
| Contato criado/atualizado | Sim |
| Conversa encontrada/criada | Sim |
| Tenant correto | Sim (`clientId` da sessão) |
| Comandos equipe separados | Sim — `resolveAuthorizedWhatsappAgent` |
| `disabled` → fila | Sim |
| `robotic` → menu | Sim |
| `basic_triage` | Sim — classificador local |
| `premium_assistant` | Sim — gate IA + fallback fila |
| `hybrid` | Sim |
| Lead só comercial | Sim — teste `lead-whatsapp-inbound.test.ts` |
| Ticket TOP 08 | Sim — comandos + menu cliente |

---

## Diagnóstico de outbound WhatsApp

| Origem | Caminho |
|--------|---------|
| Atendente painel | Inbox reply → fila envio |
| Bot/IA | Triagem/automação → `conversation` kind |
| Campanha | `marketing` kind, 2/min |
| Ticket | Envio via janela ticket |
| Comando | Resposta operacional equipe |
| Mídia | Suportado no serviço |
| Erro | Falha registrada; sem vazar stack ao cliente |
| Rate limit | `getMaxPerMinuteForKind` + política admin/org |
| Delay | `computeHumanTypingMs` + composing |

---

## Diagnóstico de comandos WhatsApp

| Comando | Existe? | Quem pode usar | O que faz | Risco |
|---------|---------|----------------|-----------|-------|
| `!assumir` | Sim | Equipe WA verificada + `INBOX_REPLY` | Assume conversa/bridge | Baixo se auth OK |
| `!ticket` | Sim | Equipe | Consulta/cria ticket | Médio — token |
| `!token` | Sim | Equipe | Token ticket | Baixo |
| `!nota` | Sim | Equipe | Nota interna TK | **Alto** se vazar — mitigado |
| `!abrir` | Sim | Equipe | Abre TK com motivo | Baixo |
| `!abertos` | Sim | Equipe | Lista abertos | Baixo |
| `!meus` | Sim | Equipe | Meus tickets | Baixo |
| `!encerrar` | Sim | Equipe | Encerra atendimento | Médio |
| `!encerrarchat` | Sim | Equipe | Encerra chat | Médio |
| `!ajuda` | Sim | Equipe | Lista comandos | Baixo |
| Cliente `!assumir` | Bloqueado | — | Ignorado | Mitigado por auth |
| `!transferir` | Não | — | Usar painel Inbox | — |
| `!status` | Não | — | — | — |

Parser: `whatsapp-agent-command.util.ts`. Execução: `whatsapp-agent-command.service.ts`. Auth: `whatsapp-agent-auth.service.ts`.

---

## Diagnóstico de rate limit e envio humanizado

| Tipo | Limite código | Jitter |
|------|---------------|--------|
| `conversation` | 10/min | 4–8s |
| `marketing` | 2/min | 25–35s |
| `alert` | 30/min | mínimo |

Política configurável: `/admin/whatsapp-send-policy`, `/platform/whatsapp-send-limits`.

Humanizado: `computeHumanTypingMs` — proporcional ao texto, desligável por política.

Testes: `whatsapp-session-rate-limit.test.ts`, `whatsapp-human-send.util.test.ts`.

`messagesPerDay` plano: documentado TOP 03; enforcement billing → TOP 17.

---

## Diagnóstico de Inbox, Contatos, Leads e Tickets no WhatsApp

### Inbox

Inbound na lista unificada; fila e presença TOP 05/07; eventos WS.

### Contatos

Todo inbound atualiza `Destination`; dedupe por telefone na org.

### Leads

`maybeCaptureWhatsAppInbound`: não cria em `oi` genérico; cria com intenção comercial.

### Tickets

`!ticket`, menu bot, janela 12h; notas internas não ao cliente.

---

## Diagnóstico de segurança multiempresa

| Controle | Status |
|----------|--------|
| Sessão por org | Sim |
| QR só com permissão | Sim |
| APIs `/sessions/*` | `requireCapability` + tenant |
| Comandos | `clientId` da sessão WA |
| Cross-tenant | `assertWhatsappSessionClientMatch` + testes RBAC |
| Logs sem segredo | `isWhatsappQrLogSafe` |

---

## Diagnóstico de WhatsApp Cloud API

- Rotas `/api/integrations/whatsapp/cloud/webhook` (GET/POST).
- GET: verificação token opcional; senão **503** com mensagem clara.
- POST: **503** ingestão pendente.
- **Não implementado** — Fase 2 roadmap / enterprise.
- Canal operacional: **Baileys apenas**.

---

## Regras oficiais de sessão

Ver tabela status produto no prompt TOP 12. Mapeamento em `normalizeWhatsappSessionStatus`.

1. Uma sessão ativa por organização (lock).
2. QR só para `WHATSAPP_SESSION_MANAGE`.
3. Credenciais criptografadas em repouso.
4. Desconectar manual invalida auto-reconnect.
5. Logout remove credenciais.

---

## Regras oficiais de inbound

1. Resolver org da sessão.
2. Normalizar telefone.
3. Criar/atualizar contato.
4. Criar/encontrar conversa.
5. Comando equipe antes de automação cliente.
6. Modo atendimento conforme TOP 06.
7. Lead só comercial (TOP 09).
8. Fila se sem atendente `online`.

---

## Regras oficiais de outbound

1. Verificar org e destino.
2. Consentimento quando aplicável (campanhas).
3. Rate limit por `sendKind`.
4. Humanizado quando política ativa.
5. Registrar na Inbox.
6. Erro seguro ao usuário.

---

## Regras oficiais de comandos

1. Apenas equipe com WA verificado na org.
2. `INBOX_REPLY` mínimo.
3. Cliente comum não executa.
4. Comando inválido → silêncio ou ajuda (`!ajuda`).
5. Notas internas nunca ao número do cliente.

---

## Regras oficiais de rate limit

| Fluxo | Limite |
|-------|--------|
| Conversa/atendimento | 10/min |
| Marketing/campanha | 2/min |
| Alerta operacional | 30/min |
| Comandos equipe | sem spam dedicado |
| IA/bot | fila + delay curto |

---

## Consolidação documental do sistema

| Arquivo | Status | Ação |
|---------|--------|------|
| `docs/RADARZAP-SISTEMA-COMPLETO.md` | **criado** | documentação principal |
| `README.md` | atualizado | aponta para doc mestre |
| `docs/INDICE-DOCUMENTACAO.md` | atualizado | leitura principal |
| `docs/CHANGELOG.md` | atualizado | 2.11.98 |
| `docs/SISTEMA-REGISTRO.md` | atualizado | registro |
| `.cursor/rules/radarzap-v2-system-registry.mdc` | atualizado | espelho |
| `docs/top/*` | preservado | auditoria TOP |

---

## Correções ou ajustes aplicados

1. **`src/types/whatsapp-session.util.ts`** — status produto, RBAC helpers, sanitização outbound, cross-tenant, QR log-safe.
2. **`isWhatsappTeamCommand`** em `whatsapp-agent-command.util.ts` (restaurado `isWhatsappListOpenCommand` após edição acidental).
3. Testes `whatsapp-session.util.test.ts` e ampliação `whatsapp-agent-command.util.test.ts`.
4. Documentação mestre e TOP 12.
5. Versão `2.11.98`.

Sem alteração de Bridge, IA profunda ou billing.

---

## Testes criados ou atualizados

| Arquivo | Cobertura |
|---------|-----------|
| `src/types/__tests__/whatsapp-session.util.test.ts` | **novo** — status, RBAC, sanitize, cross-tenant |
| `src/utils/__tests__/whatsapp-agent-command.util.test.ts` | `isWhatsappTeamCommand` |
| Existentes preservados | `whatsapp-session-rate-limit`, `whatsapp-human-send`, `WhatsAppService`, `lead-whatsapp-inbound`, integrações inbox |

---

## Gates executados

```bash
npm run typecheck   # OK
npm run build       # OK
npm test            # OK — 119 suites, 695 testes
npm run qa:atendimento:gate  # OK — 24 suites gate + qa:webchat-wa + qa:prep
```

Frontend: **não alterado** nesta etapa — build frontend não obrigatório.

---

## Arquivos alterados

- `src/types/whatsapp-session.util.ts` (novo)
- `src/types/__tests__/whatsapp-session.util.test.ts` (novo)
- `src/utils/whatsapp-agent-command.util.ts`
- `src/utils/__tests__/whatsapp-agent-command.util.test.ts`
- `docs/top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md` (novo)
- `docs/RADARZAP-SISTEMA-COMPLETO.md` (novo)
- `docs/INDICE-DOCUMENTACAO.md`
- `docs/CHANGELOG.md`
- `docs/SISTEMA-REGISTRO.md`
- `README.md`
- `package.json`
- `.cursor/rules/radarzap-v2-system-registry.mdc`

---

## Riscos reduzidos

- Status sessão documentado e testável (produto vs cache).
- Cross-tenant explícito em helper.
- QR/credenciais marcados como não logáveis.
- Comandos equipe com helper `isWhatsappTeamCommand`.
- Cloud API não confundida com Baileys (503 documentado).
- Documentação fragmentada reduzida com doc mestre.

---

## Riscos restantes

- Instabilidade Baileys em produção (reconexão real depende de rede/Meta).
- QA manual sessão/QR antes de go-live.
- `messagesPerDay` sem enforcement billing completo.
- Bridge parcial — comportamento edge cases TOP 13.
- Cloud API não implementada.

---

## Decisões pendentes para Benhur

1. Prioridade Cloud API vs estabilização Baileys em prod.
2. Expor status `reconnecting` no painel com label PT-BR explícito.
3. Implementar `!transferir` / `!status` no WA ou manter só painel.
4. Limite `messagesPerDay` hard-stop antes do TOP 17.

---

## Próximo passo recomendado

**TOP 13 — Bridge WebChat ↔ WhatsApp completa:** assumir atendimento bidirecional, sync mensagens site↔WA, alertas fallback, testes E2E bridge, sem reabrir TOP 12 sessão básica.
