# QA Fase 1 — o que é automático vs manual

**Versão:** `2.11.41` · **Atualizado:** 2026-06-22

Resposta curta: **parte sim pelo navegador (Playwright), mas não substitui o manual com WhatsApp real.** O gate § Estabilização exige validar Baileys + celular cliente — isso não roda no CI hoje.

---

## Três camadas de teste

| Camada | Comando | O que valida | Substitui manual? |
|--------|---------|--------------|-------------------|
| **Unitário + integração** | `npm run qa:atendimento:gate` | CSAT, ticket, routing, bridge utils, presença, webhooks | Parcial — lógica de negócio, não UI real |
| **E2E navegador (mock API)** | `npm run qa:fase1:e2e` | Painel Inbox/Supervisor/IA sem backend; rotas exigem login | Parcial — § B visual + fluxos UI mockados |
| **Manual celular + WA** | [`QA-FASE1-RAPIDO.md`](./QA-FASE1-RAPIDO.md) | Mensagens reais, CSAT no WhatsApp, bridge `!assumir` | **Obrigatório** para fechar gate |

---

## Mapa checklist → automação

| Checklist | Automático hoje | Manual obrigatório |
|-----------|-----------------|-------------------|
| **§ A WhatsApp (1–10)** | Helpers + integração (`inbox-csat-reply`, `inbox-ticket-inbound`, `inbox-inbound-order`) | **Sim** — enviar/receber no celular |
| **§ B Painel (rotas)** | Smoke login + **8 rotas mock** (`qa-fase1-panel.spec.ts`) | Smoke visual ao vivo no `dev` |
| **§ C WebChat** | Utils fallback/FAQ/bridge (`qa:webchat-wa`) | Widget real, anexos, token TK, bridge bidirecional |
| **§ E Presença/supervisor/sino** | `inbox-agent-presence.test.ts`; UI supervisor mock E2E | Heartbeat real, sino após timeout fallback |

---

## E2E Playwright — como funciona hoje

- **Preview Vite** (`playwright.config.ts`) — frontend estático, **sem** Mongo/Baileys.
- **Mock de API** (`e2e/fixtures/mock-inbox-api.ts`, `mock-panel-api.ts`) — intercepta `/auth/me` e `/api/*`.
- **CI:** `npm run test:e2e -- --project=chromium` (27 testes no pipeline).

```bash
npm run qa:fase1:e2e          # subset Fase 1 (Inbox, Supervisor, modos IA, smoke rotas)
npm run test:e2e              # suite completa (+ mobile, login, PWA)
npm run test:e2e:ui           # modo interativo (ver no navegador)
```

### Specs relevantes Fase 1

| Arquivo | Cobertura |
|---------|-----------|
| `e2e/inbox-authenticated.spec.ts` | Lista Inbox, fila, Assumir, supervisor métricas |
| `e2e/atendimento-smoke.spec.ts` | 9 rotas Atendimento redirecionam para login |
| `e2e/qa-fase1-panel.spec.ts` | § B: tickets, setores, bot, respostas, relatórios, webchat |
| `e2e/qa-fase1-presence.spec.ts` | Seletor status operacional + PATCH presença |
| `e2e/attendance-modes.spec.ts` | Página IA Atendimento (4 modos, mock) |

**Total `qa:fase1:e2e`:** 33 testes Chromium (build frontend + preview Vite, mock API, sem Mongo/Baileys).

## Por que § A WhatsApp não automatiza no navegador

1. **Playwright controla o painel**, não o app WhatsApp no celular.
2. **Baileys** exige sessão QR conectada — CI não tem número de teste Meta.
3. **Plano Fase 1** proíbe envio WA automatizado em massa (`PLANO-CONSULTA` §2.3).
4. **CSAT/ticket** dependem da ordem real `WhatsAppService` → ticket → consent → inbox (integração Jest cobre lógica; não o socket Baileys).

### O que seria necessário para E2E “live” (futuro, pós-gate)

| Peça | Descrição |
|------|-----------|
| `PLAYWRIGHT_BASE_URL=http://localhost:5173` | Painel contra `dev` real |
| Auth E2E | Cookie de sessão ou `E2E_AUTH_TOKEN` só em dev |
| Harness inbound WA | API interna ou script que injeta mensagem simulada (hoje: scripts dev + integração) |
| Número sandbox | WhatsApp Business test number ou mock Baileys dedicado |

Isso é **Fase 2/piloto** — não bloqueia o gate atual se o manual § A passar.

---

## Fluxo recomendado

```txt
1. npm run qa:fase1:e2e     → navegador mock (2 min)
2. npm run qa:manual:start  → gate Jest (1 min)
3. QA-FASE1-RAPIDO.md       → manual celular (~2 h)
```

Se **1 ou 2 falhar** → corrigir código antes do manual.  
Se **3 falhar** → registrar cenário # em `QA-FASE1-RESULTADO-*.md` → patch.

---

## Referências

- [`QA-FASE1-KICKOFF.md`](./QA-FASE1-KICKOFF.md)
- [`QA-FASE1-RAPIDO.md`](./QA-FASE1-RAPIDO.md)
- `playwright.config.ts`, `e2e/fixtures/`
