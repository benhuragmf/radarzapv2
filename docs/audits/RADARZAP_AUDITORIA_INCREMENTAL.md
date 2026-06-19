# Auditoria Incremental RadarZap

## Data da auditoria

**2026-06-19** (pós-commit `c978e6d` · versão `2.10.86`)

## Escopo

Auditoria **incremental** focada nas modificações após a auditoria funcional de WhatsApp/Ticket/FAQ (`2.10.75`), cobrindo:

- Confirmação de leitura WebChat (receipts) — widget + Inbox
- Reenvio de token de chamado (WhatsApp, e-mail, OTP 2 etapas)
- Fix consulta token (`publicAccessTokenHash` com `select:false`)
- Fix comando `!encerrarchat` (bridge WA)
- Scripts/docs QA WebChat↔WA
- Checagem global mínima: build, testes, lint, integrações

**Fora do escopo desta rodada:** reauditoria completa de módulos não alterados (billing, campanhas, Discord, Cloud API stub, deploy VPS).

---

## Auditoria anterior encontrada

| Arquivo | Data | Escopo | Uso nesta rodada |
|---------|------|--------|------------------|
| `docs/RADARZAP_WHATSAPP_TICKET_FAQ_AUDIT.md` | 2026-06-19 | Fallback WA, bridge, FAQ, lookup token (2.10.70–2.10.75) | **Base principal** — áreas não modificadas reaproveitadas |
| `docs/QA-FASE1-CHECKLIST.md` | 2026-06-18+ | Gate estabilização Fase 1 | Referência QA manual |
| `SECURITY_AUDIT.md` | 2026-06-09 | Segurança OWASP v2.5.1 | Referência riscos conhecidos (não reauditado linha a linha) |
| `docs/menu-renaming-audit.md` | 2026-06-19 | Menus 2.10.67 | Reaproveitado |
| `SECURITY_CHECKLIST.md` | — | Checklist segurança | Referência |

**Não encontrado:** `AUDITORIA.md`, `docs/audits/*` anterior a este arquivo.

**Baseline Git para incremental:** commit `98b06c3` (feat webchat 2.10.75 — auditoria WA/Ticket/FAQ).

---

## Resumo executivo

O RadarZap v2 continua com **ampla implementação real** (não mock) em Inbox, WebChat, tickets, IA/KB, WhatsApp Baileys, bridge site↔WA e API. As últimas entregas (`2.10.79`–`2.10.86`) **fecham lacunas importantes** (reenvio seguro de token, receipts estilo WhatsApp, fix lookup token).

**Estado técnico automatizado (2026-06-19):**

| Verificação | Resultado |
|-------------|-----------|
| `npm test` | ✅ **388 testes** / 64 suites |
| `npm run build` (backend) | ✅ |
| `npm run build` (frontend) | ✅ (warning chunk > 500 kB) |
| `npm run lint` | ❌ **Falha** — milhares de erros **pré-existentes** no repo (não introduzidos pelos commits recentes) |
| `npm run typecheck` | ⏳ Script não existe no `package.json` |
| QA manual Fase 1 | ⚠️ **Maioria dos itens ainda `[ ]`** em `QA-FASE1-CHECKLIST.md` |
| Gate produção (`ROADMAP-COMPLETUDE.md`) | ❌ **Não atingido** |

**Conclusão para o dono do produto:** código recente está **estruturalmente sólido** (build + testes verdes), mas o sistema **ainda não está pronto para produção** — gate Fase 1 incompleto, QA manual pendente, riscos de OTP in-memory e estabilidade Baileys/Inbox pré-existentes.

---

## Arquivos modificados analisados

Desde `98b06c3..c978e6d` (**35 arquivos**, 9 commits):

| Arquivo / grupo | Impacto | Funcionalidade |
|-----------------|---------|----------------|
| `webchat-message-receipt.service.ts` *(novo)* | Alto | Entrega/leitura outbound; leitura inbound (agente + resposta bot) |
| `WebChatService.ts` | Alto | `appendMessage` + receipts; `getConversationForAgent` otimizado |
| `widget.js` | Alto | UI ✓✓, ACK debounced, patch DOM |
| `InboxMessageBubble.tsx`, `webchatReceipts.ts`, `useWebChatSocket.ts` | Médio | ✓✓ outbound no Inbox + socket |
| `ticket-token-resend-otp.ts` *(novo)* | Alto | OTP 6 dígitos in-memory |
| `ticket-public-access.service.ts` | Alto | Fluxo OTP + reenvio WA/e-mail + fix hash |
| `webchat-public.routes.ts` | Médio | `POST …/message-receipts`, rotas resend OTP |
| `WebChatMessage.ts`, `types/webchat.ts` | Baixo | Campos `deliveredAt`/`readAt` |
| `whatsapp-agent-command.service.ts`, `whatsapp-agent-command.util.ts` | Médio | `!encerrarchat` vs `!encerrar` |
| Testes `ticket-*`, `whatsapp-agent*` | Médio | +11 testes desde 377 |
| Docs `WEBCHAT.md`, `SISTEMA-REGISTRO.md`, QA | Baixo | Documentação parcialmente desatualizada (registro em 2.10.81 vs package 2.10.86) |

---

## Áreas reauditadas vs reaproveitadas

| Área auditada antes | Arquivos/rotas | Modificada? | Ação | Observação |
|---------------------|----------------|-------------|------|------------|
| Fallback WA offline | `webchat-whatsapp-fallback.service.ts` | Parcial | Reauditado parcial | Só doc + menção em `!encerrarchat` |
| Bridge site↔WA | `webchat-whatsapp-bridge.service.ts` | Indireta | Reauditado parcial | Fix `!encerrarchat` em command service |
| Consulta ticket token | `ticket-public-access.service.ts` | **Sim** | **Reauditado** | Fix hash + OTP + reenvio |
| FAQ/KB + links widget | `AiKnowledgeBaseService`, widget FAQ | Não | Reaproveitado | Sem alteração desde 2.10.75 |
| Inbox núcleo WA | `InboxService`, CSAT, triagem | Não | Reaproveitado | Bugs 2.8.x — QA manual pendente |
| WebChat receipts | — | **Sim (novo)** | **Reauditado** | Entrega 2.10.82–2.10.86 |
| OTP reenvio token | — | **Sim (novo)** | **Reauditado** | 2.10.83–2.10.86 |
| Menus / nomenclatura | `navConfig.ts` | Não | Reaproveitado | `menu-renaming-audit.md` |
| Segurança global | `SECURITY_AUDIT.md` | Não | Reaproveitado + spot-check | Achados CSRF/socket ainda relevantes |
| Billing / Discord / Campanhas | vários | Não | Reaproveitado | Sem diff no período |

---

## Mapa do projeto (confirmado no código)

```
radarzapv2/
├── src/
│   ├── index.ts                    # Bootstrap monolito
│   ├── models/                     # MongoDB (Mongoose)
│   ├── services/
│   │   ├── web-dashboard/          # API painel :3001 + frontend React/Vite
│   │   │   ├── DashboardService.ts
│   │   │   ├── frontend/src/       # UI tenant + admin
│   │   │   └── webchat/widget.js   # Widget embed público
│   │   ├── webchat/                # WebChat backend
│   │   ├── inbox/                  # Inbox, tickets, CSAT, comandos WA
│   │   ├── whatsapp/               # Baileys
│   │   ├── ai/                     # IA + KB
│   │   ├── integrations/           # API keys, webhooks outbound
│   │   └── queue/                  # BullMQ processors
│   ├── auth/rbac/                  # Capabilities
│   └── types/
├── docs/                           # Módulos, roadmap, QA
└── scripts/                        # qa-prep, qa-webchat-wa-setup
```

| Módulo | Localização principal |
|--------|----------------------|
| Inbox | `InboxService.ts`, `frontend/.../Inbox.tsx` |
| Widget | `webchat/widget.js`, `WebChatService.ts` |
| Tickets | `InboxTicket`, `ticket-public-access.service.ts` |
| FAQ/IA | `AiKnowledgeBaseService`, `WebChatAiService`, `AiAtendimento.tsx` |
| WhatsApp | `WhatsAppService.ts`, bridge/fallback services |
| Permissões | `auth/rbac/capabilities.ts`, `ProtectedRoute.tsx` |
| Realtime | Socket.IO em `DashboardService`, `WebChatRealtime.ts` |

---

## Integrações — status funcional

| Integração | Existe no código? | Funcional? | Mock? | Falhas / riscos |
|------------|:-----------------:|:----------:|:-----:|-----------------|
| WhatsApp Baileys | ✅ | 🟡 Parcial | Não | Instabilidade conhecida; Cloud API stub |
| WebChat widget | ✅ | 🟡 Parcial | Não | Receipts novos — QA visual pendente |
| Inbox painel | ✅ | 🟡 Parcial | Não | QA Fase 1 incompleto |
| Atendimento IA | ✅ | 🟡 Parcial | Não | Lentidão LLM percebida; sem SLA |
| Tickets + token público | ✅ | ✅ | Não | OTP in-memory — risco prod |
| FAQ/KB no chat | ✅ | ✅ | Não | Sem categorias |
| WA fallback offline | ✅ | 🧪 | Não | QA manual `[ ]` |
| Bridge site↔WA | ✅ | 🧪 | Não | QA manual `[ ]` |
| Webhooks outbound | ✅ | ✅ | Não | — |
| Auth OAuth + RBAC | ✅ | ✅ | Não | Ver SECURITY_AUDIT |
| OTP reenvio token | ✅ | 🟡 | Não | In-memory; pepper default |

Legenda: ✅ confirmado no código/testes · 🟡 parcial · 🧪 precisa teste real · ❌ quebrado

---

## Erros encontrados por gravidade

### Crítico

| Área | Problema | Evidência | Impacto | Correção sugerida |
|------|----------|-----------|---------|-------------------|
| — | *Nenhum crítico novo detectado nesta rodada* | Build + testes verdes | — | — |

> **Nota:** Gate Fase 1 e estabilidade Baileys/Inbox são **bloqueadores de produção**, classificados como riscos operacionais (§ Riscos), não bugs de compilação.

### Alto

| Área | Problema | Evidência | Impacto | Correção sugerida |
|------|----------|-----------|---------|-------------------|
| OTP reenvio | Store **in-memory** (`Map`) — perde estado no restart e **não funciona em multi-instância** | `ticket-token-resend-otp.ts` L23–24 | OTP inválido após deploy/restart; falha com 2+ pods | Migrar OTP para Redis com TTL |
| OTP reenvio | `TICKET_OTP_PEPPER` com default hardcoded | `ticket-token-resend-otp.ts` L8–9 | HMAC previsível se env não configurado | Exigir env em prod; falhar boot sem pepper |
| Receipts | **Sem testes unitários** do serviço de receipts | Ausência em `__tests__/` | Regressão silenciosa em ✓✓ | Criar `webchat-message-receipt.service.test.ts` |
| QA / Prod | Gate estabilização **não cumprido** | `ROADMAP-COMPLETUDE.md` § Gate | Release prematura | Executar `QA-FASE1-CHECKLIST.md` § A–C |
| Inbox socket | `useWebChatSocket` faz **patch + invalidate** no mesmo receipt | `useWebChatSocket.ts` L107–117 | Refetch desnecessário; lentidão percebida | Remover `invalidateQueries` após `setQueryData` |
| Dados legados | Mensagens inbound **antes de 2.10.86** sem `deliveredAt` | `appendMessage` só seta em inbound novo | ✓✓ ausente em histórico antigo | Script backfill opcional ou aceitar só mensagens novas |
| Segurança (herdado) | GET `/sessions/:id/connect` mutável (CSRF) | `SECURITY_AUDIT.md` §3 | Link externo inicia WA | POST + token anti-CSRF |

### Médio

| Área | Problema | Evidência | Impacto | Correção sugerida |
|------|----------|-----------|---------|-------------------|
| API pública | `POST /sessions/message-receipts` **sem rate limit** dedicado | `webchat-public.routes.ts` L240 | Spam de `updateMany` | Rate limit por visitorToken/IP |
| Receipts | `markInboundReadOnTeamReply` fire-and-forget com `.catch(() => {})` | `WebChatService.ts` L1486 | Erros silenciosos | Log warn mínimo |
| Receipts | `getConversationForAgent` zera `unreadAgentCount` **antes** de `markInboundReadByAgent` | `WebChatService.ts` L1331–1336 | Unread zerado se mark falhar | Ordem transacional ou revert |
| Código morto | `hasVisitorSocketInConversation` exportado e **não usado** | `WebChatRealtime.ts` L30 | Confusão manutenção | Remover ou reutilizar |
| Docs | `SISTEMA-REGISTRO.md` em **2.10.81** vs `package.json` **2.10.86** | diff docs | Drift documentação | Atualizar changelog |
| Lint | `npm run lint` falha (milhares de erros) | exit code 1, ~786k chars output | CI/local inconsistente | Plano incremental lint ou relax rules |
| Performance | Bundle JS **1.66 MB** gzip 441 kB | `vite build` warning | TTI lento no painel | Code-splitting |
| Testes | Jest: *worker failed to exit gracefully* | saída `npm test` | Possível leak timers | `--detectOpenHandles` |
| UX receipts | Sem estado “enviando” (só ✓ após servidor) | widget inbound | Expectativa WhatsApp | Opcional: tick pendente local |

### Baixo

| Área | Problema | Evidência | Impacto | Correção sugerida |
|------|----------|-----------|---------|-------------------|
| Widget | `WIDGET_BUILD` manual — fácil esquecer bump | `widget.js` | Cache CDN/browser | CI check versão = package.json |
| npm | Warning `Unknown env config "devdir"` | saída npm | Ruído | Ajustar `.npmrc` local |
| E2E | Playwright existe mas **não executado** nesta auditoria | `package.json` scripts | Cobertura UI limitada | Rodar `npm run test:e2e` em CI |
| Registro cursor | `.cursor/rules/radarzap-v2-system-registry.mdc` desatualizado vs 2.10.86 | regra workspace | Agente desinformado | Sync changelog |

---

## Melhorias recomendadas

### Rápidas (baixo risco)

| # | Melhoria | Prioridade |
|---|----------|------------|
| 1 | Remover `invalidateQueries` redundante em `useWebChatSocket` onReceipt | Alta |
| 2 | Exigir `TICKET_OTP_PEPPER` em `NODE_ENV=production` | Alta |
| 3 | Rate limit em `message-receipts` | Média |
| 4 | Atualizar `SISTEMA-REGISTRO.md` + regra cursor para 2.10.86 | Baixa |
| 5 | Remover `hasVisitorSocketInConversation` se não for usar | Baixa |

### Importantes (estabilidade / UX)

| # | Melhoria | Prioridade |
|---|----------|------------|
| 1 | OTP reenvio em **Redis** (TTL 10 min) | Alta |
| 2 | Testes unitários receipts + integração widget ACK | Alta |
| 3 | Executar QA manual completo (`qa:webchat-wa:setup` + checklist) | Alta |
| 4 | Backfill `deliveredAt` mensagens inbound antigas (opcional) | Média |
| 5 | Índice composto `{ conversationId, direction, readAt }` se queries receipts crescerem | Média |

### Estratégicas (produto / competitividade)

| # | Melhoria |
|---|----------|
| 1 | Completar gate Fase 1 antes de qualquer VPS |
| 2 | Camada `WhatsAppProvider` (Baileys + Cloud API) |
| 3 | Métricas SLA + relatórios atendimento unificados (site + WA) |
| 4 | Notificações push/browser consolidadas |
| 5 | CI com lint incremental + e2e smoke nas rotas `/platform/inbox` e widget preview |
| 6 | Categorias FAQ + versionamento conteúdo KB |

---

## Riscos para produção

1. **Gate Fase 1 aberto** — CSAT, triagem IA, tickets antigos não validados em QA recente.
2. **Baileys** — dependência não oficial; sessões podem cair; bridge depende de celular do atendente.
3. **OTP in-memory** — inviável em deploy com restart horizontal.
4. **Presença agente in-memory** — `inbox-agent-presence.ts` Map local (já documentado na auditoria 2.10.75).
5. **Achados SECURITY_AUDIT** não totalmente resolvidos (CSRF connect WA, backup PII).
6. **Lint vermelho** — qualidade inconsistente; risco de regressões não detectadas.
7. **Cloud API Meta** — stub; clientes que exigem API oficial não podem ir a prod só com Baileys.

---

## Checklist técnico

| Item | Status | Notas |
|------|--------|-------|
| Build backend | ✅ OK | `npm run build` 2026-06-19 |
| Build frontend | ✅ OK | Warning chunk size |
| Lint | ❌ Problema | Pré-existente, escopo `src/**/*.ts` |
| Typecheck | ⏳ Não verificado | Sem script dedicado; coberto por `tsc` no build |
| Testes unitários | ✅ OK | 388 passed |
| Testes e2e | 🧪 Precisa teste real | Não executado nesta auditoria |
| Rotas painel | ⚠️ Atenção | Protegidas por sessão+RBAC; QA manual pendente |
| API WebChat pública | ⚠️ Atenção | Origin check ✅; rate limit parcial |
| Banco / models | ✅ OK | `WebChatMessage` com receipts; índice `{conversationId, createdAt}` |
| Permissões | ✅ OK | Padrão `requireCapability` mantido |
| Inbox | 🧪 Precisa teste real | Receipts outbound novos |
| Chat / Widget | 🧪 Precisa teste real | ✓✓ 2.10.86 — validar hard refresh |
| WhatsApp | 🧪 Precisa teste real | Bridge/fallback checklist `[ ]` |
| Tickets | ⚠️ Atenção | OTP OK em testes; prod precisa Redis |
| FAQ/IA | ✅ OK | Sem regressão detectada |
| Responsividade | ⏳ Não verificado | Sem Playwright nesta rodada |
| Segurança | ⚠️ Atenção | OTP pepper; SECURITY_AUDIT pendências |
| Documentação | ⚠️ Atenção | WEBCHAT.md atualizado; SISTEMA-REGISTRO defasado |

---

## Comandos executados

| Comando | Resultado | Erro | Gravidade | Como corrigir |
|---------|-----------|------|-----------|---------------|
| `git log -n 30` | ✅ | — | — | — |
| `git diff 98b06c3..HEAD --name-only` | ✅ 35 arquivos | — | — | — |
| `npm test` | ✅ 388/388 | Worker leak warning | Baixo | detectOpenHandles |
| `npm run build` | ✅ | — | — | — |
| `npm run build --prefix .../frontend` | ✅ | Chunk > 500kB | Baixo | code-split |
| `npm run lint` | ❌ | Milhares erros ESLint | Médio | Plano lint |
| `npm run typecheck` | ⏳ N/A | Script inexistente | — | Adicionar ou usar build |
| `npm run test:e2e` | ⏳ N/A | Não executado | — | Rodar em CI/local |
| `npm run dev` | ⏳ N/A | Já rodando no ambiente user | — | — |

---

## Auditoria funcional (por código — não runtime completo)

### WebChat receipts (NOVO — reauditado)

| Fluxo | Status código | Observação |
|-------|---------------|------------|
| Inbound nasce com `deliveredAt` | ✅ | `appendMessage` L1440 |
| Bot responde → inbound `readAt` | ✅ | `markInboundReadOnTeamReply` |
| Atendente abre Inbox → inbound `readAt` | ✅ | Só se `unreadAgentCount > 0` |
| Visitante ACK outbound delivered/read | ✅ | `POST message-receipts` |
| Widget patch DOM ticks | ✅ | `patchInboundReceiptMeta` |
| Inbox ✓✓ outbound | ✅ | `InboxMessageBubble` + socket |

### OTP reenvio token (NOVO — reauditado)

| Fluxo | Status | Observação |
|-------|--------|------------|
| Request OTP anti-enumeração | ✅ | Mensagem genérica sempre |
| Match contato ticket | ✅ | Testes em `ticket-public-access.service.test.ts` |
| Verify OTP 6 dígitos | ✅ | Max 5 tentativas |
| Rate limit IP/client | ✅ | `ticket-public-lookup-rate-limit.ts` |
| Rotação token após OTP | ✅ | `confirmTicketTokenResendOtp` |
| Persistência OTP | ❌ prod | In-memory only |

### Demais fluxos (reaproveitados — ver auditoria 2.10.75)

Consulta TK+token, FAQ chips, fallback WA, `!assumir`, bridge — implementação confirmada na auditoria anterior; **QA manual ainda pendente** no checklist.

---

## Auditoria visual / UX (estática)

| Página/Rota | Status | Problemas | Melhorias |
|-------------|--------|-----------|-----------|
| Widget preview | 🧪 | ✓✓ depende cache widget | Hard refresh; testar Obsidian/Luxe |
| `/platform/inbox` | 🧪 | Receipts outbound novos | Validar ✓ cinza/azul em tema claro/escuro |
| Widget fluxo OTP token | 🧪 | 3 steps (resend→otp→token) | Confirmar feedback erro OTP |
| Demais rotas § B checklist | ⏳ | Não re-testadas visualmente | Seguir QA-FASE1 |

---

## Próximas ações recomendadas

1. ~~**Corrigir altos:** OTP → Redis; pepper obrigatório; testes receipts; otimizar socket receipt handler.~~ ✅ **2.10.87**
2. **QA manual:** executar `npm run qa:webchat-wa:setup` + `QA-FASE1-CHECKLIST.md` § A + § C.2
3. **Backfill histórico:** `npm run backfill:webchat-delivered` (mensagens inbound antigas)
4. **Gate automatizado:** `npm run qa:gate` (test + build backend + frontend)
5. **Planejar lint:all** incremental — `npm run lint:all` ainda reporta dívidas legadas; `npm run lint` cobre módulos auditados

---

## Correções aplicadas (2.10.87)

| Achado | Status |
|--------|--------|
| OTP in-memory | ✅ Redis + fallback memória só em test |
| TICKET_OTP_PEPPER | ✅ Obrigatório em produção (`validateConfig`) |
| Testes receipts | ✅ `webchat-message-receipt.service.test.ts` |
| Gate Fase 1 (automático) | ✅ `npm run qa:gate` + ROADMAP atualizado |
| useWebChatSocket refetch | ✅ Removido invalidate redundante |
| Backfill deliveredAt | ✅ Script `backfill:webchat-delivered` |
| CSRF GET connect | ✅ Sempre 405 (dev incluído) |
| Rate limit receipts | ✅ `webchat-message-receipt-rate-limit.ts` |
| markInboundReadOnTeamReply silent | ✅ Log warn |
| getConversationForAgent ordem | ✅ Marca lido antes de zerar unread |
| hasVisitorSocketInConversation | ✅ Removido |
| SISTEMA-REGISTRO / cursor registry | ✅ 2.10.87 |
| Lint | ✅ `npm run lint` verde (escopo módulos auditados); `lint:all` legado |
| Bundle chunk | ✅ manualChunks no Vite |
| Jest worker leak | ✅ `forceExit: true` |
| UX tick inbound | ✅ Fallback deliveredAt em pushChatMessages |
| WIDGET_BUILD sync | ✅ `prebuild` + `sync:widget-build` |
| npm devdir | ⚠️ Config global do usuário (~/.npmrc) — fora do repo |
| E2E | ✅ Já no CI (`.github/workflows/ci.yml`) |

---

## Referências

- `docs/RADARZAP_WHATSAPP_TICKET_FAQ_AUDIT.md` — auditoria base 2.10.75
- `docs/RADARZAP_WHATSAPP_TICKET_FAQ_IMPLEMENTATION.md`
- `docs/WEBCHAT.md` — receipts 2.10.86
- `docs/ROADMAP-COMPLETUDE.md`
- `docs/QA-FASE1-CHECKLIST.md`
- `SECURITY_AUDIT.md`

---

*Gerado por auditoria incremental estática + comandos automatizados. Revisar após QA manual.*
