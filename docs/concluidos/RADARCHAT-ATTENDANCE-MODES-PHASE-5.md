# Radar Chat — Modos de Atendimento (Fase 5)

**Versão:** `2.11.1` · **Data:** 2026-06-19  
**Consolidado:** [`RADARCHAT-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](../RADARCHAT-MODOS-ATENDIMENTO-IMPLEMENTACAO.md)

---

## O que foi feito

### IA Básica (`attendanceMode: basic_triage`)

Pipeline **local-first** no WhatsApp e WebChat:

1. **Escolha numérica** — `parseInboxMenuChoice` (paridade menu 1–4).
2. **Auto-resolve** — `AiAutoResolveService` (KB/skills/memória) se `autoResolveEnabled`.
3. **Classificador local** — `classifyLocal()` em `basic-triage-classifier.ts` (heurísticas + nomes de setores).
4. **Encaminhamento** — confiança ≥ 0,65 → fila do setor sugerido.
5. **Esclarecimento** — intenção parcial → pergunta curta ao cliente.
6. **Menu fallback** — texto ambíguo → `buildInboxTriageMenu()`.
7. **LLM opcional** — se `basicTriageLlmFallbackEnabled` e confiança baixa → `completeForBasicTriage()` (chave Radar Chat, tokens limitados).

### UI

- Card **IA Básica** habilitado em `/platform/inbox/ia`.
- Banner explicativo no modo Básica.
- Toggle **LLM fallback** na aba *Economia e regras* (só quando modo Básica).

### Backend

| Arquivo | Função |
|---------|--------|
| `src/utils/basic-triage-classifier.ts` | `classifyLocal`, `shouldRouteByClassification` |
| `src/services/ai/AiBasicTriageService.ts` | Fluxo WA em `BOT_TRIAGE` |
| `src/services/webchat/webchat-basic-triage.service.ts` | Fluxo WebChat em `queueStatus: bot` |
| `src/services/inbox/InboxService.ts` | Gate `basicActive` + `routeFromTriageChoice()` |
| `src/services/webchat/WebChatService.ts` | `tryBasicTriage()` após robotizado |
| `src/services/ai/AiProviderService.ts` | `completeForBasicTriage()` |
| `src/models/AiPrompt.ts` | `basicTriageLlmFallbackEnabled` |

### Mapeamento Mongo (modo Básica selecionado)

| Campo | Valor |
|-------|-------|
| `attendanceMode` | `basic_triage` |
| `mode` | `disabled` |
| `enabled` | `false` |

LLM Premium **não** roda (`shouldRunGenerativeAi` = false).

---

## O que NÃO foi feito

- IA Básica no WhatsApp fora de `BOT_TRIAGE` (tickets, CSAT, etc.) — inalterado.
- Contadores separados `basicLlmCalls` / `premiumLlmCalls` (Fase 7).
- Unificação `autoReplyUseAi` WebChat com modo global (Fase 6).
- E2E Playwright dedicado (Fase 8).

---

## Como testar

```bash
npm run typecheck
npm test -- --testPathPattern="attendance-mode|basic-triage|webchat-basic"
npm run build --prefix src/services/web-dashboard/frontend
```

### QA manual

1. Painel → IA Atendimento → selecionar **IA Básica** → salvar.
2. **WhatsApp:** enviar *preciso da segunda via do boleto* → encaminha Financeiro (menuKey 2).
3. **WhatsApp:** enviar *oi* → saudação + orientação.
4. **WebChat:** mesma lógica com widget ativo (`autoReplyEnabled`).
5. Ativar toggle LLM fallback → mensagem ambígua pode consumir 1 chamada Radar Chat (ver aba Limites).

---

## Próxima fase

**Fase 6** — polish Premium, alinhar WebChat `autoReplyUseAi` com modo global.
