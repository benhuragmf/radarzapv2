# RadarZap — Modos de atendimento (Fase 3)

**Versão:** 2.10.107 · **Data:** 2026-06-19

Continuação de [`RADARZAP-ATTENDANCE-MODES-PHASE-1.md`](./RADARZAP-ATTENDANCE-MODES-PHASE-1.md). **Visão consolidada:** [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md).

---

## O que foi feito

### Persistência Mongo

- Campo `attendanceMode` em `AiSettings` (coleção `aiSettings`).
- Valores: `disabled` | `robotic` | `basic_triage` | `premium_assistant`.
- Default: `disabled`.

### Backfill seguro (lazy)

- Em `AiSettingsService.getSettingsDoc()`: se `attendanceMode` ausente ou inválido, infere de `mode` legado e grava.
- Tenants antigos com `mode: radarzap` → `attendanceMode: premium_assistant`.
- Tenants com `mode: disabled` → `attendanceMode: disabled` (não distingue robotic até o usuário salvar).

### API

- `GET/PATCH /api/platform/ai/settings` inclui `settings.attendanceMode` no payload.
- `PATCH` com `attendanceMode` sincroniza `mode` + `enabled` via adapter.
- `PATCH` só com `mode` legado (clientes antigos) ainda funciona e atualiza `attendanceMode`.

### Runtime

- `AiSettingsService.isAiActive()` exige `attendanceMode === premium_assistant` **e** `mode` ativo.
- Modo `robotic` persistido **não** altera fluxo de mensagens ainda — bot WA segue como antes.
- `shouldRunGenerativeAi()` disponível para uso futuro nos serviços de mensagem.

### UI

- Robotizado persiste após salvar e recarregar.
- Textos atualizados (sem aviso de “perde ao recarregar”).

---

## O que NÃO foi feito

- Robotizado no WebChat (Fase 4).
- IA Básica com classificador local (Fase 5).
- Orquestrador / alteração em `InboxService`, `WebChatService`, `AiConversationService`.
- Script bulk de migração (backfill lazy é suficiente por enquanto).

---

## Mapeamento após Fase 3

| `attendanceMode` | `mode` | `enabled` | LLM ativo? |
|---|---|---|---|
| `disabled` | `disabled` | `false` | Não |
| `robotic` | `disabled` | `false` | Não |
| `basic_triage` | `disabled` | `false` | Não (UI bloqueada) |
| `premium_assistant` + RadarZap | `radarzap` | `true` | Sim |
| `premium_assistant` + Chave própria | `company` | `true` | Sim |

---

## Próxima fase

**Fase 4:** reutilizar bot robotizado do WhatsApp no WebChat de forma segura.

---

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/models/AiSettings.ts` | Campo `attendanceMode` |
| `src/types/attendance-mode.ts` | `resolveAttendanceMode`, `shouldRunGenerativeAi`, patch |
| `src/services/ai/AiSettingsService.ts` | Backfill, payload, upsert, `isAiActive` |
| `frontend/.../AiAtendimento.tsx` | Salva/carrega `attendanceMode` |
