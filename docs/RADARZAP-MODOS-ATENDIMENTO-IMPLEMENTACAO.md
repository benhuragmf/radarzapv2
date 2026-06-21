# RadarZap — Modos de Atendimento: implementação completa (Fases 1–4)

**Versão atual:** `2.11.2` · **Última atualização:** 2026-06-19  
**Análise prévia:** [`ANALISE-MODOS-ATENDIMENTO.md`](./ANALISE-MODOS-ATENDIMENTO.md)

Documento consolidado de **tudo que foi implementado** na evolução dos modos de atendimento. Substitui a leitura fragmentada das fases individuais para quem quer visão única.

| Fase | Versão | Doc parcial | Status |
|------|--------|-------------|--------|
| 0–2 (conceito + UI) | 2.10.106 | [`RADARZAP-ATTENDANCE-MODES-PHASE-1.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-1.md) | ✅ |
| 3 (persistência Mongo) | 2.10.107 | [`RADARZAP-ATTENDANCE-MODES-PHASE-3.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-3.md) | ✅ |
| 4 (robotizado WebChat) | 2.10.108 | [`RADARZAP-ATTENDANCE-MODES-PHASE-4.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-4.md) | ✅ |
| 5 (IA Básica local-first) | 2.11.1 | [`RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-5.md) | ✅ |
| 6 (WebChat × modo global) | 2.11.2 | [`RADARZAP-ATTENDANCE-MODES-PHASE-6.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-6.md) | ✅ |
| 7–8 (custos, E2E) | — | — | ⏳ pendente |

---

## Índice

1. [Contexto e problema](#1-contexto-e-problema)
2. [Conceitos separados](#2-conceitos-separados)
3. [Os 4 modos de atendimento](#3-os-4-modos-de-atendimento)
4. [Cronologia das entregas](#4-cronologia-das-entregas)
5. [Arquitetura atual](#5-arquitetura-atual)
6. [Banco de dados e API](#6-banco-de-dados-e-api)
7. [Adapter e mapeamento legado](#7-adapter-e-mapeamento-legado)
8. [Interface do painel](#8-interface-do-painel)
9. [Comportamento por canal](#9-comportamento-por-canal)
10. [Arquivos criados ou alterados](#10-arquivos-criados-ou-alterados)
11. [Testes e validação](#11-testes-e-validação)
12. [Commits Git](#12-commits-git)
13. [O que NÃO foi feito](#13-o-que-não-foi-feito)
14. [Como configurar e testar](#14-como-configurar-e-testar)
15. [Próximas fases](#15-próximas-fases)
16. [Riscos e decisões de design](#16-riscos-e-decisões-de-design)

---

## 1. Contexto e problema

Antes da implementação, o RadarZap misturava dois conceitos no campo `AiSettings.mode`:

| Valor legado | Significado real |
|--------------|------------------|
| `disabled` | IA generativa desligada |
| `radarzap` | IA ligada + credencial RadarZap |
| `company` | IA ligada + API Key do tenant |

Isso confundia **como o atendimento se comporta** com **quem fornece a IA**. O bot robotizado (menu 1–2–3–4) vivia em `InboxSettings` / `inbox-triage`, separado da tela de IA.

A análise ([`ANALISE-MODOS-ATENDIMENTO.md`](./ANALISE-MODOS-ATENDIMENTO.md)) concluiu que ~70–80% da infraestrutura já existia; faltava reorganização conceitual, UI clara e persistência sem quebrar o legado.

---

## 2. Conceitos separados

### Modo de atendimento (`attendanceMode`)

Persistido em `AiSettings.attendanceMode` desde a Fase 3.

| Valor | Label UI |
|-------|----------|
| `disabled` | Desativado |
| `robotic` | Atendimento Robotizado |
| `basic_triage` | IA Básica — Triagem Inteligente |
| `premium_assistant` | IA Premium — Assistente Virtual |

### Provedor / credencial da IA

Continua representado pelo campo legado **`mode`** + **`enabled`**:

| UI (Provedor da IA) | `mode` | LLM |
|---------------------|--------|-----|
| Nenhum | `disabled` | Não |
| RadarZap | `radarzap` | Sim (limites do plano) |
| Chave própria | `company` | Sim (API Key tenant) |

### Motor LLM (aba Provedor)

Separado na UI: **OpenAI / Gemini**, modelo, temperature, max tokens — campos `provider` e `llmModel`.

---

## 3. Os 4 modos de atendimento

### Desativado

- **LLM:** não.
- **Bot robotizado WA:** continua se configurado em Triagem e Bot (comportamento legado honesto).
- **WebChat:** FAQ + auto-reply + IA conforme widget (`autoReplyUseAi`), salvo modo robotizado global.
- **Custo IA:** zero.

### Atendimento Robotizado

- **LLM:** não (`mode: disabled`, `enabled: false`).
- **WhatsApp:** menu numérico via `InboxService.handleStandardBotTriage` (já existia).
- **WebChat (Fase 4):** menu via `WebChatRoboticTriageService` quando `attendanceMode === robotic`.
- **Config:** `/platform/inbox/bot` + setores com `menuKey` e `clientVisible`.
- **Custo IA:** zero.

### IA Básica — Triagem Inteligente

- **UI:** card visível com badge **“Próxima etapa”** — **não selecionável** (Fase 5).
- **Runtime:** não implementado.
- **Objetivo futuro:** classificador local + LLM só se baixa confiança.

### IA Premium — Assistente Virtual

- **Comportamento:** equivalente à IA ativa antes do projeto (KB, skills, memória, regras, limites).
- **Requisito:** `attendanceMode: premium_assistant` + `mode: radarzap|company` + `enabled: true`.
- **WebChat:** depende também de `autoReplyUseAi` no widget.

---

## 4. Cronologia das entregas

### Fase 0 — Baseline (2.10.106)

- Diagnóstico: stack, scripts, estado do git.
- Confirmação: `AiSettings.mode` permanece fonte de verdade para LLM no runtime.

### Fase 1 — Reorganização conceitual (2.10.106)

- Criado `src/types/attendance-mode.ts` com tipos e funções adapter.
- Testes unitários do adapter.
- **Sem** alteração de fluxo de mensagens.

### Fase 2 — UI mínima (2.10.106)

- Tela `/platform/inbox/ia` → aba **Geral**:
  - 4 cards de modo de atendimento.
  - Seção **Provedor da IA** separada.
- Aba **Provedor** renomeada conceitualmente para **Modelo LLM**.
- Salvamento compatível via `PATCH` com campo legado `mode`.
- Alias Vite `@radarzap-types` para tipos compartilhados.

### Fase 3 — Persistência Mongo (2.10.107)

- Campo `attendanceMode` em `AiSettings` (Mongoose).
- Backfill lazy em `getSettingsDoc()`.
- API retorna e aceita `settings.attendanceMode`.
- `isAiActive()` exige `premium_assistant` + `mode` ativo.
- Helper `shouldRunGenerativeAi()` para uso futuro.
- Robotizado **persiste** após reload.

### Fase 4 — Robotizado WebChat (2.10.108)

- `WebChatRoboticTriageService` reutiliza `inbox-triage.ts`.
- `WebChatService.tryRoboticTriage()` intercepta antes de FAQ/auto-reply/IA.
- Paridade de textos e setores com WhatsApp.
- **InboxService / WhatsApp:** inalterados.

---

## 5. Arquitetura atual

```
┌─────────────────────────────────────────────────────────────┐
│  Painel: /platform/inbox/ia (AiAtendimento.tsx)           │
│  • Cards attendanceMode + Provedor credencial               │
│  • PATCH /api/platform/ai/settings                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  AiSettings (Mongo)                                         │
│  • attendanceMode  ← novo (Fase 3)                          │
│  • mode, enabled   ← legado LLM / credencial                │
│  • provider, llmModel ← motor OpenAI/Gemini                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   WhatsApp           WebChat            isAiActive()
   InboxService       WebChatService     AiConversationService
   handleStandard     tryRoboticTriage   (só premium + mode)
   BotTriage          + FAQ/IA fallback
   (sempre bot        (se não robotic)
    fixo quando
    IA off)
```

**Regra LLM (Fase 3+):**

```typescript
shouldRunGenerativeAi(settings) =
  resolveAttendanceMode(settings) === 'premium_assistant'
  && mode !== 'disabled'
  && enabled !== false
```

**Regra WebChat robotizado (Fase 4):**

```typescript
attendanceMode === 'robotic'
  && queueStatus === 'bot'
  && !assignedUserId
  → WebChatRoboticTriageService.handleInbound()
```

---

## 6. Banco de dados e API

### Modelo `AiSettings` (`aiSettings`)

| Campo | Tipo | Desde | Função |
|-------|------|-------|--------|
| `mode` | `radarzap \| company \| disabled` | legado | Credencial + on/off LLM |
| `enabled` | boolean | legado | IA ligada |
| `attendanceMode` | enum 4 valores | Fase 3 | Modo de produto |
| `provider` | `openai \| gemini` | legado | Motor LLM |
| `llmModel` | string | legado | Modelo |

**Backfill:** na primeira leitura, se `attendanceMode` inválido/ausente → deriva de `mode` (`disabled` → `disabled`, `radarzap|company` → `premium_assistant`).

### Endpoints

| Método | Rota | Mudança |
|--------|------|---------|
| GET | `/api/platform/ai/settings` | Inclui `settings.attendanceMode` |
| PATCH | `/api/platform/ai/settings` | Aceita `attendanceMode`; sincroniza `mode` + `enabled` |

**Serviço:** `AiSettingsService.getFullPayload()` / `upsertSettings()`.

---

## 7. Adapter e mapeamento legado

**Arquivo central:** `src/types/attendance-mode.ts`

| Função | Uso |
|--------|-----|
| `inferAttendanceModeFromLegacyMode` | Leitura sem `attendanceMode` |
| `inferCredentialSourceFromLegacyMode` | Provedor na UI |
| `resolveAttendanceMode` | Prioriza campo persistido |
| `legacySettingsFromAttendanceSelection` | UI → `mode` + `enabled` |
| `attendanceSettingsPatchFromSelection` | UI → patch completo |
| `attendanceSelectionFromSettings` | Servidor → UI |
| `shouldRunGenerativeAi` | Gate LLM |
| `isValidAttendanceMode` | Validação PATCH |

### Tabela completa UI → Mongo

| Modo UI | Provedor UI | `attendanceMode` | `mode` | `enabled` | LLM |
|---------|-------------|------------------|--------|-----------|-----|
| Desativado | — | `disabled` | `disabled` | `false` | Não |
| Robotizado | — | `robotic` | `disabled` | `false` | Não |
| IA Básica | — | `basic_triage` | `disabled` | `false` | Só fallback opcional |
| IA Premium | RadarZap | `premium_assistant` | `radarzap` | `true` | Sim |
| IA Premium | Chave própria | `premium_assistant` | `company` | `true` | Sim |

### Leitura legado → UI (tenants antigos)

| `mode` legado | Modo UI | Provedor UI |
|---------------|---------|-------------|
| `disabled` | Desativado* | Nenhum |
| `radarzap` | IA Premium | RadarZap |
| `company` | IA Premium | Chave própria |

\*Após o usuário salvar **Robotizado**, `attendanceMode` distingue de **Desativado** (Fase 3+).

---

## 8. Interface do painel

**Rota:** `/platform/inbox/ia`  
**Componente:** `AiAtendimento.tsx`

### Aba Geral

- **Modo de atendimento** — 4 cards (`AttendanceModePicker.tsx`).
- **Provedor da IA** — RadarZap / Chave própria / Nenhum (desabilitado fora de Premium).
- Nome do assistente (só Premium).
- Stats: modo, uso diário/mensal, skills/memórias pendentes, base ativa.

### Aba Provedor

- **Modelo LLM** — OpenAI/Gemini, picker de modelo, temperature, max tokens, API Key.
- Link para aba Geral para credencial.

### Cards (constantes em `frontend/src/lib/attendanceMode.ts`)

| Modo | Badge | Selecionável |
|------|-------|--------------|
| Desativado | Sem IA | Sim |
| Robotizado | Custo IA R$ 0 | Sim |
| IA Básica | Baixo custo | Sim |
| IA Premium | Assistente completo | Sim |

---

## 9. Comportamento por canal

### WhatsApp

| `attendanceMode` | Comportamento |
|------------------|---------------|
| `disabled` | Bot fixo (menu setores) + fila + humano — **inalterado** |
| `robotic` | Igual `disabled` para LLM; bot fixo ativo |
| `basic_triage` | **IA Básica** — classificador local + KB → setor; LLM opcional |
| `premium_assistant` | IA via `AiConversationService` quando `isAiActive()` |

Configuração bot: `/platform/inbox/bot`, setores `/platform/inbox/setores`.

### WebChat

| `attendanceMode` | Comportamento |
|------------------|---------------|
| `disabled` | FAQ (se ativo) → auto-reply → IA se `autoReplyUseAi` |
| `robotic` | **Menu robotizado** (`WebChatRoboticTriageService`) — sem FAQ/IA |
| `basic_triage` | **IA Básica** (`WebChatBasicTriageService`) — local-first |
| `premium_assistant` | FAQ → auto-reply → IA se `autoReplyUseAi` |

Fluxo robotizado WebChat:

1. Visitante envia mensagem (pós pré-chat).
2. Se sem menu bot ainda → `buildInboxTriageMenu()`.
3. Escolha válida → `escalateToQueue(departmentId)` + `buildQueueConfirmation`.
4. Escolha inválida → `buildInvalidMenuHint`.
5. Anexo sem texto → envia menu se ainda não enviado.

### Inbox

- Lista unificada WA + WebChat (`wc:` IDs) — **sem mudança** neste projeto.
- Escalação WebChat robotizado aparece na fila como conversas `wc:`.

---

## 10. Arquivos criados ou alterados

### Backend / tipos

| Arquivo | Fase | Descrição |
|---------|------|-----------|
| `src/types/attendance-mode.ts` | 1, 3 | Tipos, adapter, gates |
| `src/types/__tests__/attendance-mode.test.ts` | 1, 3 | Testes adapter |
| `src/types/ai-assistant.ts` | 1 | Comentário legado → attendance-mode |
| `src/models/AiSettings.ts` | 3 | Campo `attendanceMode` |
| `src/services/ai/AiSettingsService.ts` | 3 | Backfill, payload, upsert, `isAiActive` |
| `src/services/webchat/webchat-robotic-triage.service.ts` | 4 | Menu robotizado site |
| `src/services/webchat/WebChatService.ts` | 4 | `tryRoboticTriage()` |
| `src/services/webchat/__tests__/webchat-robotic-triage.service.test.ts` | 4 | Testes robotizado WC |

### Frontend

| Arquivo | Fase | Descrição |
|---------|------|-----------|
| `frontend/src/lib/attendanceMode.ts` | 1, 4 | Re-export + cards UI |
| `frontend/src/components/ai/AttendanceModePicker.tsx` | 1 | Cards modo + provedor |
| `frontend/src/pages/menu/AiAtendimento.tsx` | 1, 3, 4 | Integração completa |
| `frontend/vite.config.ts` | 1 | Alias `@radarzap-types` |
| `frontend/tsconfig.json` | 1 | Path `@radarzap-types/*` |

### Documentação

| Arquivo | Descrição |
|---------|-----------|
| `docs/ANALISE-MODOS-ATENDIMENTO.md` | Análise pré-implementação (675 linhas) |
| `docs/RADARZAP-ATTENDANCE-MODES-PHASE-1.md` | Fases 0–2 |
| `docs/RADARZAP-ATTENDANCE-MODES-PHASE-3.md` | Persistência Mongo |
| `docs/RADARZAP-ATTENDANCE-MODES-PHASE-4.md` | WebChat robotizado |
| **`docs/RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`** | **Este documento (consolidado)** |

### Não alterados (por design)

- `InboxService.ts` (WhatsApp bot — só consumido indiretamente via `inbox-triage`)
- `AiConversationService.ts`
- `inbox-triage.ts` (reutilizado, não modificado)
- Planos, billing, embeddings/RAG

---

## 11. Testes e validação

### Comandos

```bash
npm run typecheck
npm test -- --testPathPattern="attendance-mode|webchat-robotic-triage"
npm run build
npm run build --prefix src/services/web-dashboard/frontend
npm run qa:gate   # opcional — suite completa
```

### Cobertura unitária

| Arquivo | Cenários |
|---------|----------|
| `attendance-mode.test.ts` | Mapeamento legado, patch, `resolveAttendanceMode`, `shouldRunGenerativeAi` |
| `webchat-robotic-triage.service.test.ts` | Menu inicial, escolha setor, opção inválida, gate `attendanceMode` |

### QA manual sugerido

1. **Premium + RadarZap:** IA responde no WA e WebChat (`autoReplyUseAi`).
2. **Desativado:** LLM off; bot WA continua; WebChat sem IA se `autoReplyUseAi` off.
3. **Robotizado:** menu no WA e WebChat; escolha setor → fila Inbox; zero chamadas LLM.
4. **Reload painel:** modo robotizado permanece selecionado após Fase 3.
5. **Tenant antigo** (`mode: radarzap` sem `attendanceMode`): backfill → Premium na UI.

---

## 12. Commits Git

| Commit | Mensagem | Versão |
|--------|----------|--------|
| `2cc2b2a` | `feat: Fase 1 modos de atendimento — UI e adapter legado` | 2.10.106 |
| `b240284` | `feat: Fase 3 attendanceMode persistido em AiSettings com backfill lazy` | 2.10.107 |
| `f899af0` | `feat: Fase 4 menu robotizado no WebChat quando attendanceMode=robotic` | 2.10.108 |

Branch: `main` em `origin`.

---

## 13. O que NÃO foi feito

| Item | Fase prevista |
|------|---------------|
| IA Básica — classificador local-first | 5 |
| Gate LLM por confiança local | 5 |
| Orquestrador central de atendimento | — (evitado de propósito) |
| Botões visuais no widget (só texto numérico) | futuro |
| Custos/logs por modo na UI | 7 |
| E2E autenticado dos modos | 8 |
| RAG / embeddings | — |
| Provedor “local/interno” | — |
| Remoção do campo legado `mode` | — (backward compat) |
| Script bulk migration Mongo | — (backfill lazy suficiente) |

---

## 14. Como configurar e testar

### Robotizado (WhatsApp + WebChat)

1. `/platform/inbox/ia` → **Atendimento Robotizado** → **Salvar**.
2. `/platform/inbox/setores` → setores ativos, `menuKey` 1–4, **Público** (`clientVisible`).
3. `/platform/inbox/bot` → saudação, intro menu, hint inválido, mensagem fila.
4. WebChat: widget ativo → pré-chat → enviar mensagem → menu → `1` → fila Inbox (`wc:`).

### IA Premium

1. `/platform/inbox/ia` → **IA Premium** → **RadarZap** ou **Chave própria** → Salvar.
2. Aba **Provedor** → modelo/temperature (chave própria: API Key).
3. WebChat: `/platform/webchat` → **Usar IA da empresa** (`autoReplyUseAi`).
4. Base/skills/memória nas abas correspondentes.

### Desativado (sem LLM, com automações legadas)

1. Modo **Desativado** → Salvar.
2. Bot WA e fila continuam conforme Triagem e Bot.
3. WebChat: desmarcar `autoReplyUseAi` se não quiser IA no site.

---

## 15. Próximas fases

| Fase | Escopo | Risco estimado |
|------|--------|----------------|
| **5** | IA Básica: heurísticas + score setor + LLM fallback | Alto |
| **6** | IA Premium como produto nomeado (refino, sem mudar runtime) | Baixo |
| **7** | Contadores custo por modo; UI logs | Médio |
| **8** | E2E Playwright autenticado | Baixo |

Ordem recomendada: **5 → 7 → 8 → 6** (6 é mostly naming/polish).

---

## 16. Riscos e decisões de design

| Decisão | Motivo |
|---------|--------|
| Manter `mode` legado | Zero breaking change em runtime WA/WebChat/IA |
| Dois campos (`attendanceMode` + `mode`) | Separação produto vs credencial LLM |
| Backfill lazy vs script bulk | Menor risco; migra on-read |
| `isAiActive` gate em `premium_assistant` | Robotizado/disabled nunca ligam LLM por engano |
| WebChat robotizado em serviço separado | Não refatorar `InboxService` |
| IA Básica bloqueada na UI | Evitar prometer comportamento inexistente |
| Menu WebChat em texto | Paridade WA mínima; botões = futuro |
| Desativado ≠ zero automação | Honestidade: bot WA legado continua |

---

## Governança de versão (2.11.0)

A partir de **`2.11.0`**, toda entrega segue o protocolo em [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md):

| Artefato | Função |
|----------|--------|
| [`CHANGELOG.md`](./CHANGELOG.md) | Histórico append-only por versão |
| [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) | Mapa de todos os `.md` |
| [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) | Espelho versionado no git |

**Baseline minor `2.11.0`:** agrupa Fases 1–4 (código `2.10.106`–`2.10.108`) + governança de documentação.

---

## Referências cruzadas

- [`docs/INBOX-ATENDIMENTO.md`](./INBOX-ATENDIMENTO.md) — triagem WA, fila, CSAT
- [`docs/WEBCHAT.md`](./WEBCHAT.md) — widget, pré-chat, IA, escalação
- [`docs/MENU-PAGES-REGISTRY.md`](./MENU-PAGES-REGISTRY.md) — rota `/platform/inbox/ia`

---

*Documento vivo — atualizar ao concluir Fase 5+.*
