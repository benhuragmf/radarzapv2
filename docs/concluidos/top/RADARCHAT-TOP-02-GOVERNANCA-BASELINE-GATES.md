# Radar Chat — TOP 02/20 — Governança, Baseline e Gates Obrigatórios

**Data:** 2026-06-24  
**Versão após TOP 02:** `2.11.88`  
**Branch:** `main`

---

## Resumo executivo

O TOP 02 restaurou o **baseline técnico verde** identificado como quebrado no TOP 01. Todos os gates obrigatórios desta etapa passaram nesta máquina.

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | ✅ |
| `npm run build` (backend) | ✅ |
| `npm test` | ✅ (561/561) |
| `npm run qa:atendimento:gate` | ✅ |
| `npm run build` (frontend) | ✅ |
| `npm run lint` (frontend) | ⚠️ 159 issues legado — fora do escopo TOP 02 |

O sistema **não** está pronto para produção. Esta etapa apenas garante que alterações futuras (TOP 03+) partem de uma base compilável e testável.

---

## Herança do TOP 01

Do diagnóstico TOP 01, corrigimos nesta etapa:

1. **7 erros TypeScript** em `WebChatService.ts` (Date vs string, badge setor, tipo de retorno `inactivitySla`).
2. **Build frontend** — campo `inactivityCloseGracefulQuickCode` ausente na interface `InboxSettings` em `InboxBotSettings.tsx`.
3. **Teste CSAT** — mock incompleto de `ConsentService.findContactDestinationForInbound`.
4. **CI frontend** — passou de `npx vite build` para `npm run build` (`tsc -b && vite build`).
5. **Versionamento** — alinhado `2.11.88` em `package.json`, README, ÍNDICE, CHANGELOG, SISTEMA-REGISTRO.

Não implementado (conforme escopo): modo híbrido, PIX, novos planos, features comerciais, QA manual.

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `9eaa8cd` — fix(ui) Inbox 2.11.87 |
| Modificados antes | `widget.js` (tracked) |
| Untracked | `data/`, `mocker/modelochat/`, `docs/top/` |
| Risco mistura | Baixo — untracked locais não commitados |

---

## Escopo autorizado

- Correções TS/build/teste/CI/docs de governança.
- Incremento patch `2.11.88`.
- Documentos em `docs/top/`.

**Fora do escopo:** billing, RBAC, IA, leads, inbox lógica, webchat comportamento, WhatsApp, produção.

---

## Correções aplicadas

### Backend TypeScript

**Arquivo:** `src/services/webchat/WebChatService.ts`

- Helper `optionalIsoDate()` para normalizar `Date` → ISO string em campos de inatividade e timestamps.
- `departmentBadgeFieldsFrom()` recebe objeto com `clientVisible` default `true` (lean Mongo pode omitir campo).
- Tipo de retorno de `getDetailForInbox()` inclui `inactivitySla` (já retornado em runtime; tipo estava incompleto).

### Frontend TypeScript/build

**Arquivo:** `src/services/web-dashboard/frontend/src/pages/menu/InboxBotSettings.tsx`

- Adicionado `inactivityCloseGracefulQuickCode?: string` à interface local `InboxSettings` (campo já usado na UI e no backend).

### Teste CSAT

**Arquivo:** `src/services/inbox/__tests__/inbox-csat-reply.integration.test.ts`

- Mock `findContactDestinationForInbound` no `ConsentService` (método real existe em produção).
- Default mock retorna `mockDest()` no `beforeEach` do bloco `handleInboundMessage ordem CSAT`.

### CI e gates

**Arquivo:** `.github/workflows/ci.yml`

- Job `frontend-build`: `npx vite build` → `npm run build`.
- Job `e2e` build preview: idem.

### Documentação e versionamento

| Arquivo | Alteração |
|---------|-----------|
| `package.json` | `2.11.88` |
| `README.md` | Versão `2.11.88` |
| `docs/INDICE-DOCUMENTACAO.md` | Versão `2.11.88` |
| `docs/CHANGELOG.md` | Entrada 2.11.88 |
| `docs/SISTEMA-REGISTRO.md` | Versão + linha changelog |
| `.cursor/rules/radarchat-v2-system-registry.mdc` | Espelho 2.11.88 |
| `src/services/web-dashboard/webchat/widget.js` | `WIDGET_BUILD` sync prebuild → 2.11.88 |

---

## Gates oficiais a partir do TOP 02

| Situação | Gates mínimos |
|----------|---------------|
| Mudança backend | `npm run typecheck`, `npm run build`, `npm test` |
| Mudança Inbox/WA/WebChat | `npm run qa:atendimento:gate` + testes do módulo |
| Mudança frontend | `npm run build` em `src/services/web-dashboard/frontend/` |
| Mudança billing/planos | testes `billing/*` + `npm test` |
| Mudança RBAC | testes auth/RBAC + `npm test` + revisão cross-tenant |
| Mudança docs apenas | checar links/versão + `git diff` |
| Antes do TOP 20 | `npm run qa:gate`, `npm run qa:fase1:all`, QA manual Benhur |

---

## Gates executados

| Comando | Local | Resultado | Observação |
|---------|-------|-----------|------------|
| `npm run typecheck` | raiz | ✅ | 0 erros |
| `npm run build` | raiz | ✅ | prebuild sync widget 2.11.88 |
| `npm test` | raiz | ✅ | 100 suites, 561 testes |
| `npx jest …inbox-csat-reply…` | raiz | ✅ | 6/6 |
| `npm run qa:atendimento:gate` | raiz | ✅ | inclui `qa:prep` OK |
| `npm run build` | frontend | ✅ | `tsc -b && vite build` |
| `npm run lint` | frontend | ⚠️ | 159 problemas legado — não bloqueia TOP 02 |
| `npm run qa:fase1:e2e` | — | Não executado | Gate TOP 19/20 |
| `npm run lint:all` | raiz | Não executado | ~7k issues documentados no ROADMAP |

---

## Gates pendentes ou não executados

- `npm run qa:fase1:all` / `npm run qa:gate` — etapas finais (TOP 19–20).
- `npm run lint` frontend — legado; não corrigido nesta etapa.
- QA manual WhatsApp — TOP 20 (Benhur).

---

## Arquivos alterados

```
.github/workflows/ci.yml
README.md
docs/CHANGELOG.md
docs/INDICE-DOCUMENTACAO.md
docs/SISTEMA-REGISTRO.md
docs/top/RADARCHAT-TOP-01-DIAGNOSTICO-INICIAL.md (novo, TOP 01)
docs/top/RADARCHAT-TOP-02-GOVERNANCA-BASELINE-GATES.md (este arquivo)
package.json
src/services/inbox/__tests__/inbox-csat-reply.integration.test.ts
src/services/web-dashboard/frontend/src/pages/menu/InboxBotSettings.tsx
src/services/web-dashboard/webchat/widget.js
src/services/webchat/WebChatService.ts
.cursor/rules/radarchat-v2-system-registry.mdc
```

**Não commitados:** `data/`, `mocker/modelochat/`

---

## Riscos reduzidos

1. Build backend/frontend não quebra silenciosamente no dev.
2. CI frontend agora executa `tsc -b` — erros TS não ficam escondidos atrás de `vite build` only.
3. Gate atendimento (`qa:atendimento:gate`) verde — regressão CSAT detectável.
4. Versão documentação alinhada ao `package.json`.

---

## Riscos restantes

1. **Produção** — Fase 1 estabilização ainda aberta (QA manual WA).
2. **Lint frontend** — 159 erros; `lint:all` backend fora do CI.
3. **InboxService monolítico** — mudanças futuras exigem gate atendimento.
4. **Billing/comercial** — matriz planos incompleta (TOP 03).
5. **Modo híbrido** — ausente; decisão comercial pendente.
6. **Open handles Jest** — warning `Force exiting Jest` (não bloqueante).

---

## Decisões para TOP 03

1. Definir matriz comercial: planos × atendentes × widgets × mensagens × créditos IA.
2. Mapear `config/plans.json` → `Organization.limits` enforcement.
3. Responder perguntas comerciais do TOP 01 (Benhur).
4. Não alterar comportamento de atendimento até planos documentados.

---

## Próximo passo recomendado

**TOP 03 — Planos, mensalidades, limites e matriz comercial.**

Gates de saída TOP 03: `plan-config.test.ts`, `npm test`, documento em `docs/top/`.

---

*TOP 02 concluído — baseline técnico verde; sistema não declarado pronto para produção.*
