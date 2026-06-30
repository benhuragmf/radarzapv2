# Radar Chat — Modos de atendimento (Fase 1)

**Versão:** 2.10.106 · **Data:** 2026-06-19

Documento da primeira entrega segura da evolução de modos de atendimento. Ver análise completa em [`ANALISE-MODOS-ATENDIMENTO.md`](./ANALISE-MODOS-ATENDIMENTO.md). **Implementação consolidada:** [`RADARCHAT-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](../RADARCHAT-MODOS-ATENDIMENTO-IMPLEMENTACAO.md).

---

## O que foi feito (Fases 0–2)

### Fase 0 — Baseline

- Diagnóstico de stack e scripts (`npm test`, `typecheck`, `build`, `qa:gate`).
- Confirmação de que o backend legado (`AiSettings.mode`) permanece a fonte de verdade no runtime.

### Fase 1 — Reorganização conceitual

- Tipos em `src/types/attendance-mode.ts`:
  - `AttendanceMode` — `disabled` | `robotic` | `basic_triage` | `premium_assistant`
  - `AiCredentialSource` — `none` | `radarchat` | `company`
- Funções adapter:
  - `inferAttendanceModeFromLegacyMode`
  - `inferCredentialSourceFromLegacyMode`
  - `legacySettingsFromAttendanceSelection`
  - `attendanceSelectionFromLegacySettings`
- Testes unitários em `src/types/__tests__/attendance-mode.test.ts`.

### Fase 2 — UI mínima

- Aba **Geral** de `/platform/inbox/ia` reorganizada:
  - 4 cards de **Modo de atendimento**
  - Seção separada **Provedor da IA** (credencial)
- Componentes: `AttendanceModePicker.tsx`, `lib/attendanceMode.ts`
- Aba **Provedor** renomeada conceitualmente para **Modelo LLM** (OpenAI/Gemini) com link para Geral.
- Salvamento continua via `PATCH /platform/ai/settings` com campo legado `mode`.

---

## O que NÃO foi implementado

- Campo `attendanceMode` no Mongo (`AiSettings`) — **Fase 3**
- Comportamento runtime de robotizado no WebChat — **Fase 4**
- IA Básica com classificador local-first — **Fase 5**
- Orquestrador central de atendimento
- Alterações em `InboxService`, `WebChatService`, `AiConversationService`
- RAG / embeddings
- Custos por modo na UI de logs

---

## Preservação do legado

O campo **`AiSettings.mode`** (`disabled` | `radarchat` | `company`) **não foi removido nem renomeado**.

O runtime (WhatsApp, WebChat, Inbox) **não foi alterado** nesta fase.

---

## Mapeamento legado ↔ UI

### Leitura (servidor → UI)

| `mode` legado | Modo de atendimento (UI) | Provedor da IA (UI) |
|---|---|---|
| `disabled` | Desativado | Nenhum |
| `radarchat` | IA Premium | Radar Chat |
| `company` | IA Premium | Chave própria |

> `robotic` e `basic_triage` **não persistem** no backend nesta fase.

### Escrita (UI → servidor)

| Seleção UI | `mode` salvo | `enabled` |
|---|---|---|
| Desativado | `disabled` | `false` |
| Robotizado | `disabled` | `false` |
| IA Básica | *(não selecionável — próxima etapa)* | — |
| IA Premium + Radar Chat | `radarchat` | `true` |
| IA Premium + Chave própria | `company` | `true` |

### Comportamento honesto — Desativado

`mode: disabled` desliga a **IA generativa (LLM)**. O **bot fixo do WhatsApp** (menu de setores), fila e humano **continuam** conforme **Triagem e Bot** — não prometemos “zero automação”.

### Robotizado (sessão)

- Selecionável na UI; salva como `disabled` (sem LLM).
- Após recarregar, volta a **Desativado** até a Fase 3 persistir `attendanceMode`.
- Link para `/platform/inbox/bot`.

---

## Separação na UI

| Conceito | Onde na UI | Campo legado |
|---|---|---|
| Modo de atendimento | Aba Geral — cards | Derivado de `mode` (leitura) |
| Provedor/credencial IA | Aba Geral — radios | `mode` radarchat/company/disabled |
| Motor LLM (OpenAI/Gemini) | Aba Provedor | `provider`, `llmModel` |

---

## Próximas fases

| Fase | Escopo |
|---|---|
| **3** | `attendanceMode` em `AiSettings` + backfill + leitura compatível |
| **4** | Robotizado no WebChat (reuso `inbox-triage`) |
| **5** | IA Básica local-first + LLM só se baixa confiança |
| **6** | IA Premium como produto nomeado (já existe no runtime) |
| **7** | Custos/logs por modo |
| **8** | Testes E2E autenticados |

---

## Arquivos desta entrega

| Arquivo | Função |
|---|---|
| `src/types/attendance-mode.ts` | Tipos + adapter |
| `src/types/__tests__/attendance-mode.test.ts` | Testes adapter |
| `frontend/src/lib/attendanceMode.ts` | Re-export + constantes UI |
| `frontend/src/components/ai/AttendanceModePicker.tsx` | Cards modo + provedor |
| `frontend/src/pages/menu/AiAtendimento.tsx` | Integração aba Geral |
| `frontend/vite.config.ts` | Alias `@radarchat-types` |

---

*Implementação Fase 1 — compatível com produção atual.*
