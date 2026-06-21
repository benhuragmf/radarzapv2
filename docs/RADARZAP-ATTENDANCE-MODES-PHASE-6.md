# RadarZap — Modos de Atendimento (Fase 6)

**Versão:** `2.11.2` · **Data:** 2026-06-19  
**Consolidado:** [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md)

---

## O que foi feito

### Alinhamento WebChat × modo global

- **`effectiveWebChatPremiumAi()`** — combina `widget.autoReplyUseAi` com `attendanceMode === premium_assistant` e credencial ativa.
- **`WebChatService.maybeAutoReply`** — só chama `WebChatAiService` quando o gate acima é verdadeiro (evita LLM legado com toggle antigo).
- **`WebChatAiService.getAvailability`** — retorna `attendanceMode`, `premiumAiAllowed`, `globalModeHint`.
- **API** `GET /api/webchat/ai-status` — payload enriquecido para o painel.

### UI

- **WebChat** (`/platform/webchat`): checkbox renomeado para **Usar IA Premium no widget**; desabilitado fora do modo Premium global; banner com modo atual + link para IA Atendimento.
- **IA Atendimento**: banner no modo Premium explicando toggle no WebChat.

### Helpers (`attendance-mode.ts`)

| Função | Uso |
|--------|-----|
| `webChatPremiumAiAllowed` | Modo global permite IA conversacional |
| `effectiveWebChatPremiumAi` | Runtime WebChat |
| `webChatGlobalModeHint` | Texto UI |

---

## O que NÃO foi feito

- Ocultar abas KB/skills no painel fora de Premium (KB ainda usada pela IA Básica).
- Contadores de custo por modo (Fase 7).
- E2E Playwright (Fase 8).

---

## Como testar

1. Modo **Robotizado** ou **IA Básica** → WebChat: checkbox IA Premium desabilitado.
2. Modo **IA Premium** + credencial OK → checkbox habilitado; visitante recebe assistente se marcado.
3. Widget com `autoReplyUseAi: true` legado + modo Desativado → **nenhuma** chamada LLM no runtime.

```bash
npm test -- --testPathPattern="attendance-mode"
npm run typecheck
```

---

## Próxima fase

**Fase 7** — contadores `basicLlmCalls` / `premiumLlmCalls` e UI de logs/custos.
