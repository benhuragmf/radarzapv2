# RadarZap — TOP 01/20 — Diagnóstico Inicial

**Data da auditoria:** 2026-06-24  
**Versão declarada em `package.json`:** `2.11.87`  
**Executor:** agente TOP (somente leitura + gates; sem alteração de código de produção)

---

## Resumo executivo

O RadarZap v2 é um **monólito TypeScript** (Express + MongoDB + Redis + BullMQ) com painel React (Vite) e widget WebChat embedável. A superfície funcional é **ampla e real no código** — Inbox unificada (WA + WebChat), tickets (`TK-…`), leads/Kanban, RBAC por empresa, presença operacional, modos de atendimento (4 modos), IA Básica/Premium, créditos/carteira IA, billing Stripe (teste), webhooks outbound, consentimento LGPD base.

**Estimativa de completude:** ~75–85% para SaaS vendável. O núcleo de atendimento passou por muitas correções (2.8.7–2.11.87); a documentação interna ainda classifica a **Fase 1 (estabilização)** como bloqueante para produção.

**Estado dos gates nesta máquina (2026-06-24):**

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | **FALHA** — erros TS em `WebChatService.ts` |
| `npm run build` | **FALHA** — mesmos erros TS |
| `npm test` | **FALHA parcial** — 560/561 pass; 1 falha em `inbox-csat-reply.integration.test.ts` |
| `npm run qa:atendimento:gate` | **FALHA** — mesma suite CSAT |
| `npm run lint` (escopo estreito) | **OK** |
| `npm run build` (frontend `tsc -b`) | **FALHA** — `InboxBotSettings.tsx` / `inactivityCloseGracefulQuickCode` |
| `npm run qa:fase1:e2e` | **Não executado** (Playwright + build; documentado como gate manual Fase 1) |
| `npm run lint:all` | **Não executado** (ROADMAP cita ~7k issues; não bloqueia CI hoje) |

**Conclusão TOP 01:** o sistema **existe e funciona em dev** para a maior parte dos módulos, mas **build backend + frontend estrito e 1 teste de integração CSAT estão vermelhos** no estado atual de `main`. Há divergências de versão entre docs. Modo **híbrido** de atendimento e gateways **PIX/Mercado Pago/Asaas** **não existem** no código. Billing real = **Stripe apenas** (modo teste documentado).

---

## Estado Git

| Item | Valor |
|------|-------|
| **Branch atual** | `main` |
| **Último commit** | `9eaa8cd` — `fix(ui): Inbox e IA compactos em 1080p sem cortar composer (2.11.87)` |
| **Arquivos modificados (tracked)** | Nenhum |
| **Arquivos untracked** | `data/` (mídia webchat/inbox), `mocker/modelochat/` (assets de mock) |
| **Risco de mistura** | **Baixo** — working tree limpa em código versionado; untracked são dados locais/mocks, não interferem nesta etapa TOP |

**Histórico recente (10 commits):** foco em Inbox UI, WebChat tickets, carteira IA, triagem/inatividade, Leads (2.11.70–2.11.79), fixes setor/menu WA.

---

## Estrutura do projeto

Monorepo **single-package** na raiz (`package.json`); frontend em subpasta com `package.json` próprio.

```
radarzapv2/
├── src/                          # Backend + domínio
│   ├── index.ts                  # Boot principal
│   ├── auth/rbac/                # RBAC, capabilities, middleware
│   ├── models/                   # Schemas Mongoose (49 modelos)
│   ├── services/                 # Microserviços lógicos
│   │   ├── ai/                   # IA Premium, Básica, wallet, usage
│   │   ├── billing/              # Stripe, planos, expiração
│   │   ├── inbox/                # Inbox, tickets, presença, CSAT
│   │   ├── webchat/              # Widget API, bridge, fallback
│   │   ├── whatsapp/             # Baileys
│   │   ├── leads/                # Captura, Kanban
│   │   ├── consent/              # LGPD
│   │   ├── queue/                # BullMQ workers
│   │   ├── web-dashboard/        # DashboardService.ts + frontend + widget
│   │   └── ...
│   ├── types/                    # Tipos compartilhados
│   ├── middleware/               # Express middleware
│   └── utils/
├── src/services/web-dashboard/
│   ├── DashboardService.ts       # API painel ~6600 linhas
│   ├── frontend/                 # React 19 + Vite + TanStack Query
│   └── webchat/widget.js         # Widget embed público
├── config/plans.json             # Catálogo comercial
├── docs/                         # Documentação extensa (~60 .md)
├── e2e/                          # Playwright (8 specs)
├── scripts/                      # QA, Stripe, deploy, seeds
├── docker/                       # Compose prod/dev
└── .github/workflows/            # CI (test, build, e2e smoke)
```

| Área | Localização |
|------|-------------|
| Backend/API | `src/index.ts`, `src/services/web-dashboard/DashboardService.ts` (`/api`) |
| Frontend/dashboard | `src/services/web-dashboard/frontend/` |
| WebChat/widget | `src/services/web-dashboard/webchat/widget.js`, `src/services/webchat/` |
| WhatsApp | `src/services/whatsapp/WhatsAppService.ts`, Baileys |
| Filas/workers | `src/services/queue/QueueProcessorService.ts`, BullMQ |
| Modelos | `src/models/*.ts` |
| Billing | `src/services/billing/`, `config/plans.json` |
| IA | `src/services/ai/`, `AiWalletService.ts`, `AiUsageMeterService.ts` |
| Auth | `src/auth/rbac/`, sessão Express + Redis |
| Permissões | `src/auth/rbac/capabilities.ts`, `companyRolePresets.ts`, `middleware.ts` |
| Testes unitários | `**/__tests__/*.test.ts` (~100 arquivos) |
| Testes E2E | `e2e/*.spec.ts` (8 specs) |
| Documentação | `docs/`, `.cursor/rules/` |

**Não há** pastas `backend/`, `apps/`, `packages/` separados — tudo consolidado em `src/`.

---

## Documentação encontrada

### Governança

| Documento | Versão/ref | Observação |
|-----------|------------|------------|
| `README.md` | **2.5.1** | **Desatualizado** vs `package.json` 2.11.87 |
| `docs/INDICE-DOCUMENTACAO.md` | **2.11.84** | Levemente atrás do código |
| `docs/SISTEMA-REGISTRO.md` | 2.11.x | Espelho versionado |
| `docs/CHANGELOG.md` | Ativo | Append-only |
| `docs/VERSIONAMENTO-E-DOCUMENTACAO.md` | Protocolo | OK |
| `docs/ROADMAP-COMPLETUDE.md` | **2.11.41** | Gate estabilização parcialmente marcado; Fase 1 ainda aberta para QA manual |

### Módulos

| Módulo | Documento principal | Status declarado |
|--------|---------------------|------------------|
| Inbox | `INBOX-ATENDIMENTO.md` | Implementado; fixes 2.8.x–2.11.x |
| Tickets | `TICKET-ATENDIMENTO.md` | Implementado |
| WebChat | `WEBCHAT.md` | Implementado 2.9.x–2.10.x |
| Leads | `LEADS-FORMULARIO.md` | 2.11.57–79 |
| RBAC | `EQUIPE-RBAC.md` | 2.1+ / 2.11.48–50 |
| IA Créditos | `IA-CREDITOS-E-CARTEIRA.md` | 2.11.84–85 |
| Modos atendimento | `RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md` + `concluidos/PHASE-*` | Fases 1–8 concluídas |
| Billing | `BILLING.md` | Stripe teste |
| QA | `QA-FASE1-*.md`, `QA-WEBCHAT-WA-*.md` | Gate auto validado 2026-06-22 no doc |
| Produção | `PREPARACAO-PRODUCAO.md`, `PRODUCTION.md` | Referência; não executar ainda |

### Módulos declarados concluídos (docs)

Webhooks outbound, painel sem "Em breve", WebChat embed, Inbox 3 colunas, supervisão/presença, alertas críticos, modos atendimento Fases 1–8, leads Kanban, carteira IA.

### Módulos declarados pendentes (docs)

- Estabilidade atendimento WA (QA manual Fase 1) — 🔴
- Cloud API Meta — 🟡 stub 503
- Compliance audit persistido — 🟡 TODOs
- Lint CI — 🔴 ~7k issues
- Recarga créditos IA via Stripe — documentado como **futuro** em `IA-CREDITOS-E-CARTEIRA.md`

### Divergências documentação ↔ código (amostra)

| Tema | Doc diz | Código diz |
|------|---------|------------|
| Versão produto | README 2.5.1; ÍNDICE 2.11.84 | `package.json` **2.11.87** |
| Modo híbrido | Memória produto / visão | **Ausente** — só `disabled`, `robotic`, `basic_triage`, `premium_assistant` |
| Gate testes | ROADMAP: verde 2026-06-22 | **Hoje:** 1 teste CSAT falha + build TS quebrado |
| Frontend CI | `npx vite build` sem tsc estrito | `npm run build` local usa `tsc -b` e **falha** |
| Billing PIX | Pergunta comercial | **Só Stripe** no código |

---

## Scripts e gates disponíveis

### Raiz (`package.json` v2.11.87)

| Script | Função | Gate recomendado |
|--------|--------|------------------|
| `npm run dev` | Backend ts-node-dev | Dev local |
| `npm run dashboard:frontend` | Vite dev painel | Dev local |
| `npm test` | Jest (100 suites) | **Gate principal** |
| `npm run qa:atendimento:gate` | Subset atendimento + `qa:webchat-wa` | **Gate Fase 1 atendimento** |
| `npm run qa:gate` | test + build backend + build frontend | Gate completo (hoje quebrado) |
| `npm run qa:fase1:all` | E2E + atendimento gate | Pré-produção Fase 1 |
| `npm run qa:fase1:e2e` | Playwright 33 testes | Gate UI mock |
| `npm run typecheck` | `tsc --noEmit` | Qualidade TS |
| `npm run build` | `tsc` backend | CI `backend-build` |
| `npm run lint` | 3 arquivos apenas | Parcial |
| `npm run lint:all` | Todo `src/**/*.ts` | Não no CI |
| `npm run test:e2e` | Playwright smoke | CI e2e job |
| `npm run qa:prep` | Prep ambiente QA | Antes de manual |
| `npm run stripe:webhook` | Stripe CLI dev | Billing dev |
| `npm run docker:infra` | Redis + Mongo | Infra local |

### Frontend (`src/services/web-dashboard/frontend/package.json`)

| Script | Função |
|--------|--------|
| `npm run dev` | Vite :5174 |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | ESLint frontend |

### CI (`.github/workflows/ci.yml`)

Jobs: `test` (jest + audit), `backend-build` (tsc), `frontend-build` (**vite only, sem tsc**), `e2e` (smoke login+PWA).

**Observação:** CI pode passar enquanto `typecheck`/`tsc -b` local falham — gap de governança para TOP 02.

---

## Variáveis de ambiente detectadas

> Valores **nunca** registrados abaixo. Apenas presença em `.env.example` e `.env` local.

| Variável | Encontrada em exemplo? | Encontrada localmente? | Módulo provável | Observação |
|----------|------------------------|------------------------|-----------------|------------|
| `MONGODB_URL` | Sim | Sim | Banco | Obrigatório |
| `MONGO_PASSWORD` | Sim | Sim | Docker Mongo | |
| `REDIS_URL` | Sim | Sim | Sessão/filas | |
| `JWT_SECRET` | Sim | Sim | Auth | |
| `JWT_EXPIRES_IN` | Sim | Sim | Auth | |
| `SESSION_SECRET` | Sim | Sim | Sessão cookie | |
| `SESSION_ENCRYPTION_KEY` | Sim | Sim | Sessões WA criptografadas | Crítico produção |
| `API_PORT` / `API_HOST` | Sim | Sim (API_*) | API | Local também tem `PORT` |
| `CORS_ORIGIN` | Sim | Sim | CORS | |
| `FRONTEND_URL` | Sim | Sim | OAuth + cookie | Deve bater com Vite |
| `DISCORD_TOKEN` | Sim | Sim | Discord bot | |
| `DISCORD_CLIENT_ID/SECRET` | Sim | Sim | OAuth Discord | |
| `DISCORD_GUILD_ID` | Sim | Sim | Slash commands | Opcional |
| `GOOGLE_CLIENT_ID/SECRET` | Sim | Sim | OAuth Google | Login dono |
| `RADARZAP_SYSTEM_ADMIN_DISCORD_IDS` | Sim | Sim | Admin sistema | |
| `RADARZAP_SYSTEM_MODERATOR_DISCORD_IDS` | Sim | Sim | Moderador | |
| `WHATSAPP_SESSION_TIMEOUT` | Sim | Sim | Baileys | |
| `WHATSAPP_RECONNECT_ATTEMPTS` | Sim | Sim | Baileys | |
| `WHATSAPP_HEADLESS` | Sim | Sim | Baileys | |
| `WHATSAPP_QRCODE_LIMIT` | Sim | **Não** | QR connect | Usa default |
| `WHATSAPP_CONNECT_QR_WAIT_MS` | Sim | **Não** | QR connect | |
| `META_APP_*` / `WHATSAPP_CLOUD_*` | Comentado | **Não** | Cloud API | Fase 2 |
| `QUEUE_CONCURRENCY` | Sim | Sim | BullMQ | |
| `QUEUE_MAX_RETRY` | Sim | Sim | BullMQ | |
| `QUEUE_DELAY_MULTIPLIER` | Sim | Sim | BullMQ | |
| `RATE_LIMIT_WINDOW` | Sim (`RATE_LIMIT_WINDOW`) | Sim (`RATE_LIMIT_WINDOW_MS`) | Rate limit | Nome diverge |
| `RATE_LIMIT_MAX_REQUESTS` | Sim | Sim | Rate limit | |
| `WEBHOOK_TIMEOUT_MS` | Sim | **Não** | Webhooks outbound | |
| `RESEND_API_KEY` | Sim | **Não** | E-mail convites | |
| `SMTP_*` | Comentado | **Não** | E-mail alt. | |
| `LOG_LEVEL/FORMAT/FILE_PATH` | Sim | Sim | Logs | |
| `NODE_ENV` | Sim | Sim | Ambiente | |
| `STRIPE_SECRET_KEY` | Sim | Sim | Billing | |
| `STRIPE_WEBHOOK_SECRET` | Sim | Sim | Billing | |
| `STRIPE_PRICE_ID_STARTER/PRO` | Sim | Sim | Billing | |
| `SUBSCRIPTION_SWEEP_MS` | Sim | Sim | Billing | |
| `ALLOW_DEV_BILLING` | Sim | Sim | Billing dev | |
| `RADARZAP_AI_OPENAI_KEY` | Comentado | Sim | IA RadarZap | |
| `GEMINI_API_KEY` | **Não** no example | Sim | IA própria | Lacuna no example |
| `COOKIE_SECURE` | Comentado | Sim | Produção HTTPS | |
| `BCRYPT_ROUNDS` | **Não** | Sim | Auth | Só local |
| `COOKIE_HTTP_ONLY` | **Não** | Sim | Auth | Só local |
| `HEALTH_CHECK_INTERVAL` | **Não** | Sim | Monitoring | Só local |

---

## Estado dos módulos

Legenda: **OK** = implementado e coerente; **PARCIAL** = existe com lacunas; **AUSENTE** = não encontrado; **RISCO** = pode quebrar produção/custo.

### Auth e multiempresa

**Classificação: OK (com PARCIAL em hardening)**

- Sessão Express + Redis (`radarzap.sid`), OAuth Google + Discord.
- Contexto multiempresa: `organizationId` na sessão; `buildAuthContext` resolve membro + capabilities.
- API integrações: `X-API-Key` por org (`ApiKey` model).
- **PARCIAL:** Cloud/prod exige `COOKIE_SECURE`, `SESSION_ENCRYPTION_KEY`; validação em `validateConfig`.
- **RISCO:** `ALLOW_DEV_API_KEY_BYPASS` documentado só dev — nunca em prod.

### RBAC e permissões

**Classificação: OK**

- Presets: `OWNER`, `ADMIN`, `MANAGER`, `ATTENDANT`, `INTEGRATION` + papéis custom (`Organization.customRoles`).
- Capabilities granulares (`Cap.INBOX_*`, `Cap.BILLING_VIEW`, `Cap.INBOX_SUPERVISE`, etc.).
- Backend: `requireCapability()` em `middleware.ts` — validação real na API.
- Frontend: `ProtectedRoute`, `navConfig` `ROUTE_PERMISSIONS`, `can(user, perm)`.
- **RISCO:** esconder menu ≠ segurança; porém rotas API parecem protegidas. Revisar endpoints públicos (`/api/webchat/public`, leads embed) no TOP 04.

### Equipe e status

**Classificação: OK (PARCIAL em regras de negócio finas)**

Implementado em `src/types/agent-presence.ts` + `inbox-agent-presence.ts`:

| Status | Existe | Recebe fila? |
|--------|--------|--------------|
| `online` | Sim | Sim |
| `ausente` | Sim | Não |
| `ocupado` | Sim | Não |
| `offline` | Sim | Não |
| `supervisor_online` | Sim | Não (supervisor monitora) |
| Ausente auto inatividade | Sim | `statusSource: 'auto'`, timeout configurável em `InboxSettings.agentPresenceTimeoutSeconds` |

- UI: `AgentStatusSelector` no header; heartbeat `useAgentPresenceHeartbeat`.
- Round-robin/fila respeita `QUEUE_ELIGIBLE_STATUSES = ['online']`.
- **Lacunas:** política quando atendente fica ausente **com chats ativos** (transferir vs manter) — precisa decisão Benhur. Limite de atendimentos simultâneos: verificar `inbox-queue-capacity` (existe teste).

### WebChat

**Classificação: OK (RISCO build TS atual)**

- Widget: `widget.js` + API `/api/webchat/public`.
- Modelos: `WebChatWidget`, `WebChatConversation`, `WebChatMessage`.
- Features: pré-chat, FAQ/KB, fila/setores, IA por modo, anexos, receipts, typing, fallback WA deferido, bridge bidirecional, modelos Chat Box (CSS).
- Integração Inbox: IDs `wc:`, lista unificada `channel=all`.
- Leads: captura visitante novo (`LEADS-FORMULARIO.md` 2.11.70).
- **RISCO:** `WebChatService.ts` com **7 erros TypeScript** (tipos Date vs string, `inactivitySla`) — build backend quebrado.
- **PARCIAL:** config painel ↔ widget exige espelho manual (`webchat-widget-config-sync` rule).

### WhatsApp

**Classificação: OK (PARCIAL — Baileys only)**

- Conexão: Baileys (`@whiskeysockets/baileys`), QR, sessão por org no Mongo (`WhatsAppSession`), criptografia `SESSION_ENCRYPTION_KEY`.
- Inbound → `InboxService.handleInboundMessage`; cria contato/lead.
- Comandos operacionais: `!assumir`, `!ticket`, `!encerrar`, `!ajuda`, etc. (whitelist equipe).
- Rate limit humanizado: `whatsapp-session-rate-limit.ts`, página `/platform/wa-limits`.
- Reconexão configurável.
- **AUSENTE:** WhatsApp Cloud API Meta — `DashboardService` retorna 503.
- **RISCO:** sessão WA única por política; mistura cross-tenant é mitigada por `clientId`/org — validar em TOP 12.

### Inbox e filas

**Classificação: OK (PARCIAL — QA manual pendente)**

- Conversa unificada WA + WebChat; departamentos públicos/internos (`internalRank`).
- Triagem bot, IA, fila, round-robin, transferência, chat interno (`direction: internal`).
- CSAT ao finalizar; SLA scan; inatividade auto-close (2.11.81).
- Supervisor: dashboard, monitor conversa (`InboxSupervisor.tsx`).
- **PARCIAL:** estabilidade CSAT/ticket — 1 teste integração falhando hoje.
- **RISCO:** `InboxService.ts` é arquivo crítico (~milhares de linhas); mudanças exigem gate atendimento.

### Tickets

**Classificação: OK**

- Modelo `InboxTicket`; código `TK-…` + token público.
- Status enriquecidos, SLA equipe, menu bot WhatsApp, consulta pública WebChat.
- Janela 12h resposta cliente (`ticket-reply-window.util.ts`).
- API paginada `GET /inbox/tickets`; UI `/platform/inbox/chamados`.
- Testes: `ticket-reply-window`, `inbound-routing`, `inbox-ticket-inbound`, `ticket-public-access`.
- Audit: `AttendanceEvent` create/close/client_replied.

### Leads e contatos

**Classificação: OK (PARCIAL UX/comercial)**

- **Contatos:** `Destination` model, consentimento LGPD, grupos, CSV import.
- **Leads:** `LeadCapture`, `LeadForm`; Kanban + lista; origens WA/WebChat/form/manual.
- Deduplicação por telefone documentada e testada (`lead-whatsapp-inbound`, `lead-webchat-inbound`).
- Intenção comercial sem LLM (`classifyLocal`).
- Sync qualificado ao encerrar atendimento.
- Abrir Inbox em 1 clique (`wc:`, WA).
- **PARCIAL:** funil Kanban oficial vs estágios no código — alinhar comercial TOP 09.

### Formulários

**Classificação: OK**

- Embed público leads (`LEADS-FORMULARIO.md`); tokens por formulário.
- Campos customizáveis; webhook `lead.created`.
- **PARCIAL:** limites por plano para formulários não verificados nesta auditoria.

### Modos de atendimento

**Classificação: PARCIAL**

Código (`src/types/attendance-mode.ts`):

| Modo código | UI | Aplicado no fluxo |
|-------------|-----|-------------------|
| `disabled` (humano) | Sim | Sim |
| `robotic` | Sim | Sim (`webchat-robotic-triage`) |
| `basic_triage` | Sim | Sim (classificador local WA + WC) |
| `premium_assistant` | Sim | Sim (LLM + KB) |
| **hybrid / híbrido** | **Não** | **Ausente** |

- Legado `AiSettings.mode` preservado via adapter; backfill lazy `attendanceMode`.
- Provedor separado: `credentialSource` radarzap vs company.
- **RISCO:** empresas antigas sem `attendanceMode` inferem `premium_assistant` do legado — comportamento documentado.
- Testes: `attendance-mode.test.ts`, E2E `attendance-modes.spec.ts`.

### IA

**Classificação: OK (PARCIAL custo)**

- Serviços: `AiProviderService`, `AiBasicTriageService`, `AiAutoResolveService`, `AiTicketAssistService`, `AiKnowledgeBaseService`, `AiEscalationService`.
- Provedores: OpenAI (chave RadarZap), Gemini (chave empresa no painel).
- Base de conhecimento por empresa; skills/memória; `usageKind` Premium vs Básica.
- Fallback escalação humana; bloqueio por cota LM.
- **RISCO:** sem créditos, LLM RadarZap bloqueia — deve cair humano/robotizado (documentado; validar E2E).

### IA Créditos

**Classificação: OK (PARCIAL billing recarga)**

- `Organization.aiWallet`, `AiUsage.creditWeight`, `AiWalletService`, `AiUsageMeterService`.
- Franquia por plano (Free 0, Starter 400, Pro 2500, Enterprise 12000).
- Barra painel `HeaderStatusPills` — LM vs IA.
- Permissão `inbox:ai:balance:view`.
- **PARCIAL:** `purchasedCredits` / recarga Stripe — **futuro** no doc.
- Testes: `ai-credits.test.ts`, `ai-wallet.test.ts`.

### Billing

**Classificação: PARCIAL**

- Planos: `config/plans.json` (free, starter R$99, pro R$299, enterprise sob consulta).
- Stripe Checkout + webhooks + sweep expiração (`BillingService.ts`).
- Dev: `ALLOW_DEV_BILLING`, `POST /api/billing/dev/activate`.
- Bloqueio: `Organization.canSendMessage()`, alertas `billing:*` no sino.
- UI: `/plans`, `/admin/payments`, `/admin/plans`.
- **AUSENTE:** Mercado Pago, Asaas, PagSeguro, PIX nativo, boleto.
- **PARCIAL:** enterprise `comingSoon`; limites de atendentes/widgets **não** mapeados em `plans.json` (só mensagens/dia).

### Logs, auditoria e segurança

**Classificação: PARCIAL (RISCO cross-tenant)**

- Logs: Pino/Winston; `SystemLog`; `AuditLog`; `AttendanceEvent`.
- Segurança: Helmet, CORS, rate limit Express, CSRF connect WA (2.10.87), field encryption, webhook HMAC.
- Validação: Joi em rotas; Zod no frontend forms.
- **PARCIAL:** `ComplianceService` com TODOs (persistência audit).
- **PARCIAL:** `lint:all` não no CI (~7k issues).
- **RISCO:** endpoints públicos webchat/leads — rate limit dedicado existe em partes; revisar TOP 18.
- OTP Redis para operações sensíveis (perfil, ticket token).

---

## Gates executados

Executados em 2026-06-24 nesta máquina (Windows, Node local). **Nenhuma correção aplicada.**

| Comando | Resultado | Observação |
|---------|-----------|------------|
| `npm run typecheck` | **FALHA** | 7 erros em `WebChatService.ts` (tipos department, Date/string, `inactivitySla`) |
| `npm run build` | **FALHA** | Mesmos erros TS do typecheck |
| `npm test` | **FALHA parcial** | 99 suites OK, 1 FAIL; **560 pass / 1 fail**; ~150s |
| `npm run qa:atendimento:gate` | **FALHA** | 22/23 suites; mesma falha CSAT |
| `npm run lint` | **OK** | Escopo: 3 arquivos webchat/inbox apenas |
| `npm run build` (frontend) | **FALHA** | `InboxBotSettings.tsx`: `inactivityCloseGracefulQuickCode` vs `inactivityCloseQuickCode` |
| `npm run qa:fase1:e2e` | **Não executado** | Requer Playwright + tempo; gate documentado Fase 1 |
| `npm run lint:all` | **Não executado** | ROADMAP: não bloqueia; volume alto |
| `npm run qa:gate` | **Não executado** | Dependeria de test+build — já sabidamente vermelho |

### Detalhe da falha de teste

```
FAIL src/services/inbox/__tests__/inbox-csat-reply.integration.test.ts
TypeError: consentSvc.findContactDestinationForInbound is not a function
  at InboxService.handleInboundMessage (InboxService.ts:1460)
```

Provável mock incompleto no teste ou refactor do `ConsentService` sem atualizar o teste.

### Comandos não executados (motivo)

| Comando | Motivo |
|---------|--------|
| `npm run deploy` | Destrutivo/infra |
| `npm run docker:prod` | Requer Docker prod |
| `npm run clear:test` | Altera estado DB |
| `npm run stripe:webhook` | Processo longo + rede externa |

---

## Riscos críticos encontrados

1. **Build TypeScript quebrado** (`WebChatService.ts`, `InboxBotSettings.tsx`) — CI backend-build pode falhar se tsc pegar esses arquivos; frontend CI usa vite sem tsc.
2. **Teste CSAT integração falhando** — regressão no gate `qa:atendimento:gate` documentado como obrigatório Fase 1.
3. **`InboxService.ts` monolítico** — qualquer mudança em inbound afeta WA+ticket+CSAT+consent+leads.
4. **Sincronização widget ↔ painel** — campo `appearance` não espelhado = bug silencioso em produção.
5. **Custo IA** — sem carteira/créditos, chamadas LLM RadarZap devem bloquear; risco de prejuízo se gate `AiUsageMeterService` falhar.
6. **Baileys em produção** — instabilidade de sessão WA; Cloud API ausente.
7. **Billing só Stripe teste** — sem PIX/boleto para mercado BR mainstream.
8. **Documentação de versão fragmentada** — README 2.5.1 vs produto 2.11.87 gera confusão em deploy.
9. **Dados untracked em `data/`** — mídia local; não commitar acidentalmente.
10. **Modo híbrido ausente** — expectativa produto vs código.

---

## Divergências entre documentação e código

| # | Divergência | Impacto |
|---|-------------|---------|
| 1 | Versão README 2.5.1 vs package 2.11.87 | Onboarding/deploy |
| 2 | ROADMAP marca gates verdes 2026-06-22; hoje 1 teste + build falham | Falsa sensação de pronto |
| 3 | Modo híbrido na visão produto; código tem 4 modos | Roadmap comercial |
| 4 | IA-CREDITOS cita recarga Stripe futura; sem implementação | Receita IA |
| 5 | `plans.json` não limita atendentes/widgets/IA por plano | Matriz comercial incompleta |
| 6 | CI frontend sem `tsc -b`; script local `build` falha | Drift TS frontend |
| 7 | `.env.example` sem `GEMINI_API_KEY` | Setup IA própria |
| 8 | INDICE 2.11.84 vs 2.11.87 | Governança docs |

---

## Lacunas que impedem produção

1. Gate estabilização Fase 1 incompleto (QA manual WA § A do `QA-FASE1-CHECKLIST.md`).
2. Build backend + frontend estrito vermelhos.
3. `qa:atendimento:gate` vermelho (CSAT integration).
4. Billing live Stripe não validado; sem gateway alternativo BR.
5. Cloud API Meta ausente (se requisito enterprise).
6. `PREPARACAO-PRODUCAO.md` / VPS não executados (correto pelo roadmap).
7. Matriz comercial planos × limites × features incompleta no código.
8. Recarga créditos IA não implementada.
9. Compliance audit persistido incompleto.
10. Lint global fora do CI.

---

## Roadmap TOP 02 a TOP 20

Sequência ajustada ao diagnóstico real. Cada etapa deve terminar com gates indicados **sem avançar se vermelho**.

### TOP 02 — Governança, versionamento, baseline e gates obrigatórios

- **Objetivo:** Alinhar versão docs/README/CHANGELOG; definir gates mínimos por etapa; corrigir drift CI (tsc vs vite).
- **Módulos:** docs, CI, `package.json`
- **Arquivos prováveis:** `README.md`, `docs/INDICE-DOCUMENTACAO.md`, `.github/workflows/ci.yml`, `docs/top/`
- **Riscos:** commits cosméticos sem valor; incluir `tsc` no CI pode bloquear até fixes TOP 07/11
- **Gates:** `npm run typecheck`, `npm test`, documentar baseline commit

### TOP 03 — Planos, mensalidades, limites e matriz comercial

- **Objetivo:** Formalizar limites (atendentes, widgets, mensagens, créditos IA) em `plans.json` + `Organization.limits`.
- **Módulos:** billing, plans
- **Arquivos:** `config/plans.json`, `Organization.ts`, `BillingService.ts`, UI `/plans`
- **Riscos:** quebrar orgs existentes sem migration
- **Gates:** `plan-config.test.ts`, `npm test`

### TOP 04 — RBAC, permissões, equipe e segurança multiempresa

- **Objetivo:** Auditoria endpoints públicos; papel financeiro; revisar bypass dev; testes cross-tenant.
- **Módulos:** auth, rbac, API pública
- **Arquivos:** `middleware.ts`, `DashboardService.ts`, `navConfig.ts`, `EQUIPE-RBAC.md`
- **Riscos:** bloquear integrações legítimas
- **Gates:** `npm test`, revisão manual rotas OpenAPI

### TOP 05 — Status de usuário, presença, ausência automática e distribuição segura

- **Objetivo:** Fechar regras ausente/ocupado + chats ativos; limite simultâneos; supervisor sem fila.
- **Módulos:** presença, fila
- **Arquivos:** `inbox-agent-presence.ts`, `InboxService.ts`, `inbox-queue-capacity`
- **Riscos:** starvation de fila; round-robin incorreto
- **Gates:** `inbox-agent-presence.test.ts`, `qa:fase1:presence` E2E

### TOP 06 — Modos de atendimento unificados

- **Objetivo:** Decidir híbrido (implementar ou remover da visão); garantir fallback crédito→humano/robotizado.
- **Módulos:** attendance-mode, IA settings
- **Arquivos:** `attendance-mode.ts`, `AiSettingsService.ts`, `AiAtendimento.tsx`
- **Riscos:** regressão empresas legado `mode`
- **Gates:** `attendance-mode.test.ts`, `attendance-modes.spec.ts`

### TOP 07 — Inbox, conversas, fila e transferência

- **Objetivo:** Estabilizar inbound; corrigir teste CSAT; reduzir acoplamento `InboxService`.
- **Módulos:** inbox
- **Arquivos:** `InboxService.ts`, testes integração inbox/*
- **Riscos:** **CRÍTICO** — núcleo atendimento
- **Gates:** `npm run qa:atendimento:gate`, `inbox-inbound-order.integration.test.ts`

### TOP 08 — Tickets, protocolo TK e rastreabilidade

- **Objetivo:** Validar TK+token em todos canais; OTP resend; audit completo.
- **Módulos:** tickets
- **Arquivos:** `InboxTicket.ts`, `ticket-public-access.service.ts`, `TICKET-ATENDIMENTO.md`
- **Riscos:** ambiguidade 0/O em TK (fix 2.11.86)
- **Gates:** `ticket-reply-window`, `inbox-ticket-inbound`, `ticket-public-access` tests

### TOP 09 — Contatos, Leads, Kanban e deduplicação

- **Objetivo:** Funil oficial; regras WA→contato vs lead; sync com Inbox.
- **Módulos:** leads, destinations
- **Arquivos:** `LeadFormService.ts`, `Destination`, `LEADS-FORMULARIO.md`
- **Riscos:** duplicação comercial
- **Gates:** `lead-*` tests, `leads-panel.spec.ts`

### TOP 10 — Formulários públicos, embed e captura de leads

- **Objetivo:** Limites por plano; spam/rate limit; UX embed.
- **Módulos:** leads forms
- **Arquivos:** `LeadForm.ts`, rotas públicas embed
- **Riscos:** abuso público sem rate limit
- **Gates:** `lead-form-token.util.test.ts`

### TOP 11 — WebChat, widget, fallback e experiência do visitante

- **Objetivo:** Corrigir erros TS `WebChatService`; sync config widget; QA fallback deferido.
- **Módulos:** webchat
- **Arquivos:** `WebChatService.ts`, `widget.js`, `WEBCHAT.md`
- **Riscos:** painel salva ≠ widget recebe
- **Gates:** `webchat-*` tests, `npm run build`

### TOP 12 — WhatsApp, sessão, comandos e reconexão

- **Objetivo:** Estabilidade Baileys; comandos `!*`; rate limit; lock sessão única.
- **Módulos:** whatsapp
- **Arquivos:** `WhatsAppService.ts`, `whatsapp-agent-auth.service.ts`
- **Riscos:** banimento WA; sessão cross-tenant
- **Gates:** `WhatsAppService.test.ts`, `whatsapp-*` tests, QA manual § A

### TOP 13 — Bridge WebChat ↔ WhatsApp

- **Objetivo:** Validar `!assumir` + bridge bidirecional; webhooks `webchat.bridge.*`.
- **Módulos:** bridge
- **Arquivos:** `webchat-whatsapp-bridge.service.ts`, `webchat-inbox-bridge.ts`
- **Riscos:** loop mensagens; anti-loop alerta (2.11.16)
- **Gates:** `webchat-bridge-webhook.test.ts`, `QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`

### TOP 14 — IA Básica, triagem e encaminhamento

- **Objetivo:** Classificador local; sem LLM indevido; encaminhamento setor.
- **Módulos:** basic triage
- **Arquivos:** `AiBasicTriageService.ts`, `basic-triage-classifier.ts`
- **Riscos:** falso positivo comercial
- **Gates:** `basic-triage-classifier.test.ts`, `webchat-basic-triage.service.test.ts`

### TOP 15 — IA Premium, base de conhecimento e handoff humano

- **Objetivo:** KB por empresa; escalação; `AiAutoResolveService` limites.
- **Módulos:** ai premium
- **Arquivos:** `AiKnowledgeBaseService.ts`, `AiEscalationService.ts`
- **Riscos:** dados sensíveis em prompt
- **Gates:** `AiTicketAssistService.test.ts`, `ai-escalation.test.ts`

### TOP 16 — IA Créditos, consumo, limites e fallback anti-prejuízo

- **Objetivo:** Carteira + recarga; fallback sem quebrar atendimento; alertas cota.
- **Módulos:** ai wallet
- **Arquivos:** `AiWalletService.ts`, `AiUsageMeterService.ts`, `IA-CREDITOS-E-CARTEIRA.md`
- **Riscos:** custo infinito LLM
- **Gates:** `ai-credits.test.ts`, `ai-wallet.test.ts`, `panel-critical-alerts`

### TOP 17 — Billing, assinatura, faturas, bloqueios e upgrade/downgrade

- **Objetivo:** Stripe live; decisão gateway BR; bloqueio inadimplência; créditos avulsos.
- **Módulos:** billing
- **Arquivos:** `BillingService.ts`, `subscription-expiry.service.ts`, `BILLING.md`
- **Riscos:** webhook Stripe mal configurado
- **Gates:** `billing-env.test.ts`, `plan-config.test.ts`

### TOP 18 — Logs, auditoria, segurança, LGPD e rate limit

- **Objetivo:** Compliance persistido; audit permissões; revisão endpoints públicos.
- **Módulos:** audit, consent
- **Arquivos:** `AuditLog.ts`, `ComplianceService`, `CONSENTIMENTO-LGPD.md`
- **Riscos:** vazamento cross-tenant
- **Gates:** `consent-*` tests, `field-encryption.test.ts`

### TOP 19 — QA automatizado completo, testes integrados e regressão

- **Objetivo:** `qa:gate` + `qa:fase1:all` verdes; ampliar cobertura WA E2E real.
- **Módulos:** testes
- **Arquivos:** `e2e/`, `jest.config`, `QA-FASE1-*.md`
- **Riscos:** flakiness Playwright
- **Gates:** `npm run qa:fase1:all`

### TOP 20 — Congelamento final, checklist de produção e preparação para teste visual/manual

- **Objetivo:** Gate § Estabilização completo; checklist `PRODUCTION.md` §0; sessão QA manual final.
- **Módulos:** todos
- **Arquivos:** `ROADMAP-COMPLETUDE.md`, `QA-FASE1-CHECKLIST.md`, `PREPARACAO-PRODUCAO.md`
- **Riscos:** declarar pronto sem QA WA real
- **Gates:** checklist § A–E assinado; `qa:gate`; tag versão

---

## Perguntas obrigatórias para Benhur antes do TOP 02

### Comercial e planos

- Quais planos existirão no lançamento?
- Terá plano gratuito ou apenas trial?
- Quantos atendentes entram em cada plano?
- Quantos widgets entram em cada plano?
- Quantos atendimentos por mês entram em cada plano?
- IA Premium será por plano, por crédito ou ambos?
- Qual será o bloqueio quando a mensalidade vencer?
- Haverá compra de créditos avulsos?

### Funcionários e permissões

- Quais cargos oficiais existirão?
- Supervisor pode atender ou só monitorar?
- Supervisor pode ficar online sem receber atendimento?
- Financeiro pode ver faturas e consumo?
- Atendente pode ver todos os contatos ou só os atribuídos?
- Atendente pode exportar dados?

### Atendimento

- Cliente deve ver posição na fila?
- Cliente deve poder escolher setor?
- Se não houver atendente, vai para WhatsApp, fila ou mensagem offline?
- Quando atendente ficar ausente, os atendimentos ativos continuam com ele ou voltam para fila?
- Quantos atendimentos simultâneos um atendente pode receber?

### Leads e contatos

- Todo WhatsApp vira contato?
- Todo WhatsApp vira lead?
- Lead só deve ser criado por intenção comercial?
- Qual funil Kanban oficial?
- Formulário embed será liberado em todos os planos?

### IA

- IA Básica pode usar provedor externo?
- IA Premium pode responder sozinha até qual limite?
- Quais dados podem ser enviados para IA?
- Deve existir base de conhecimento por empresa?
- Quando acabar crédito, o fallback é humano ou robotizado?

### Billing

- Qual gateway será usado?
- Vai ter PIX?
- Vai ter cartão recorrente?
- Vai ter boleto?
- Trial exige cartão?
- O bloqueio será imediato ou com carência?

### Perguntas técnicas adicionais (desta auditoria)

- Modo **híbrido** ainda é requisito? Se sim, qual comportamento exato?
- CI deve passar a exigir `tsc -b` no frontend (alinhar com dev local)?
- Prioridade: corrigir build TS atual antes de qualquer feature TOP 03+?

---

## Recomendação para o próximo prompt

**Iniciar TOP 02** com foco imediato em:

1. **Baseline verde:** corrigir erros TS em `WebChatService.ts` e `InboxBotSettings.tsx` + teste `inbox-csat-reply.integration.test.ts` (mock `ConsentService`) — *somente quando TOP 02 autorizar implementação*.
2. **Alinhar governança:** README, ÍNDICE e ROADMAP para `2.11.87`; registrar gates oficiais por etapa em `docs/top/`.
3. **Responder perguntas comerciais** (planos, limites, billing BR) antes de TOP 03–17.

**Não avançar para VPS/produção** até TOP 20 e gate § Estabilização em `ROADMAP-COMPLETUDE.md`.

---

*Documento gerado na etapa TOP 01/20 — somente diagnóstico; nenhum código de produção alterado; nenhum commit realizado.*
