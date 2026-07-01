# Auditoria geral do sistema — Radar Chat

**Data do ciclo:** 2026-06-30  
**Versão do produto (base):** `2.17.25` → entrega deste ciclo `2.17.26`  
**Branch:** `audit-system-health-docs`  
**Commit base:** `1bd4582` (`fix: WA logout 401…`)  
**Escopo:** diagnóstico horizontal — backend, frontend, segurança, estabilidade, dados, UX, documentação, deploy.

---

## Resumo executivo

O Radar Chat v2 (`2.17.25`) é um **monolito Node.js 24** (Express + Socket.IO na porta 3001) com painel React/Vite, MongoDB e Redis/BullMQ. A base de código está **madura e compilável**; `npm run typecheck`, `npm run build` e `npm run pre-push:gate` passam. A suíte Jest tem **182/188 suites verdes** após correções deste ciclo; 6 suites de integração ainda falham (documentadas como pendência média).

**Pontos fortes verificados:** RBAC por capability na API do painel; isolamento tenant na maioria das rotas Inbox/WebChat/Leads; webhooks outbound com HMAC; upload WebChat com magic bytes; política inbound CRM configurável; catálogo PIX com auditoria `AttendanceEvent`; logout WA 401 não prende mais o processo (2.17.25+).

**Riscos principais:** Socket.IO visitante WebChat sem checagem de origem equivalente ao HTTP; token RadarGamer global; staff `GET /sessions?scope=all` cross-tenant; CSRF parcial (Origin ausente); presença de atendentes in-memory (cluster); testes Vitest misturados no Jest (parcialmente corrigido).

**Proximidade de produção:** o sistema **opera em produção** (`app.radarchat.com.br`); este ciclo **reforça documentação e pequenos hardenings**, sem alterar contratos `RADARZAP_*` / `X-RadarZap-Signature` / volumes `radarzap-*`. Gate de estabilização Fase 1 (`ROADMAP-COMPLETUDE.md`) ainda exige **QA manual humano** antes de declarar go-live controlado.

---

## Stack real verificada

| Camada | Tecnologia | Onde |
|--------|------------|------|
| Backend | Node 24, TypeScript, Express, ts-node-dev (dev) | `src/index.ts` |
| API painel | `DashboardService.ts` — `/api`, Socket.IO | `src/services/web-dashboard/` |
| WhatsApp | Baileys (`WhatsAppService.ts`) | `src/services/whatsapp/` |
| Filas | BullMQ + Redis | `src/cache/QueueManager.ts` |
| Banco | MongoDB (Mongoose, 47 modelos) | `src/models/` |
| Frontend | Vite 8, React, TanStack Query | `src/services/web-dashboard/frontend/` |
| Auth | Sessão cookie `radarchat.sid` (Redis) + OAuth Google/Discord | `src/auth/rbac/` |
| Deploy prod | Docker monolith (`docker/Dockerfile.monolith`), Coolify | `docker-compose.coolify.yml` |
| Dev infra | `docker compose up -d redis mongodb` | `docker-compose.yml` |

---

## Comandos executados e resultados

| Comando | Resultado |
|---------|-----------|
| `git checkout -b audit-system-health-docs` | OK — branch criada a partir de `develop` @ `1bd4582` |
| `npm run typecheck` | **Exit 0** |
| `npm run build` | **Exit 0** |
| `npm test` | **Exit 1** — 182 passed, 6 failed, 1058 tests passed (ver § Estabilidade) |
| `npm audit --omit=dev` | **0 vulnerabilities** (runtime) |
| `npm run pre-push:gate` (ciclo anterior 2.17.25) | **Exit 0** — backend + frontend + Docker frontend-builder |

---

## Falhas por severidade

### Críticas

*Nenhuma falha crítica nova com exploit trivial confirmado neste ciclo.* Itens de hardening abaixo são **altos** com mitigação parcial existente.

### Altas

| ID | Área | Descrição | Arquivo / evidência | Status |
|----|------|-----------|---------------------|--------|
| A-H01 | WebChat | Socket.IO com `webchatVisitorToken` sem validação de origem no handshake | `DashboardService.ts` ~840–850 | **Pendente** — ciclo dedicado |
| A-H02 | Admin | `GET /api/sessions?scope=all` expõe sessões WA de todos os tenants para staff | `DashboardService.ts` ~8412–8444 | **Pendente** — restringir `SYSTEM_ADMIN` + auditoria |
| A-H03 | Integração | RadarGamer inbound: token Bearer global + `clientId` fixo por env | `radargamer-inbound.service.ts` | **Pendente** — API key por tenant |
| A-H04 | CSRF | `requireDashboardOrigin` não bloqueia se header `Origin` ausente | `src/middleware/same-origin.ts` | **Pendente** — exigir Origin/Sec-Fetch-Site |
| A-H05 | Estabilidade | 6 suites Jest de integração falham (worker crash / asserts) | ver lista abaixo | **Pendente** — estabilizar CI |

### Médias

| ID | Área | Descrição | Status |
|----|------|-----------|--------|
| M-01 | Logs | Staff/`LOGS_GLOBAL` consulta `SystemLog` sem `clientId` | Pendente |
| M-02 | Rate limit | Integrações inbound sem limiter Express no mount | Pendente |
| M-03 | Rate limit | Ticket lookup público usa `Map` in-memory (multi-réplica) | Pendente → Redis |
| M-04 | WebChat | Token visitante aceito em query `?v=` | Pendente |
| M-05 | Presença | `inbox-agent-presence` in-memory — diverge em cluster | Documentado |
| M-06 | Body | `express.json` 16 MB global — risco DoS em rotas pesadas | Pendente — limites por rota |
| M-07 | CSP | `script-src 'unsafe-inline'` no painel | Pendente gradual |
| M-08 | Templates | Edge case IDOR template global (`clientId == null`) | Pendente |
| M-09 | Testes | Arquivos Vitest no repositório sem runner Vitest no root | **Parcial** — excluídos do Jest neste ciclo |
| M-10 | PIX | Sem OCR/validação automática de comprovante — fluxo humano | Por design — documentado |
| M-11 | CRM | Visitante WebChat sem telefone: vínculo contato/lead fraco | Pendente produto |
| M-12 | Backup cron | `POST /admin/backup/runs` exige sessão + token (cron headless) | Documentado em `admin-backup` |

### Baixas

| ID | Descrição | Status |
|----|-----------|--------|
| B-01 | Comparação token backup não constant-time | **Corrigido** 2.17.26 (`timingSafeEqual`) |
| B-02 | Stripe webhook sem rate limit dedicado | Pendente |
| B-03 | `GET /api/discord/public/status` enumerável | Aceito (embed) |
| B-04 | `models/index.ts` exporta subset legado | Documentado |
| B-05 | APIGateway `:8080` legado vs monolito `:3001` | Documentado |

---

## Correções aplicadas neste ciclo (2.17.26)

| Correção | Arquivo | Motivo |
|----------|---------|--------|
| `timingSafeEqual` no token interno de backup | `admin-backup.service.ts` | Timing attack (baixa) |
| Jest ignora testes Vitest (6 arquivos) | `jest.config.js` | Suites falhavam por `Cannot find module 'vitest'` |
| Mock `WhatsAppSession.findOne` em testes WA | `WhatsAppService.test.ts` | Compatibilidade com `shouldSkipWhatsAppSessionRestore` |
| `ensureClientReady`: fast-path socket ativo antes de skip | `WhatsAppService.ts` | Envio com socket conectado não bloqueava indevidamente |

*(Correções 2.17.25 já em `main`: logout WA 401, Redis pub/sub, backup dev banner.)*

---

## Correções não aplicadas (motivo)

| Item | Motivo |
|------|--------|
| Hardening Socket.IO WebChat origem | Risco de quebrar embeds legítimos — exige QA widget |
| Restringir `sessions?scope=all` | Decisão de produto/ops — pode afetar suporte interno |
| API key RadarGamer por tenant | Migração de contrato + env VPS |
| CSRF estrito | Pode quebrar clientes sem Origin — testar OAuth/integrações |
| OCR comprovante PIX | Escopo de IA/visão — ciclo próprio |
| Mover presença para Redis cluster-wide | Refatoração infra |

---

## Verificações específicas obrigatórias

### 1. Contatos × Leads

| Pergunta | Resposta verificada |
|----------|---------------------|
| WA cria contato automaticamente? | **Sim** — `ConsentService.findOrCreateContactFromInbound` + política `inboundRegistrationPolicy` |
| WebChat cria contato? | **Sim** — `webchat-destination-link.util.ts` (com telefone) |
| Lead automático? | **Sim** — `LeadFormService.maybeCapture*` + `shouldAutoCaptureLead` |
| Config por empresa/canal? | **Sim** — `InboxSettings.inboundRegistrationPolicy`, UI `InboxBotSettings` aba Cadastro CRM |
| Vínculo lead↔contato↔conversa? | **Sim** — `LeadCapture.destinationId`, `inboxConversationId`, `open-inbox` |
| Lacuna | Visitante sem telefone; modo `lead` com `inbox_only` pode confundir em `/contact` |

### 2. Comprovante PIX

| Pergunta | Resposta |
|----------|----------|
| Imagem/PDF no canal? | **Sim** — WebChat + WA inbound → `CatalogSalesService.handleInboundProof` |
| IA valida imagem? | **Não** — conferência humana no painel |
| Encaminhar para outro WA? | **Sim** — alerta interno texto + link HMAC (`sendInternalAlert`) |
| RBAC + auditoria? | **Sim** — `orders:*` capabilities + `AttendanceEvent` |
| Doc | `docs/CATALOGO-PIX-PEDIDOS.md` |

### 3. Fila e atendimento

| Item | Status |
|------|--------|
| Presença online/ausente/ocupado/supervisor | **Implementado** — `agent-presence.ts` |
| Round-robin / fila | **Implementado** — `InboxService.pickNextRoundRobinUser` |
| Transferência / assumir / auditoria | **Implementado** — `AttendanceEvent`, `InboxTransfer` |
| Lacuna | Presença não cluster-safe; transferência atendente direta só via supervisor |

### 4. WebChat

| Item | Status |
|------|--------|
| Domínio widget | `allowedDomains` + `assertOrigin` |
| Offline/fallback WA | `webchat-whatsapp-fallback.service.ts` |
| Anti-spam | Rate limit mensagens (~12/min) — sem CAPTCHA |
| Lacuna | Socket visitante sem origem; honeypot só em forms de lead |

### 5. WhatsApp

| Item | Status |
|------|--------|
| Reconexão / logout 401 | **Corrigido** 2.17.25 — `handleSessionDisconnect` + blocklist |
| Rate limit | `RateLimiter` + políticas por tipo |
| Bridge WebChat | `webchat-whatsapp-bridge.service.ts` |
| Logs | `SystemLog`, `AttendanceEvent` |

### 6. IA / Billing / RBAC

| Módulo | Status verificado |
|--------|-------------------|
| IA | Limites plano + `AiWalletService` + `usageKind` — doc `IA-CREDITOS-E-CARTEIRA.md` |
| Billing | Stripe webhook assinado; grace `past_due` — `BILLING.md` |
| RBAC | `requireCapability` por rota; menus `navConfig` + `ROUTE_PERMISSIONS` |

### 7. Deploy / Docker

| Item | Status |
|------|--------|
| Healthcheck | `GET /api/services/health` |
| Coolify compose | `docker-compose.coolify.yml` |
| `.env.example` | Atualizado (sem segredos reais) |
| Volumes legados `radarzap-*` | Mantidos por compatibilidade — não renomeados |

---

## Suites Jest ainda falhando (2026-06-30)

1. `inbox-csat-reply.integration.test.ts`
2. `inbox-automated-peer.integration.test.ts`
3. `inbox-ticket-inbound.integration.test.ts` (worker crash)
4. `whatsapp-bridge-commands.service.test.ts`
5. `webchat-socket-origin.util.test.ts`
6. `ai-context-collection.test.ts`

**Recomendação:** executar cada suite isolada com `--runInBand` e corrigir em ciclo `fix/integration-tests-gate`.

---

## Checklist de produção (resumo)

- [x] Build backend + frontend verde
- [x] `npm audit` runtime sem high+
- [x] Logout WA não trava processo
- [ ] QA manual Fase 1 (`QA-AUDITORIA-GERAL-SISTEMA.md`)
- [ ] 100% suites Jest verdes
- [ ] Hardening WebChat socket (A-H01)
- [ ] Restringir sessões cross-tenant staff (A-H02)

---

## Próximos ciclos recomendados

1. **Segurança WebChat socket + CSRF** — A-H01, A-H04  
2. **Integrações inbound** — rate limit + API key por tenant (A-H03, M-02)  
3. **Testes integração** — 6 suites vermelhas (A-H05)  
4. **QA manual Fase 1** — preencher `docs/qa-results/`  
5. **Presença Redis cluster** — M-05  

---

## Referências cruzadas

- [`PENDENCIAS-E-RISCOS-SISTEMA.md`](./PENDENCIAS-E-RISCOS-SISTEMA.md)
- [`QA-AUDITORIA-GERAL-SISTEMA.md`](./QA-AUDITORIA-GERAL-SISTEMA.md)
- [`ROADMAP-COMPLETUDE.md`](./ROADMAP-COMPLETUDE.md)
- [`concluidos/ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md`](./concluidos/ENTREGA-AUDITORIA-HORIZONTAL-2.12.47-59.md) — ciclo anterior
