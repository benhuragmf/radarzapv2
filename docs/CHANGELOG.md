# RadarZap — Changelog

Registro append-only de entregas versionadas. Protocolo: [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md).

Espelho resumido: [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md).

---

## [2.11.3] — 2026-06-19

### Adicionado

- **Fase 7:** campo `usageKind` em `AiUsage` — contadores Premium vs IA Básica (LLM fallback).
- `GET /platform/ai/usage` retorna `totals.byKind` e linhas tipadas.
- UI Logs: breakdown por modo + tabela de chamadas; Geral mostra uso diário por modo.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-7.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-7.md)

---

## [2.11.2] — 2026-06-19

### Alterado

- **Fase 6:** WebChat alinhado ao modo global — IA Premium conversacional só com `premium_assistant` + toggle do widget.
- `GET /webchat/ai-status` retorna `attendanceMode`, `premiumAiAllowed`, `globalModeHint`.
- UI WebChat: checkbox renomeado; desabilitado fora de Premium.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-6.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-6.md)

---

## [2.11.1] — 2026-06-19

### Adicionado

- **IA Básica (Fase 5):** modo `basic_triage` com classificador local, auto-resolve KB/skills, encaminhamento por setor (WA + WebChat).
- `AiBasicTriageService`, `WebChatBasicTriageService`, `basic-triage-classifier.ts`.
- Campo `basicTriageLlmFallbackEnabled` em `AiPrompt` — LLM RadarZap opcional em ambiguidade.
- `AiProviderService.completeForBasicTriage()` — fallback econômico.

### Alterado

- UI `/platform/inbox/ia`: card IA Básica habilitado; banner e toggle LLM fallback.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-5.md)
- Consolidado modos atualizado para `2.11.1`.

---

## [2.11.0] — 2026-06-19

### Adicionado

- **Governança:** protocolo oficial de versionamento e documentação em `.md` ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).
- **Índice:** [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) com mapa de todos os docs relevantes.
- **Modos de atendimento (baseline minor):** Fases 1–4 agrupadas sob versão de produto `2.11.0`.

### Documentação

- Consolidado modos: [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md).
- Análise: [`ANALISE-MODOS-ATENDIMENTO.md`](./ANALISE-MODOS-ATENDIMENTO.md).
- Fases: [`PHASE-1`](./RADARZAP-ATTENDANCE-MODES-PHASE-1.md), [`PHASE-3`](./RADARZAP-ATTENDANCE-MODES-PHASE-3.md), [`PHASE-4`](./RADARZAP-ATTENDANCE-MODES-PHASE-4.md).
- [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) sincronizado até `2.11.0`.

**Commits:** `171b078`, `f899af0`, `b240284`, `2cc2b2a`

---

## [2.10.108] — 2026-06-19

### Adicionado

- WebChat: menu robotizado quando `AiSettings.attendanceMode === robotic` (`WebChatRoboticTriageService`, reusa `inbox-triage.ts`).

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-4.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-4.md)

**Commit:** `f899af0`

---

## [2.10.107] — 2026-06-19

### Adicionado

- Campo `attendanceMode` em `AiSettings` (Mongo) com backfill lazy.
- API `GET/PATCH /platform/ai/settings` inclui `settings.attendanceMode`.
- `isAiActive()` exige `premium_assistant`; helper `shouldRunGenerativeAi()`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-3.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-3.md)

**Commit:** `b240284`

---

## [2.10.106] — 2026-06-19

### Adicionado

- Tipos e adapter `src/types/attendance-mode.ts` (modo × provedor legado).
- UI `/platform/inbox/ia`: 4 cards de modo + seção Provedor da IA.
- Componentes `AttendanceModePicker`, `lib/attendanceMode.ts`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-1.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-1.md)
- [`ANALISE-MODOS-ATENDIMENTO.md`](./ANALISE-MODOS-ATENDIMENTO.md)

**Commit:** `2cc2b2a`

---

## Entregas anteriores

Ver changelog completo em [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) (versões `2.0.0` – `2.10.105` e demais patches WebChat/Inbox).

---

## Próxima entrada (template)

```markdown
## [2.11.x] — YYYY-MM-DD

### Adicionado / Alterado / Corrigido
- …

### Documentação
- …

**Commit:** `…`
```
