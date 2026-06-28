# RadarZap — TOP 15/20 — IA Premium, Base de Conhecimento e Handoff

**Data:** 2026-06-24  
**Versão após TOP 15:** `2.12.1`  
**Branch:** `main`

---

## Resumo executivo

O TOP 15 consolidou a **IA Premium** como assistente generativo controlado (não chat livre): gate central (`premium-ai.util.ts`), limites de resposta por canal, sanitização anti-segredo, handoff pré-chamada para assuntos sensíveis/pedido humano, auditoria `ai.premium.*`, integração WebChat (`WebChatAiService`) e WhatsApp (`InboxService.sendAiReply` + `AiConversationService` existente), preservando IA Básica (TOP 14), Bridge (TOP 13) e gates de crédito existentes.

Recarga/compra de créditos → TOP 16. Billing enforcement → TOP 17.

---

## Herança dos TOPs anteriores

| TOP | Herança relevante para IA Premium |
|-----|-----------------------------------|
| 01 | IA Premium parcial; risco custo sem gate; produto = KB + handoff |
| 03 | Créditos por plano (Free 0 … Enterprise 12000); validar gate, não recarga |
| 04 | RBAC: configurar IA exige permissão; atendente não altera provider |
| 05 | Fallback fila: só `online` recebe auto; limites por plano |
| 06 | Modos: `premium_assistant`, `hybrid`; `basic_triage` ≠ Premium |
| 07 | Fallback humano via Inbox/fila |
| 08 | TK: orientar consulta; não expor token/nota interna |
| 09 | Lead só intenção comercial segura |
| 11 | WebChat: fila, widget estável, `effectiveWebChatPremiumAi` |
| 12 | WA: comandos `!` antes da IA; rate limit humanizado |
| 13 | Bridge: `whatsappBridgeActive` pula automação visitante |
| 14 | IA Básica = triagem; Premium = generativo com KB |

### Documentação mestre

`RADARZAP-SISTEMA-COMPLETO.md` §18 atualizada.

### Esta etapa fecha

Gate Premium, KB/FAQ diagnóstico, prompts/políticas, créditos/uso, WA/WebChat Premium, bridge skip, handoff, segurança, testes, eventos.

### Esta etapa não faz

Recarga IA Créditos (16), billing (17), RAG grande novo, produção declarada pronta.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `ded5034` — `chore(top): ia basica triagem e encaminhamento 2.12.0` |
| Modificados antes | Nenhum (working tree limpo) |
| Untracked | `data/`, `mocker/modelochat/` (não commitar) |
| Risco | Misturar assets locais — excluídos do commit |

---

## Escopo autorizado

IA Premium, assistente generativo, KB/FAQ, provider/credencial, prompt/política, gate crédito, metering, fallback/handoff, WebChat/WA Premium, `premium_assistant`/`hybrid`, segurança anti-alucinação, testes, documentação.

---

## Diagnóstico atual da IA Premium

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Serviço IA Premium WA | Sim | `AiConversationService.ts` | Inbox BOT_TRIAGE + gate créditos |
| WebChat IA | Sim | `WebChatAiService.ts` | `generateVisitorReply` + auto-resolve |
| Provider | Sim | `AiProviderService.ts` | OpenAI/Gemini/RadarZap/company |
| Credencial | Sim | `AiSettingsService` + org | `resolveApiKey` criptografada |
| Prompt | Sim | `AiPromptBuilderService.ts` | Por empresa + blueprint global |
| Base conhecimento | Sim | `AiKnowledgeBaseService` | Artigos/chunks |
| FAQ | Sim | `AiAutoResolveService.ts` | Antes do LLM quando habilitado |
| Contexto conversa | Sim | `AiContextService`, thread WebChat | Contato + histórico |
| Gate modo | Sim | `attendance-mode.ts` | `modeUsesPremiumAiChain` |
| Gate crédito | Sim | `AiUsageMeterService.ts` | WA inbound; WebChat no provider |
| Metering | Sim | `AiUsage` + `creditWeight` | `usageKind` premium vs básica |
| Fallback | Sim | `AiEscalationService`, fila | `releaseToStandardTriage` |
| Handoff | Sim | WebChat `escalateToQueue` | WA `escalateFromAi` |
| Logs | Sim | `AttendanceEvent` | + `ai.premium.*` (TOP 15) |
| Testes | Sim | `premium-ai.util.test.ts` + suites existentes | Gate incluído em `qa:atendimento:gate` |
| Gate central TOP 15 | Sim | `premium-ai.util.ts` | `evaluatePremiumAiGate` |

---

## Diagnóstico de provedores e credenciais

| Aspecto | Estado |
|---------|--------|
| Providers | OpenAI, Google Gemini, credencial RadarZap (`mode: radarzap`), empresa (`mode: company`) |
| Resolução | `AiProviderService.resolveApiKey` — falha → Premium indisponível |
| Armazenamento | Credencial empresa criptografada no documento org/settings |
| Logs | Sem API key em logs de serviço |
| Frontend | Não retorna segredo na API painel |
| RBAC | Config IA em `/platform/ai` com capabilities adequadas |
| Provider inválido | `getAvailability` false → fallback fila/mensagem fixa WebChat; WA `useStandardTriage` |

---

## Diagnóstico de base de conhecimento e FAQ

| Aspecto | Estado |
|---------|--------|
| FAQ por org | `AiKnowledgeBaseService` + catálogo WebChat público |
| Auto-resolve | `AiAutoResolveService.tryResolve` — textual, antes do LLM |
| Respostas rápidas | Usadas em contexto operacional, não como RAG vetorial |
| Busca vetorial | Não implementada como RAG grande — pendência consciente |
| Fonte resposta | `auto.source` em logs WebChat |
| WebChat FAQ widget | Chips/catálogo TOP 11 — paralelo ao Premium |

**Regra:** sem hit KB/FAQ → LLM com política de escalar se não souber; não inventar preço/prazo.

---

## Diagnóstico de prompts e políticas

| Aspecto | Estado |
|---------|--------|
| Prompt global | `PlatformAiBlueprintService` |
| Prompt empresa | `AiPrompt` via `AiPromptBuilderService.buildSystemPrompt` |
| Segurança TOP 15 | `buildPremiumAiSafetySuffix(channel)` anexado no WebChat |
| Limites | `sanitizePremiumAiResponse` — WebChat 1200, WA 900, clarify 300 |
| Input sanitizado | `sanitizePremiumAiPromptInput` |
| Vazamento prompt | Não exposto ao visitante; sufixo só regras operacionais |

---

## Diagnóstico de gate de créditos e uso

| Aspecto | Estado |
|---------|--------|
| Carteira | `Organization.aiWallet` + plano |
| Autorização | `AiUsageMeterService.getUsageSnapshot` antes de turno WA |
| Débito | Após chamada provider conforme custo/`creditWeight` |
| Sem crédito | `usage.allowed` false → triagem padrão/fila |
| Fallback sem LLM | Não consome (auto-resolve local, escalação pré-chamada) |
| Recarga/compra | **Fora de escopo** — TOP 16 |

---

## Diagnóstico WebChat

| Cenário | Comportamento |
|---------|---------------|
| `premium_assistant` / `hybrid` + toggle IA | `effectiveWebChatPremiumAi` |
| Sem provider/crédito | `generateVisitorReply` null → escala fila se Premium tentou |
| FAQ/auto-resolve | Antes do LLM quando `autoResolveEnabled` |
| Pedido humano / sensível | `shouldEscalatePremiumAiBeforeCall` → handoff |
| Bridge ativa | Retorno antecipado em `postVisitorMessage` — sem IA |
| Resposta longa | Truncada em `sanitizePremiumAiResponse` |
| Widget | Não trava — typing + fallback mensagem/fila |

---

## Diagnóstico WhatsApp

| Cenário | Comportamento |
|---------|---------------|
| Modo Premium | `AiConversationService.handleInbound` |
| Comandos `!` | Tratados antes do pipeline IA (TOP 12) |
| Créditos | Gate em `handleInbound` |
| Escalation | `AiEscalationService.check` + `transferRules` |
| Resposta | `sendAiReply` sanitiza limite 900 chars |
| Rate limit / humanizado | Fila WA TOP 12 preservada |

---

## Diagnóstico Bridge

| Regra | Estado |
|-------|--------|
| Visitante com bridge | `whatsappBridgeActive` → forward WA, sem `runVisitorAutomationPipeline` |
| Premium skip bridge | `shouldSkipPremiumAiForBridge` / gate `bridge_active` |
| Anti-loop TOP 13 | `isBridgeLoopRisk` inalterado |

---

## Diagnóstico Leads, Contatos e Tickets

| Domínio | Regra Premium |
|---------|---------------|
| Leads | Captura comercial separada (`maybeCaptureWhatsAppCommercialIntent`); IA não cria lead genérico |
| Contatos | Canal mantém `Destination`/visitante |
| Tickets | Menu TK + consulta segura; token não no prompt/resposta |

---

## Diagnóstico de fallback e handoff humano

| Gatilho | Implementação |
|---------|---------------|
| Cliente pediu humano | `clientRequestedPremiumHumanHandoff`, `AiEscalationService` |
| Sem crédito | `AiUsageMeterService` |
| Sem provider | `getAvailability` / `resolveApiKey` |
| Provider erro/timeout | catch → `ai.premium.provider_error`; fila WebChat |
| Baixa confiança / sem base | `shouldEscalate` structured + política widget |
| Assunto sensível | `isPremiumAiSensitiveIntent` pré-chamada WebChat |
| Reclamação/cancelamento/financeiro | Regex em `AiEscalationService` + Premium util |
| Loop/repetição | `repeatedQuestionCount` + política WebChat |
| Bridge | Skip automação |

---

## Diagnóstico de segurança e anti-alucinação

| Controle | Implementação |
|----------|---------------|
| Não inventar preço/prazo | Sufixo safety + escalar |
| Sem tokens/keys na resposta | `sanitizePremiumAiResponse`, `containsPremiumAiLeakedSecret` |
| Limite tamanho | Por canal |
| KB grounding | `isPremiumAiKnowledgeGrounded` para auto-resolve/KB hit |
| Prompt completo em logs | Não persistido em `AttendanceEvent` |

---

## Regras oficiais da IA Premium

1. Modo `premium_assistant` ou etapa Premium do `hybrid`.
2. Provider + credencial válidos.
3. Crédito/carteira permite (`AiUsageMeterService`).
4. Não é comando `!` (WA).
5. Não é eco bridge ativo (WebChat).
6. Cliente não pediu humano (gate).
7. Resposta curta, sanitizada, PT-BR.
8. Sem base suficiente → esclarecer ou escalar.
9. Erro provider → escalar.
10. Uso registrado quando LLM chamado.

---

## Regras oficiais de gate

Ver `evaluatePremiumAiGate` em `src/types/premium-ai.util.ts`. Falha em qualquer item → fallback humano/fila.

---

## Regras oficiais de base de conhecimento

Prioridade: FAQ → KB → contexto → LLM com política de escalar. Sem inventar fatos comerciais/jurídicos.

---

## Regras oficiais de resposta segura

`sanitizePremiumAiResponse`; limites WebChat 1200 / WA 900 / esclarecimento 300.

---

## Regras oficiais de handoff humano

`shouldEscalatePremiumAiBeforeCall`, `AiEscalationService`, `escalateToQueue` (WebChat), `escalateFromAi` (WA).

---

## Regras oficiais de custo e uso

Premium consome crédito na chamada LLM; pré-gate e auto-resolve sem LLM não consomem; erro pós-chamada conforme metering existente.

---

## Eventos, logs e rastreabilidade

| Evento | Quando |
|--------|--------|
| `ai.premium.requested` | Início `generateVisitorReply` |
| `ai.premium.answered` | Resposta enviada (LLM ou KB) |
| `ai.premium.escalated` | Handoff ou `shouldEscalate` |
| `ai.premium.blocked` | Gate bloqueou (reservado) |
| `ai.premium.provider_error` | Falha provider WebChat |

Meta: `channel`, `reason`, `source` — sem API key nem prompt completo.

---

## Atualização da documentação mestre

- `RADARZAP-SISTEMA-COMPLETO.md` §18
- `README.md`, `INDICE-DOCUMENTACAO.md`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md`, `.cursor/rules/radarzap-v2-system-registry.mdc` → `2.12.1`

---

## Correções ou ajustes aplicados

- Novo `src/types/premium-ai.util.ts` (gate, sanitização, handoff, auditoria).
- `WebChatAiService`: safety suffix, pré-escalação sensível/humano, sanitização, eventos.
- `InboxService.sendAiReply`: limite/sanitização WA 900 chars.
- `AttendanceEvent`: kinds `ai.premium.*`.
- `qa:atendimento:gate`: inclui `premium-ai.util` e `basic-triage.util`.

---

## Testes criados ou atualizados

| Suite | Cobertura |
|-------|-----------|
| `premium-ai.util.test.ts` | Gate modos, bridge, crédito, provider, humano, sensível, sanitização, limites, KB grounded |
| Existentes | `webchat-public.util`, `ai-escalation`, `AiAutoResolveService`, `webchat-ai-triage` |

---

## Gates executados

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde (widget `2.12.1`) |
| `npm test` | Verde — 122 suites, 736 testes |
| `npm run qa:atendimento:gate` | Verde — inclui `premium-ai.util` + `qa:webchat-wa` |
| Frontend build | Não alterado nesta etapa |

---

## Arquivos alterados

- `src/types/premium-ai.util.ts` (novo)
- `src/types/__tests__/premium-ai.util.test.ts` (novo)
- `src/models/AttendanceEvent.ts`
- `src/services/webchat/WebChatAiService.ts`
- `src/services/inbox/InboxService.ts`
- `package.json`
- `docs/top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md` (novo)
- `docs/RADARZAP-SISTEMA-COMPLETO.md`
- `docs/CHANGELOG.md`, `docs/INDICE-DOCUMENTACAO.md`, `docs/SISTEMA-REGISTRO.md`
- `README.md`, `.cursor/rules/radarzap-v2-system-registry.mdc`

---

## Riscos reduzidos

- Resposta Premium com vazamento de segredo redigida.
- Handoff antecipado em assunto sensível/pedido humano (WebChat).
- Gate documentado e testável centralmente.
- Bridge não reativa Premium no visitante (já existente + gate explícito).

---

## Riscos restantes

- RAG vetorial/embeddings não implementado.
- Auditoria `ai.premium.*` só integrada no WebChat generativo (WA usa fluxo legado + sanitização envio).
- QA manual Premium em produção Baileys/cloud.
- Recarga/billing ainda pendentes (TOP 16–17).

---

## Decisões pendentes para Benhur

1. Exigir hit KB obrigatório antes de qualquer LLM Premium (hoje: FAQ tenta primeiro, LLM depois).
2. Propagar `recordPremiumAiAttendanceEvent` em todos os caminhos `AiConversationService` WA.
3. Threshold de confiança structured reply para escalar automaticamente.

---

## Próximo passo recomendado

**TOP 16 — IA Créditos:** recarga, carteira operacional no painel, alertas de cota, sem billing Stripe completo (TOP 17).
