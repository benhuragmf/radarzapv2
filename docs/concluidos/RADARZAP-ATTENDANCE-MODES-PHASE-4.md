# RadarZap — Modos de atendimento (Fase 4)

**Versão:** 2.10.108 · **Data:** 2026-06-19

Continuação de [`RADARZAP-ATTENDANCE-MODES-PHASE-3.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-3.md). **Visão consolidada:** [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](../RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md).

---

## O que foi feito

### WebChat robotizado

Quando `AiSettings.attendanceMode === robotic`:

1. Visitante envia mensagem no widget (após pré-chat).
2. `WebChatRoboticTriageService` reutiliza funções de `inbox-triage.ts`:
   - `buildInboxTriageMenu`
   - `parseInboxMenuChoice`
   - `buildInvalidMenuHint`
   - `buildQueueConfirmation`
3. Escolha válida → `WebChatService.escalateToQueue` com `departmentId` do setor.
4. Opção inválida → mensagem do bot com hint configurável.
5. **Não** chama FAQ, auto-reply fixo nem IA.

### Paridade com WhatsApp

- Mesmos textos (`InboxSettings`) e setores (`InboxDepartment` com `clientVisible`).
- Fluxo espelha `InboxService.handleStandardBotTriage` sem alterar o código do WhatsApp.

### Arquivos

| Arquivo | Função |
|---|---|
| `webchat-robotic-triage.service.ts` | Lógica do menu robotizado no site |
| `WebChatService.ts` | `tryRoboticTriage()` antes de FAQ/auto-reply |
| `__tests__/webchat-robotic-triage.service.test.ts` | Testes unitários |

---

## O que NÃO mudou

- `InboxService` / WhatsApp inalterados.
- Modos `disabled`, `premium_assistant` no WebChat seguem FAQ + auto-reply + IA como antes.
- IA Básica (Fase 5) não implementada.
- Botões visuais no widget (só menu numérico em texto).

---

## Como testar

1. Painel → **IA Atendimento** → modo **Atendimento Robotizado** → Salvar.
2. **Triagem e Bot** + **Setores** com `menuKey` 1–4 e `clientVisible`.
3. Abrir widget, concluir pré-chat, enviar mensagem → menu aparece.
4. Enviar `1` (ou nome do setor) → conversa na fila do Inbox (`wc:`).

---

## Próxima fase

**Fase 5:** IA Básica local-first (classificador + LLM só se baixa confiança).
