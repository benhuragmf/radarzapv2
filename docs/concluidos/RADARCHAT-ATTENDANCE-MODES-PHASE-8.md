# Radar Chat — Modos de Atendimento (Fase 8)

**Versão:** `2.11.4` · **Data:** 2026-06-19  
**Consolidado:** [`RADARCHAT-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](../RADARCHAT-MODOS-ATENDIMENTO-IMPLEMENTACAO.md)

---

## O que foi feito

### E2E Playwright (preview Vite, mock de API)

Testes autenticados **sem backend** — interceptam `GET /auth/me` e rotas `/api/platform/ai/*` via `page.route`.

| Arquivo | Papel |
|---------|--------|
| `e2e/fixtures/mock-panel-api.ts` | Usuário mock + payload `AiSettings` + usage |
| `e2e/attendance-modes.spec.ts` | Spec dos 4 modos na página `/platform/inbox/ia` |

### Cenários cobertos

1. **4 cards** visíveis (`data-testid="attendance-mode-*"`).
2. **Robotizado** — banner + link Triagem e Bot.
3. **IA Básica** — banner classificador local.
4. **IA Premium** — provedor Radar Chat habilitado e selecionado.
5. **Logs e custos** — cards `IA Premium` / `IA Básica (LLM)` com totais mock.
6. **Salvar** — `PATCH /platform/ai/settings` inclui `attendanceMode: robotic`.

### UI

- `AttendanceModePicker` — `data-testid` por modo para seletores estáveis.

---

## O que NÃO foi feito

- E2E WebChat com mock `/webchat/ai-status` (opcional futuro).
- E2E com backend real / sessão OAuth.

---

## Como testar

```bash
npm run build --prefix src/services/web-dashboard/frontend
npm run test:e2e -- --project=chromium e2e/attendance-modes.spec.ts
```

CI já executa `npm run test:e2e -- --project=chromium` após build do frontend.

---

## Próxima fase

Roadmap geral de modos concluído (Fases 0–8). Melhorias futuras: limites LLM por modo, E2E WebChat, QA manual gate Fase 1.
