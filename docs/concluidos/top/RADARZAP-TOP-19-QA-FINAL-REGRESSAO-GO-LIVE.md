# RadarZap — TOP 19/20 — QA Final, Regressão e Checklist Pré-Go-Live

**Versão:** `2.12.5` · **Data:** 2026-06-24 · **Branch:** `main` · **Commit base:** `6857327` (TOP 18)

---

## Resumo executivo

Etapa de **QA final automatizado e regressão documentada** antes do congelamento TOP 20. Nenhuma feature nova; correções mínimas apenas em seletores E2E desatualizados após upgrade visual do Inbox (título no `Header` global, fora de `<main>`).

**Resultado:** todos os gates obrigatórios **verdes**; E2E Playwright **38/38** após correção; **772** testes Jest; gate atendimento **237** + webchat-wa **62**; frontend build OK.

**Produção:** não declarada pronta. **Deploy:** não executado. **Push:** não realizado (conforme escopo TOP 19).

**Próximo passo:** TOP 20 — roteiro manual Benhur (blocos A–J abaixo), SSL/VPS, Stripe live, WhatsApp QR real.

---

## Herança dos TOPs anteriores

| TOP | Tema | Entrega consolidada |
|-----|------|---------------------|
| **01** | Diagnóstico inicial | Riscos build/CSAT/prod; baseline quebrado na época — corrigido TOP 02–18 |
| **02** | Baseline / gates | `typecheck`, `build`, `npm test`, `qa:atendimento:gate`, CI frontend `tsc -b` |
| **03** | Planos / limites | `config/plans.json`, validador, créditos IA do catálogo |
| **04** | RBAC / equipe | Papéis, caps, cross-tenant, assentos por plano |
| **05** | Status / presença / fila | Online/ausente/ocupado, round-robin, supervisor sem fila |
| **06** | Modos atendimento | 5 modos + `attendanceMode` + credential source |
| **07** | Inbox | Fila, assign, transferência, setores internos |
| **08** | Tickets / TK | Token público, janela 12h, SLA, audit |
| **09** | Leads / Kanban | Dedupe, estágios, inbox em 1 clique |
| **10** | Formulários públicos | Embed, honeypot, limites plano |
| **11** | WebChat | Widget, fila, FAQ, pré-chat, modelos chat box |
| **12** | WhatsApp | Sessão, QR, comandos `!ajuda`/`!assumir`/etc., rate limit |
| **13** | Bridge | WebChat ↔ WA após `!assumir`, anti-loop |
| **14** | IA Básica | Classificador local, KB, encaminhamento |
| **15** | IA Premium | KB, skills, handoff, `usageKind` |
| **16** | IA Créditos | Carteira, débito proporcional, alertas 80/90/100 |
| **17** | Billing | Stripe test, limites, `billing.limit.blocked` |
| **18** | Segurança / LGPD | `mask-secret`, audit redact, eventos billing/ticket/form |

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `6857327` — `chore(top): auditoria seguranca e lgpd 2.12.4` |
| Working tree | Limpo (exceto untracked locais) |
| Untracked (não commitados) | `data/`, `mocker/modelochat/` |
| Risco mistura | Baixo — alterações TOP 19 limitadas a `e2e/` e `docs/` |

---

## Escopo autorizado

**Executado:** inventário QA, gates, regressão documentada, roteiro manual, checklist pré-go-live, fixes E2E mínimos, versionamento `2.12.5`.

**Não executado:** deploy, push, Stripe live, produção pronta, TOP 20, features novas, redesign UI.

---

## Inventário de scripts de QA

| Script | Existe? | Finalidade | Executado no TOP 19? | Resultado |
|--------|---------|------------|----------------------|-----------|
| `npm run typecheck` | Sim | TS backend | Sim | Verde |
| `npm run build` | Sim | Build backend | Sim | Verde |
| `npm test` | Sim | Jest completo (127 suites) | Sim | Verde — 772 testes |
| `npm run qa:atendimento:gate` | Sim | Gate atendimento + billing/IA/audit | Sim | Verde — 237 testes + qa:webchat-wa |
| `npm run qa:webchat-wa` | Sim | WebChat/WA/bridge/ticket público | Sim (via gate) | Verde — 62 testes + qa:prep |
| `npm run qa:gate` | Sim | test + build + frontend build | Equivalente* | Verde* |
| `npm run qa:fase1:all` | Sim | E2E + qa:atendimento:gate | Equivalente* | Verde* |
| `npm run qa:fase1:e2e` | Sim | Playwright 6 specs chromium | Sim | Verde — 38/38 |
| `npm run lint` | Sim | ESLint backend (escopo limitado) | Não | — |
| `npm run lint:all` | Sim | ESLint backend completo | Não | — |
| Frontend `npm run build` | Sim | `tsc -b && vite build` | Sim | Verde |
| Frontend `npm run lint` | Sim | ESLint painel | Sim (diagnóstico) | 159 problemas legados — não bloqueia build |

\* `qa:gate` e `qa:fase1:all` não rodados como comando único (evitar sobrecarga OneDrive); componentes executados separadamente com mesmo resultado.

Outros: `qa:prep`, `qa:webchat-wa:setup`, `qa:leads:setup`, `qa:manual:start` (= atendimento gate).

---

## Gates obrigatórios executados

| Gate | Resultado | Observação |
|------|-----------|------------|
| `npm run typecheck` | Verde | — |
| `npm run build` | Verde | `sync-widget-build` 2.12.5 |
| `npm test` | Verde | 127 suites, 772 testes; warning open handles (ver riscos) |
| `npm run qa:atendimento:gate` | Verde | Inclui `qa:webchat-wa` + `qa:prep` MongoDB OK |

---

## Gates opcionais executados

| Gate | Resultado | Observação |
|------|-----------|------------|
| `npm run qa:webchat-wa` | Verde | Via gate atendimento |
| `npm run qa:fase1:e2e` | Verde | 38 passed após fix seletores |
| `qa:gate` | Verde (equivalente) | test + build + frontend build individuais |
| `qa:fase1:all` | Verde (equivalente) | E2E + atendimento gate |
| Frontend `npm run lint` | Amarelo | 144 errors + 15 warnings legados (`no-unused-vars` etc.) |

---

## Diagnóstico de build e typecheck

- **Typecheck:** `tsc --noEmit` sem erros.
- **Build backend:** `tsc && tsc-alias` sem erros.
- **Widget sync:** `scripts/sync-widget-build.cjs` alinhado à versão do pacote.

---

## Diagnóstico de testes unitários e integração

- **Total:** 772 testes, 127 suites, ~21s.
- **Gate atendimento:** 237 testes em 35 suites (padrões inbound, CSAT, ticket, bridge, billing, mask-secret, etc.).
- **Integração destacada:** `inbox-csat-reply`, `inbox-ticket-inbound`, `inbox-inbound-order`, `inbox-ticket-audit`, `lead-form-public-submit`, `consent-defer`.
- **Aviso Jest:** `Force exiting Jest` / worker não encerra graciosamente — teardown async em alguns testes Mongo; não falha suites.

---

## Diagnóstico de frontend

- **Build:** `tsc -b && vite build` — OK (~600ms Vite).
- **Aviso:** chunk `index-*.js` > 500 kB (conhecido, não bloqueia).
- **Lint:** 159 problemas — dívida técnica UI; não impede compilação nem E2E.

---

## Diagnóstico de E2E

- **Config:** `playwright.config.ts`, preview porta **4174**, `webServer` Vite preview.
- **Specs:** `inbox-authenticated`, `atendimento-smoke`, `attendance-modes`, `qa-fase1-panel`, `qa-fase1-presence`, `leads-panel`.
- **Resultado final:** **38 passed** (chromium).
- **Pré-requisito:** backend offline aceito — mocks de API no Playwright; aviso `[vite] API offline` esperado.
- **Correção aplicada:** seletores Inbox (heading no Header); radio RadarZap com `/^RadarZap\b/` (strict mode).

---

## Regressão por módulo

| Módulo | Teste automatizado | Resultado | Observação |
|--------|-------------------|-----------|------------|
| Auth/RBAC | `capabilities-rbac`, `organization-team-cross-tenant` | Verde | Cross-tenant bloqueado |
| Equipe | `team-plan-limits`, invite email | Verde | Assentos por plano |
| Status/presença | `inbox-agent-presence*`, E2E presence | Verde | PATCH status no header |
| Modos atendimento | `attendance-mode`, E2E modes | Verde | 5 modos + provedor |
| Inbox | gate inbound + E2E inbox | Verde | Lista, fila, assign |
| Tickets/TK | `ticket-*`, integração inbound | Verde | Token, janela 12h |
| Leads/Kanban | `lead-*`, E2E leads-panel | Verde | Dedupe, Kanban mock |
| Formulários públicos | `lead-form-public-submit`, token | Verde | Honeypot/limites no gate |
| WebChat | `webchat-*`, público security | Verde | Widget config sync doc |
| WhatsApp | `whatsapp-agent`, `WhatsAppService` | Verde | Comandos, rate limit |
| Bridge | `webchat-bridge*`, fallback | Verde | Anti-loop alert |
| IA Básica | `basic-triage*`, `webchat-basic-triage` | Verde | Classificador + KB |
| IA Premium | `premium-ai`, `AiTicketAssist` | Verde | Handoff, usageKind |
| IA Créditos | `ai-wallet`, `ai-credits`, alerts | Verde | Saldo depleted gate |
| Billing | `billing-state`, `plan-limit` | Verde | Bloqueios mockados |
| Auditoria/segurança/LGPD | `mask-secret`, `attendance-audit` | Verde | Redact meta/logs |
| Frontend/dashboard | E2E panel + build | Verde | Rotas atendimento |
| Widget scripts | build + `webchat-public-security` | Verde | Sem clientId em key pública |
| Webhooks | `webhook-events`, `WebhookDispatcher` | Verde | HMAC outbound |
| Rate limits | `whatsapp-session-rate-limit` | Verde | Tipos atendimento/campanha |

---

## Regressão de segurança

| Controle | Validação | Resultado |
|----------|-----------|-----------|
| Logs sem segredo | `mask-secret.util.test.ts` | Verde |
| Token TK não em audit | `attendance-audit`, redact meta TOP 18 | Verde (código + testes) |
| Widget key sem clientId | `webchat-public-security`, `webchat-token` | Verde |
| Form key sem clientId | `lead-form-token` | Verde |
| Stripe webhook HMAC | `webhook-signature`, `billing-env` | Verde |
| IA provider key não em log | `mask-secret` paths | Verde |
| QR WA não em log | `mask-secret` | Verde |
| Cross-tenant | `organization-team-cross-tenant`, `inbox-org-access` | Verde |
| Payload público validado | `webchat-public-security`, `lead-form-submit` | Verde |

**Manual TOP 20:** inspeção logs runtime, CORS produção, `SESSION_ENCRYPTION_KEY`.

---

## Regressão de billing e IA Créditos

| Item | Validação | Resultado |
|------|-----------|-----------|
| Planos carregam | `plan-config.test.ts` | Verde |
| Limites por plano | `plan-limit`, `team-plan-limits`, `lead-form-plan-limit` | Verde |
| Checkout test | Documentado TOP 17; sem Stripe live | Doc |
| Pacote IA sem pagamento | `billing-state` mocks | Verde |
| Saldo IA bloqueia provider | `ai-wallet`, depleted UI E2E modes | Verde |
| Alertas 80/90/100 | `ai-credit-alerts.util` | Verde |
| Downgrade não apaga dados | Política TOP 17 (sem teste destrutivo) | Doc |
| `billing.limit.blocked` auditado | `attendance-audit` + TOP 18 | Verde |

---

## Regressão WebChat, WhatsApp e Bridge

| Fluxo | Automatizado | Manual TOP 20 |
|-------|--------------|---------------|
| Widget config | `webchat-*` utils, E2E webchat | Preview modelo live |
| Fila WebChat | E2E banner fila site | Round-robin real |
| Fallback WA | `webchat-whatsapp-fallback` | Baileys offline real |
| Comandos WA | `whatsapp-agent-command` | `!assumir` com sessão |
| Bridge `!assumir` | `webchat-bridge-webhook` | Ciclo completo site↔WA |
| Anti-loop bridge | `bridge:alert_skipped_same_session` log test | Confirmar sem spam |
| `qa:webchat-wa` | Verde | — |

---

## Regressão Inbox, Tickets, Leads e Formulários

- **Inbox:** fila, transferência, assign — gate + E2E.
- **Tickets:** TK/token, lookup falho auditado, notas internas — integração inbound.
- **Leads:** dedupe `lead-dedupe`, Kanban E2E, limites plano.
- **Formulários:** `lead-form-public-submit` integração Mongo.
- **LGPD consentimento:** `consent-defer`, `consent-manual-block`.
- **Limites:** `leadForms`, `leadsPerMonth`, `contacts`, `ticketsPerMonth` — utils no gate.

---

## Roteiro manual final para Benhur

Executar no **TOP 20** com backend + Mongo + Redis + sessão WA real. Registrar em `docs/QA-FASE1-RESULTADO-TEMPLATE.md`.

### Bloco A — Login e Dashboard

1. Login Owner/Admin.
2. Ver Dashboard.
3. Ver plano/limites.
4. Ver alertas (sino).
5. Conferir versão `2.12.5` / doc sistema.

### Bloco B — Equipe e Status

1. Criar funcionário.
2. Testar permissões (atendente vs supervisor).
3. Online / ausente / ocupado.
4. Supervisor online sem receber fila.
5. Auto-ausente por inatividade.

### Bloco C — WebChat

1. Abrir widget embed.
2. Pré-chat (nome, WhatsApp, motivo).
3. Mensagem genérica.
4. Mensagem comercial.
5. FAQ / catálogo.
6. Fila no painel.
7. Offline / fallback WhatsApp.

### Bloco D — WhatsApp

1. Conectar sessão (QR).
2. Receber mensagem inbound.
3. `!ajuda`
4. `!assumir`
5. `!ticket`
6. `!nota`
7. `!encerrar` / encerrar chat

### Bloco E — Bridge

1. Cliente no WebChat sem atendente.
2. Alerta WhatsApp equipe.
3. Atendente `!assumir` no WA.
4. Resposta chega no WebChat.
5. Encerrar bridge.
6. Sem loop de alertas.

### Bloco F — Tickets

1. Criar ticket.
2. Consultar TK + token (widget/site).
3. Responder na janela 12h.
4. Token inválido → 404/audit.
5. Notas internas não visíveis ao cliente.

### Bloco G — Leads e Formulários

1. Submit formulário público embed.
2. Contato criado/atualizado.
3. Lead na fila.
4. Dedupe mesmo e-mail.
5. Mover Kanban.
6. Limite do plano (bloqueio).

### Bloco H — IA

1. Modo robotizado (menu setores).
2. IA Básica (triagem local).
3. IA Premium (RadarZap).
4. Sem créditos (fallback/bloqueio).
5. Handoff humano.
6. Logs/uso/créditos no painel.

### Bloco I — Billing

1. Ver planos `/plans`.
2. Checkout Stripe **test**.
3. Pacote IA test.
4. Webhook mockado (CLI Stripe).
5. Limites bloqueando criação (widget/lead).

### Bloco J — Segurança/LGPD

1. Token inválido (ticket/form/widget).
2. Cross-tenant (outra org).
3. Consentimento renovação.
4. Export CSV contatos.
5. Logs sem segredo (grep produção).

---

## Checklist pré-go-live

| Item | Status | Observação |
|------|--------|------------|
| 1. Typecheck verde | OK | TOP 19 |
| 2. Build backend verde | OK | TOP 19 |
| 3. Testes verdes | OK | 772 |
| 4. QA atendimento verde | OK | gate + prep |
| 5. QA WebChat/WA verde | OK | incluído no gate |
| 6. Frontend build verde | OK | TOP 19 |
| 7. E2E executado | OK | 38/38 chromium |
| 8. WhatsApp QR manual | Pendente | TOP 20 Bloco D |
| 9. Stripe test validado | Doc | TOP 17; manual TOP 20 |
| 10. Stripe live não ativado | OK | — |
| 11. Webhook secret em env | Pendente | TOP 20 deploy |
| 12. SESSION_ENCRYPTION_KEY prod | Pendente | TOP 20 |
| 13. IA keys fora do código | OK | env/org |
| 14. Mongo/Redis/RabbitMQ doc | OK | PREPARACAO-PRODUCAO |
| 15. Rate limits revisados | OK | código + testes |
| 16. Logs seguros | OK | mask-secret TOP 18 |
| 17. LGPD documentada | OK | CONSENTIMENTO-LGPD |
| 18. Backups definidos | Pendente | TOP 20 infra |
| 19. Variáveis `.env` doc | OK | PREPARACAO-PRODUCAO |
| 20. Domínio/CORS revisado | Pendente | TOP 20 |
| 21. SSL/reverse proxy | Pendente | TOP 20 |
| 22. Deploy não executado | OK | — |
| 23. Produção não marcada pronta | OK | — |
| 24. Pendências listadas | OK | este doc |
| 25. TOP 20 recomendado | OK | go-live manual |

---

## Bugs encontrados

| ID | Módulo | Severidade | Descrição | Status | Correção |
|----|--------|------------|-----------|--------|----------|
| E2E-01 | E2E Inbox | Medium | `getByRole('main').getByRole('heading', 'Caixa de Entrada')` falha — título no Header global | Corrigido | `expectInboxLoaded()` em `mock-inbox-api.ts` |
| E2E-02 | E2E IA modes | Low | `getByRole('radio', /RadarZap/)` strict mode (2 elementos) | Corrigido | Seletor `/^RadarZap\b/` |
| LINT-01 | Frontend | Low | 159 problemas ESLint legados | Aberto | Pós-go-live; não bloqueia build |
| JEST-01 | Testes | Low | Worker Jest force exit / open handles | Aberto | `--detectOpenHandles` futuro |

---

## Correções aplicadas

1. `e2e/fixtures/mock-inbox-api.ts` — helper `expectInboxLoaded`.
2. `e2e/inbox-authenticated.spec.ts` — usa helper; link supervisor.
3. `e2e/qa-fase1-presence.spec.ts` — usa helper.
4. `e2e/attendance-modes.spec.ts` — seletor radio RadarZap.

---

## Gates finais

Sequência pós-correções (2026-06-24):

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Verde |
| `npm run build` | Verde |
| `npm test` | Verde — 772 |
| `npm run qa:atendimento:gate` | Verde |
| `npm run qa:fase1:e2e` | Verde — 38 |
| Frontend `npm run build` | Verde |

---

## Arquivos alterados

- `docs/top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md` (novo)
- `docs/RADARZAP-SISTEMA-COMPLETO.md` §22 e §24
- `docs/CHANGELOG.md`, `docs/SISTEMA-REGISTRO.md`, `docs/INDICE-DOCUMENTACAO.md`
- `README.md`, `package.json`
- `.cursor/rules/radarzap-v2-system-registry.mdc`
- `e2e/fixtures/mock-inbox-api.ts`
- `e2e/inbox-authenticated.spec.ts`
- `e2e/qa-fase1-presence.spec.ts`
- `e2e/attendance-modes.spec.ts`

**Não alterados / não commitados:** `data/`, `mocker/modelochat/`, `.env`

---

## Riscos reduzidos

- Regressão TOP 01 (build/CSAT quebrados) **confirmada resolvida**.
- E2E Inbox **alinhado** ao layout 3 colunas (título no Header).
- Gate atendimento cobre **billing + IA créditos + segurança** pós TOP 17–18.

---

## Riscos restantes

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| WhatsApp Baileys real (QR, ban, reconexão) | Alta | Bloco D manual TOP 20 |
| Bridge loop em produção | Média | Bloco E + monitor `bridge:*` |
| Stripe live / webhooks prod | Alta | TOP 20 + checklist item 11 |
| ESLint frontend dívida | Baixa | Não bloqueia release técnico |
| Jest open handles | Baixa | CI ainda verde |
| OneDrive + disco 100% em gates paralelos | Média | Rodar gates sequenciais |
| Produção não validada end-to-end | Alta | TOP 20 obrigatório |

---

## Decisões pendentes para Benhur

1. **Go-live:** executar TOP 20 manual antes de VPS.
2. **Stripe live:** ativar somente após checklist J + I em test.
3. **Domínio/CORS/SSL:** definir host final e `ALLOWED_ORIGINS`.
4. **Backups Mongo:** política retenção (PREPARACAO-PRODUCAO).
5. **Lint frontend:** corrigir em sprint separado ou aceitar dívida.
6. **Push/commit TOP 19:** commit local; push quando autorizar.

---

## Próximo passo recomendado

**TOP 20/20 — Congelamento final e go-live controlado:**

1. Executar roteiro manual blocos A–J.
2. Seguir `docs/PREPARACAO-PRODUCAO.md` e `docs/PRODUCTION.md`.
3. VPS + SSL + env produção.
4. Sessão WhatsApp real + bridge + CSAT em ambiente espelho.
5. Registrar resultado em template QA e fechar `RADARZAP-TOP-20-*.md`.
6. **Não** declarar produção estável até gate humano WA verde.
