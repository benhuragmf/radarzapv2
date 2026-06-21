# RadarZap — Modos de Atendimento (Fase 7)

**Versão:** `2.11.3` · **Data:** 2026-06-19  
**Consolidado:** [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](../RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md)

---

## O que foi feito

### Contadores por modo (`AiUsage.usageKind`)

Campo opcional em `aiUsage` (Mongo):

| Valor | Origem |
|-------|--------|
| `premium_assistant` | `AiProviderService` — LLM conversacional Premium |
| `basic_triage` | `completeForBasicTriage` — fallback classificador IA Básica |
| `unknown` | Registros legados não classificados |

Backfill na leitura: `provider === radarzap-basic-triage` → Básica; demais → Premium.

### Serviços

- **`AiUsageMeterService.recordUsage`** — persiste `usageKind`.
- **`getUsageSnapshot`** — inclui `dailyByKind` (Premium × Básica hoje).
- **`listUsage`** — `totals.byKind` + linhas com `usageKindLabel`.

### UI (`/platform/inbox/ia` → Logs e custos)

- Cards separados: total, IA Premium, IA Básica (LLM), tokens, custo.
- Resumo do dia (snapshot).
- Tabela das últimas 50 chamadas (data, modo, modelo, tokens, custo).
- Aba Geral: contagem diária Premium / Básica.

---

## O que NÃO foi feito

- Limites separados por modo (continua limite global de chamadas LLM).
- E2E Playwright (Fase 8).

---

## Como testar

1. Modo **IA Premium** → testar IA → ver linha `IA Premium` nos logs.
2. Modo **IA Básica** + toggle LLM fallback → mensagem ambígua → linha `IA Básica`.
3. `GET /api/platform/ai/usage` → `totals.byKind`.

```bash
npm test -- --testPathPattern="ai-usage-kind"
```

---

## Próxima fase

Roadmap modos 0–8 concluído. Ver consolidado § Próximas fases.
