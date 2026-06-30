# Radar Chat — Changelog

Registro append-only de entregas versionadas. Protocolo: [`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md).

Espelho resumido: [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md).

---

---

## [2.13.1] — 2026-06-30

### Admin Ops — métricas VPS / Coolify na aba Infra

- `GET /api/admin/ops/host` — load, RAM, containers Docker (Redis) + status API Coolify (opcional).
- `POST /api/admin/ops/host-metrics/ingest` — cron no VPS com header `X-Ops-Host-Secret`.
- Script `scripts/vps-push-host-metrics.sh`; painel Admin Ops → aba **Infra** → seção **VPS / Host**.

---

## [2.13.0] — 2026-06-30

### Infra — Node.js 24 LTS (Active LTS)

- Docker (monolito + microserviços): `node:20-alpine` → `node:24-alpine`.
- CI GitHub Actions: `node-version: '24'`.
- `engines`: `node >=24`, `npm >=10`; `@types/node` ^24 no backend.
- `.nvmrc` com `24` para dev local alinhado à produção.

## [2.12.79] — 2026-06-30

### Fix prévia embed no painel (produção)

- Corrige `403 Origem não autorizada para prévia` no iframe de Leads/WebChat em produção.
- Helmet: `referrerPolicy: strict-origin-when-cross-origin` (antes `no-referrer` suprimia Referer).
- `isEmbedPreviewPanelOrigin`: aceita `Sec-Fetch-Site: same-origin` quando Referer ausente.
- Iframes de prévia com `referrerPolicy` explícito.

## [2.12.77] — 2026-06-30

### WhatsApp bridge — foco do atendente (MVP)

- `!assumir` sem TK: último alerta pendente ou item único da lista.
- `!assumir 1` / `!trocar 2` após `!abertos` ou `!meus` numerados.
- `!foco` — contexto atual; `!nota texto` usa foco sem repetir TK.
- Redis: foco, picklist e alerta pendente por atendente (12 h).
- Bridge: respostas livres usam foco quando há vários chamados ativos.

## [2.12.76] — 2026-06-30

### Infra — deploy leve Coolify (app-only)

- Novo `scripts/vps-coolify-deploy-app.sh`: `docker compose pull` + `up --no-deps app` (~2–4 min).
- `deploy.yml`: push `main` usa app-only; `workflow_dispatch` escolhe `app-only` ou `full-republish`.
- Commit com `[skip deploy]` na `main` builda GHCR sem reiniciar o VPS.
- Doc `COOLIFY-DEPLOY.md`: política de merge em lote na `main`.
- **Fix:** deploy app-only — dispatcher `vps-deploy-main.sh`, workflow SSH minimo em bash, `.gitattributes` LF.

## [2.12.75] — 2026-06-29

### Comandos WhatsApp Bridge — gestão no painel

- Config por tenant em `InboxSettings.whatsappBridgeCommandsConfig`: pausar, desativar e comandos personalizados.
- API `GET/PATCH /inbox/whatsapp-bridge-commands` — gestão (`inbox:department:manage`) e referência para atendentes (`inbox:reply`).
- UI `/platform/inbox/comandos-wa`: dono/admin edita; equipe vê lista ativa + texto `!ajuda`.
- Catálogo sugerido (`!2via`, `!pix`, `!catalogo`, …) ativável pelo dono; templates com placeholders.
- Handler WA respeita toggles; `!ajuda` dinâmico conforme comandos habilitados.

## [2.12.74] — 2026-06-29

### Setores — excluir + bridge WhatsApp por atendente

- `DELETE /inbox/departments/:id` (bloqueia se houver conversas/chamados abertos).
- `InboxDepartment.memberConfigs[]`: bridge por atendente (`whatsappBridgeEnabled`, `bridgeHoursMode`: always / business_hours / never).
- Rotação fallback WA filtra elegíveis por setor + horário comercial do Inbox.
- UI `/platform/inbox/setores`: botão excluir, editor por atendente com opções de bridge.

### Leads / WebChat — domínios de embed e editor de formulários

- `includeCompanyWebsite` + domínios adicionais em `LeadForm` e `WebChatWidget`; util `embed-allowed-domains.util.ts`.
- Aba **Formulários** unificada (sem **Integrar no site** separada): lista + editor estilo widgets WebChat.
- Editor: menu lateral, **Por onde começar?**, status das seções, pré-visualização lateral e integração por formulário.
- Site `radarchat.com.br`: formulário de leads em `#contato` via `form.js`.

### Marca — logomarca Signal Pro no painel e site

- Favicon e ícone do painel (`/favicon.svg`, `/logo-icon.svg`) atualizados a partir de `logo/svg/`.
- Componente `BrandLogo` reutilizável (ícone + horizontal claro/escuro) em auth e sidebar.
- Site `radarchat.com.br`: header/rodapé com novo ícone e paleta (#00D4FF, #2563EB, #22C55E).
- `manifest.webmanifest` e `theme-color` alinhados ao manual da marca.

## [2.12.73] — 2026-06-29

### WebChat — Nome fantasia do atendente

- Campo `CompanyMember.chatDisplayName` com política em `Organization.teamSettings.chatDisplayNamePolicy`:
  - `owner_only` — dono/admin define manualmente (Equipe → Editar membro);
  - `self_service` — atendente altera em Configurações → Meu perfil;
  - `approval_required` — atendente solicita; dono aprova em Equipe.
- Serviço `chat-display-name.service.ts`: resolução batch para Inbox/WebChat (`resolveAgentChatDisplayName`).
- Mensagens outbound do widget passam a usar nome fantasia aprovado (fallback: nome interno → e-mail → "Atendente").
- API: `PATCH /organization/team-settings`, `GET /team/chat-display-names/pending`, approve/reject por membro.

## [2.12.72] — 2026-06-29

### Frontend — Login profissional (Layout v3)

- Tela de login split: painel hero (marca Radar Chat, proposta de valor) + card OAuth.
- Logo oficial (`favicon.svg`), fonte Inter, botões Google/Discord refinados.
- Badges de perfil (Dono / Equipe), link para `radarchat.com.br`.
- `ChooseCompany`: layout split + lista de empresas refinada (card clicável).
- `theme-color` e manifest alinhados à marca roxa.

## [2.12.71] — 2026-06-29

### Infra — Migração produção Coolify (VPS ZAP)

- Migração sslip.io: legado GHCR → stack Coolify `h143brhw5f8tgfj9trj0f3bd` (volumes preservados).
- `docker-compose.coolify-ghcr.yml`: `env_file: .env` no app; override `:3001` para Traefik.
- Scripts: `vps-configure-coolify-radarzap.sh` (SSH localhost, `deploy_service_direct`, republish).
- Workflows GitHub usam branch `layout-v3` no VPS; diagnóstico `vps-coolify-status.sh`.
- Docs: `ENTREGA-COOLIFY-MIGRACAO-2.12.71.md`, `PROMPT-CODEX-COOLIFY-POS-MIGRACAO.md`, `COOLIFY-DEPLOY.md` atualizado.

### Layout v3 — Fase 4.5 QA visual + marca Radar Chat

- Registro: `layout-v3-fase-4-5-qa` em `RADARZAP-LAYOUT-V3-09-FASE-4-5-QA-VISUAL-NAVEGAVEL.md`.
- Marca visível atualizada para **Radar Chat** no app, PWA, login, navegação, WebChat, leads, integrações e site público.
- Domínios oficiais documentados: `https://radarchat.com.br` e `https://app.radarchat.com.br`.
- Preservados contratos técnicos como `X-RadarZap-Signature`, env vars/volumes `radarzap*`, tokens `--rz-*` e arquivos históricos.
- Validação local: build frontend verde; lint focado verde; QA autenticada por perfil fica pendente manual.

---

## [2.12.70] — 2026-06-28

### Feat — Layout v3 (Fases 2–4) + deploy Coolify

**Layout v3 (painel):**
- Fase 2: reorganização menu/navegação (`navConfig`, docs `RADARZAP-LAYOUT-V3-06`).
- Fase 3: header operacional (pills, status, notificações — `RADARZAP-LAYOUT-V3-07`).
- Fase 4: design system — `InlineNotice`, refinamentos `EmptyState`/`LoadingState`/`ErrorState`/`SectionCard`/`StatusBadge`/`DataTable`; integrações API (`ApiKeys`, `Webhooks`, `ApiDocs`, `RateLimit`).

**Infra:**
- `docker-compose.coolify.yml`, `.env.coolify.example`, `docs/COOLIFY-DEPLOY.md`.
- Tracker `PREPARACAO-PRODUCAO-EXECUCAO.md`; regra agentes `layout-v3-codex-isolation.mdc`.

---

## [2.12.69] — 2026-06-28

### Feat — Inatividade automática: mensagens editáveis + gate manual separado

- Campos `inactivityWarningMessage` e `inactivityCloseMessage` (padrão: "Você está aí?" / "Conversa encerrada por inatividade.").
- UI em Bot → **Mensagens** (tempos + textos); Qualidade só atalhos manuais (`/aus` · `/enc` · `/mais`).
- `inactivityCloseGateWaitMinutes` independente do SLA automático do bot.

---

## [2.12.68] — 2026-06-28

### Feat — Gate de atalhos separado: inatividade vs encerramento natural

- `gracefulCloseQuickReplyGateEnabled`: bloqueio independente de `/enc_ok` até `/mais` + tempo ou resposta do cliente.
- `closeQuickReplyGateEnabled` continua só para `/enc` após `/aus` + tempo.
- Bot → Qualidade: dois checkboxes + UX dos atalhos; Inbox e WebChat validam gates separados.

---

## [2.12.67] — 2026-06-28

### Feat — Fallback WhatsApp na fila nativa (Inbox WA)

- Mesma config em `/platform/inbox/bot` (**Fallback WhatsApp (fila)**) passa a valer para **WhatsApp + WebChat**.
- Scan ~60s: `processInboxWhatsAppFallbackAcceptTimeouts` — rotação de alerta WA, broadcast para números configurados, `!assumir TK-…` via ticketRef na conversa.
- Painel: countdown de fallback na lista Inbox; eventos `inbox:fallback_alert` / `inbox:fallback_missed`.

---

## [2.12.66] — 2026-06-28

### Fix — IA Premium não inventa planos/preços sem KB

- Dúvidas comerciais (planos, preços, internet, etc.): busca KB/memória **antes** do LLM; sem match → resposta “não tenho informações confirmadas”.
- Pós-LLM: heurística bloqueia catálogo inventado (R$, Mbps, listas numeradas) quando KB vazia.
- WebChat: mesmo guard. Testes em `premium-ai.util.test.ts`.

---

## [2.12.65] — 2026-06-28

### Fix — LGPD opt-out × triagem IA (QA Fase 1 § A.1)

- **`ConsentService`:** defer fluxo opt-out enquanto atendimento ativo (triagem, IA, fila, ticket); limpar `optOutConfirmPendingAt` stale ao reiniciar contato `ACCEPTED`.
- **`InboxService`:** `hasActiveClientAtendimentoContext()` — ticket + triagem + IA + conversa in_progress/waiting_queue.
- **`consent.ts`:** remover `sim`/`ok` de `CONSENT_OPT_OUT_CONFIRM_KEYWORDS`; limpar pending stale; textos LGPD sem `sim`.
- Testes: `consent-reply.test.ts` — opt-out confirm.

---

## [2.12.64] — 2026-06-28

### Docs — consolidação pendências Fase 1

- **`PENDENCIAS-HUMANAS-FASE1.md`** — fonte única do que falta (QA manual + Admin Bloco E VPS).
- Arquivamento concluído: entregas em `docs/concluidos/`; redirects `admin/`, `audits/`, `operacao/`, `top/`.
- **`ROADMAP-COMPLETUDE.md`**, **`RADARZAP-SISTEMA-COMPLETO.md`**, **`WEBCHAT.md`** — alinhados @ `2.12.63` (gate auto ✅; sync WebChat→ticket documentado).
- **`qa:atendimento:gate`** revalidado 2026-06-28.

---

## [2.12.63] — 2026-06-28

### Portal LGPD — AH-D04 export/delete titular

- API `/lgpd/*`: lookup por telefone, export JSON, anonimização com confirmação, feed de eventos.
- Painel `/platform/lgpd` no menu Consentimento.
- Eventos `lgpd.export_requested`, `lgpd.delete_requested`, `lgpd.anonymized`.

---

## [2.12.62] — 2026-06-28

### Infra — AH-S01 degraded boot (dev)

- **`probeRedisReachable` + `infra-runtime-state`:** boot em dev sem Redis (Mongo obrigatório).
- Filas BullMQ e webhooks outbound só iniciam com Redis OK.
- Health público/staff expõe `degraded` + `degradedReasons`.
- Prod: Redis obrigatório; `INFRA_DEGRADED_BOOT` bloqueado em `validateConfig`.

---

## [2.12.61] — 2026-06-28

### Bridge — AH-M05 dedup Redis multi-réplica

- **`acquireBridgeForwardDedup`:** Redis `SET NX` + TTL 8s; fallback in-memory se Redis indisponível.
- **Docs:** WEBCHAT.md, auditoria horizontal — QA manual explicitamente **por último**.

---

## [2.12.60] — 2026-06-28

### Admin Ops — hub IA + depreciação orgs legado

- **Etapa 9:** `AdminOpsHubLink` em `/admin/ai-blueprint` e `/admin/ai-platform` (aba IA do dashboard Ops).
- **`GET /admin/organizations`:** headers `Deprecation` + sucessora `/admin/ops/organizations` (corpo inalterado).
- **Docs:** entrega auditoria horizontal atualizada pós-deploy `main`; Etapa 9 pendências parciais.

---

## [2.12.59] — 2026-06-28

### Encerramento auditoria horizontal — AH-R08 + AH-D03 + doc final

- **AH-R08:** `POST /admin/destinations/:id/block` depreciada → sucessora `POST /destinations/:id/consent/block`; handler unificado.
- **AH-D03:** política de audit IA (sem prompt completo) em `IA-CREDITOS-E-CARTEIRA.md`.
- **Auditoria:** status final atualizado — correções código 2.12.47–2.12.59.

## [2.12.58] — 2026-06-28

### Correção P3 — AH-R07 health público + índice AttendanceEvent admin

- **`GET /api/services/health`:** público (sem sessão), rate limit, payload mínimo (`healthy`, `uptime`, `version`); ping interno Mongo+Redis.
- **`GET /admin/ops/infra-health`:** detalhe staff (`dashboard:global`) com latências e filas.
- **`AttendanceEvent`:** índice `{ kind: 1, createdAt: -1 }` para feed segurança admin.
- **Testes:** `toPublicLivenessHealth` em `infra-health.service.test.ts`.

## [2.12.57] — 2026-06-28

### Correção P2 — AH-B02 + AH-M04 + AH-S05

- **Billing dev:** `POST /billing/dev/activate` exige `ALLOW_DEV_BILLING=true` (removido fallback `NODE_ENV !== production`).
- **Cross-tenant:** testes integrados Inbox/Leads (`cross-tenant-scope.integration.test.ts`); E2E mock `e2e/cross-tenant-isolation.spec.ts`.
- **Bridge dedup:** documentado Map in-process single-node em `WEBCHAT.md` (AH-S05).
- **Testes:** `billing-dev-activate.test.ts`.

## [2.12.56] — 2026-06-28

### Correção P2 — AH-S04 health infra + AH-S01 runbook SPOF

- **`GET /api/services/health`:** ping MongoDB + Redis + filas BullMQ; `healthy` agregado; HTTP 503 se core down.
- **`buildInfraHealthSnapshot`:** latência por dependência, `version`, `checkedAt`.
- **Runbook:** `docs/operacao/RUNBOOK-SPOF-MONGO-REDIS.md` — SPOF, sintomas, recuperação dev/VPS.
- **Testes:** `infra-health.service.test.ts`.

## [2.12.55] — 2026-06-28

### Correção P2 — AH-R06 Socket.IO + AH-M03 Inbox defense-in-depth

- **Socket.IO CORS:** origem validada via painel + `allowedDomains` dos widgets ativos (cache 60s); não aceita `*` implícito.
- **Presença WebChat (`wcp_`):** exige `webchatPublicKey`, origem embed válida e `socketAuth` HMAC (POST `/presence`) em produção.
- **Widget:** envia `publicKey` + token; ping de presença antes do connect.
- **`InboxService`:** `findConversationForClient` — substitui `findById` sem `clientId` (10 ocorrências).
- **Testes:** `webchat-presence-auth.util.test.ts`, `webchat-socket-origin.util.test.ts`.

## [2.12.54] — 2026-06-28

### Correção P2/P3 — AH-R05 ingest sino + AH-D02 TTL logs

- **`POST /panel/notifications/ingest`:** cap `whatsapp:session:view`; rate limit; id `sess-*`; texto fixo no servidor; `connected` valida sessão WA active.
- **`AuditLog`:** índice TTL 180 dias.
- **`AttendanceEvent`:** índice TTL 90 dias.
- **Testes:** `panel-notification-ingest.util.test.ts`.

## [2.12.53] — 2026-06-28

### Correção P2 — AH-E02 security-events paginação + filtros Mongo

- **`GET /admin/ops/security-events`:** `page`, `totalPages`, `truncated`; offset real após merge.
- **`buildSecurityEventsFetchPlan`:** consulta só coleções/filtros necessários (ex. `source=system` pula Attendance).
- **AuditLog:** filtro `$or` de ações relevantes no Mongo (não traz perfil etc.).
- **UI:** paginação Anterior/Próxima no feed Segurança.

## [2.12.52] — 2026-06-28

### Correção P2 — AH-D01/W02 embed público fail-closed

- **`isWebChatOriginAllowed`:** `allowedDomains` vazio → bloqueia em produção; dev mantém aberto. Env `PUBLIC_EMBED_ALLOW_OPEN_ORIGIN`.
- **Leads + WebChat:** mesma política via util compartilhado.
- **Painel:** alerta `system:critical_config` quando widget/formulário ativo sem domínios.
- **UI:** copy atualizado (WebChat, Leads, integrações).

## [2.12.51] — 2026-06-28

### Correção P1 — AH-E01 filtro `?status=` Admin Ops sem full scan

- **`buildMongoFilterForAdminOpsBillingStatus`:** filtro Mongo espelha `normalizeBillingStatus` — paginação server-side com `countDocuments` + `skip/limit`.
- **`normalizeBillingStatus`:** retorna `manual` quando Stripe/manual vigente; expirado → `canceled`.
- **Testes:** `admin-ops-billing-status-filter.util.test.ts` (paridade) + service test atualizado.

## [2.12.50] — 2026-06-28

### Correção P1 — AH-S03 timeout IA + AH-S02 rate limit fail-closed

- **`fetchWithTimeout`:** util com `AbortSignal` + `FetchTimeoutError` (`src/utils/fetch-with-timeout.ts`).
- **`AiProviderService`:** OpenAI e Gemini usam timeout configurável (`AI_PROVIDER_TIMEOUT_MS`, default 30s).
- **`RateLimiter`:** em produção, Redis indisponível → **negar** requisição (fail-closed); dev mantém fail-open. Env `RATE_LIMIT_FAIL_OPEN`.
- **Testes:** `fetch-with-timeout.test.ts`, `rate-limiter-fail-mode.test.ts`.

## [2.12.49] — 2026-06-28

### Correção P1 — AH-R03/R04 rotas plano legado → Ops + AuditLog

- **PATCH `/admin/organizations/:id/plan`:** delega `changeAdminOpsOrganizationPlan`; exige motivo; header `Deprecation`.
- **PUT `/users/:id/plan`:** resolve `primaryOrganizationId` → Ops; sem `User.upgradePlan`.
- **GET `/users`:** expõe `organizationId` + plano da **Organization**.
- **Frontend `/admin/plans`:** modal motivo + `PATCH /admin/ops/organizations/:id/plan`; link Empresas.
- **Teste:** `legacy-plan-routes.test.ts`.

## [2.12.48] — 2026-06-28

### Correção P0 — AH-R02 filas BullMQ tenant-scoped

- **GET `/api/queue`:** sem `queue:global` → stats de `MessageQueue` do tenant; staff global → BullMQ completo.
- **GET `/api/queue/failed`:** filtra por `clientId` no payload; **nunca** retorna `job.data` bruto.
- **POST `/api/queue/:id/retry`:** tenant só reprocessa jobs do próprio `clientId`.
- **Util:** `queue-job-tenant.util.ts` + testes; UX Discord fila com aviso staff.
- **Próxima etapa:** AH-R03/R04 rotas plano legado.

## [2.12.47] — 2026-06-28

### Correção P0 — AH-R01 stats tenant-scoped

- **GET `/api/stats`:** passa a usar `buildTenantStats(auth)` — filtra por `clientId` (mensagens, sessão WA, fila MessageQueue, gráfico 24h).
- **Global:** `buildStats` renomeado `buildGlobalStats` — exclusivo `GET /admin/monitoring` (`logs:global`).
- **Teste:** `tenant-stats-scope.test.ts` — contrato anti-vazamento global.
- **Próxima etapa controlada:** AH-R02 filas BullMQ.

## [2.12.46] — 2026-06-28

### Auditoria horizontal — segurança, dados e estabilidade

- **Relatório:** `docs/audits/RADARZAP-AUDITORIA-HORIZONTAL-SEGURANCA-ESTABILIDADE.md` — escopo transversal (RBAC, multi-tenant, billing, IA, WA/WebChat, Admin Ops, escalabilidade).
- **Hardening:** rate limit anexo WebChat público (`assertWebChatSendAllowed`); validação origem GET config leads.
- **Achados críticos documentados:** `/api/stats` global para tenant; boot hard dependency Redis/Mongo.
- **Gates:** build, admin-ops 65/65, E2E admin 27/27, qa:atendimento 235/235.
- **Status:** AUDITORIA CONCLUÍDA — não declarado go-live.

## [2.12.45] — 2026-06-28

### Admin — Etapa 10 QA VPS prep + Bloco E local

- **Bloco E:** script `qa:admin-ops:bloco-e:local` — alterar plano + `AuditLog` + revert (Mongo local, sem Stripe).
- **E2E:** +3 cenários — modal alterar plano, `?tab=tenants`, quick link Usuários.
- **Fix:** quick link dashboard Clientes → Usuários; `data-testid` modal plano.
- **Gates:** typecheck, build, admin-ops 65/65, E2E 54/54.
- **QA VPS browser:** pendente Benhur; push não autorizado.

## [2.12.44] — 2026-06-27

### Admin — reconciliação Etapas 8–9 (auditoria real)

- **Verificação:** `docs/admin/RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-8-9-VERIFICACAO-REAL.md` — docs estavam adiantados vs git (`2.12.42`); código existia só local.
- **Etapa 8 (2.12.43):** consolidação legado — redirect, deep links, monitoring/errors/servers enriquecidos.
- **Etapa 9 (2.12.44):** auditoria rotas — Usuários/Empresas, moderação sem duplicação plano, hub links.
- **Gates:** typecheck, build, admin-ops 65/65, E2E 50/50.
- **Bloco E:** alterar plano browser — ainda pendente.

## [2.12.43] — 2026-06-27

- **Matriz:** `docs/admin/RADARZAP-ADMIN-DASHBOARD-OPS-ETAPA-9-AUDITORIA-ROTAS.md` — checklist 19 rotas.
- **Usuários × Empresas:** menu **Empresas** (`?tab=tenants`) + **Usuários** (`/admin/clients`); guia anti-confusão.
- **Moderação:** removida tabela duplicada de planos; foco LGPD + hub Empresas.
- **Hub links:** pagamentos, API, auditoria, segurança → abas dashboard (`AdminOpsHubLink`).

## [2.12.43] — 2026-06-27

### Admin — consolidação páginas legado (Etapa 8)

- **Inventário:** `docs/admin/RADARZAP-ADMIN-INVENTARIO-PAGINAS.md` — mapa completo `/admin/*`.
- **Legado enriquecido:** `/admin/monitoring`, `/admin/errors`, `/admin/servers` consomem Ops summary + banner deep link.
- **Navegação:** redirect `/admin` → `/admin/dashboard`; `?tab=` para abas diretas.
- **Shared UI:** `AdminOpsInfraPanel`, `AdminOpsServersPanel`, `useAdminOpsSummary`.
- **E2E:** +5 cenários admin-dashboard (redirect, deep link, páginas legado).

## [2.12.42] — 2026-06-28

### Admin — ops QA manual e gate local (Etapa 7)

- **QA:** script `qa:admin-ops:local` valida summary/orgs/security-events contra Mongo real + anti-segredo.
- **Evidência:** `docs/qa-results/admin-ops-local-2026-06-28.json`, doc Etapa 7.
- **Status:** APROVADO COM RESSALVAS para commit; mutações trial/plano no browser pendente Benhur.
- **Commit:** Etapas 4–7 acumuladas (sem push).

## [2.12.41] — 2026-06-27

### Admin — ops QA final e fechamento (Etapa 6)

- **Docs:** API admin ops, checklist QA manual, resultado gates, doc Etapa 6.
- **OpenAPI:** endpoints `/admin/ops/*` em `openapi-dashboard.ts` (tag Admin Ops).
- **Segurança:** teste `admin-ops-anti-secret.test.ts`; reforço padrões Bearer/Authorization/Cookie.
- **Status:** módulo fechado tecnicamente; QA manual Benhur pendente.

## [2.12.40] — 2026-06-27

### Admin — ops feed eventos críticos (Etapa 5)

- **API:** `GET /api/admin/ops/security-events` — AttendanceEvent + SystemLog + AuditLog sanitizados.
- **UI:** aba Segurança com feed global, filtros (nível, fonte, kind, janela 24h/7d), refresh.
- **Segurança:** sem meta/payload/tokens; `sanitizeAdminOpsSecurityEventText` + render seguro.
- **Testes:** `admin-ops-security-events.service.test.ts`, E2E admin-dashboard (+6 cenários).

## [2.12.39] — 2026-06-27

### Admin — ops listagem empresas + trial/plano (Etapa 4)

- **API:** `GET /api/admin/ops/organizations` (paginação, filtros) + `PATCH …/plan`, `POST …/trial/extend`, `POST …/trial/cancel`.
- **RBAC:** listagem `dashboard:global`; mutações `system:plans:manage`; audit `admin.plan.changed`, `admin.trial.*`.
- **UI:** aba Empresas com tabela, filtros, modais e invalidação do summary.
- **Testes:** `admin-ops-organizations.service.test.ts`, E2E admin-dashboard (24 cenários).

## [2.12.38] — 2026-06-27

### Admin — dashboard ops frontend completo

- **`/admin/dashboard`:** migra para `GET /api/admin/ops/summary` — abas Visão geral, Infra, Empresas, Atendimento, Billing, IA, Segurança, Go-live.
- **UX:** loading/error/refresh 30s, badges versão/env/status, alertas TOP20, links rápidos, sanitização de conteúdo sensível.
- **Testes:** `admin-ops-summary.util`, E2E `e2e/admin-dashboard.spec.ts`.

## [2.12.37] — 2026-06-27

### Admin — ops summary backend (dashboard global)

- **API:** `GET /api/admin/ops/summary` — agregador cross-tenant com cap `dashboard:global`, cache Redis 30s, alertas operacionais.
- **Serviço:** `admin-ops-summary.service.ts` — tenants, WA, WebChat, Inbox, tickets, leads, IA, billing, security.
- **Doc:** `docs/admin/RADARZAP-ADMIN-DASHBOARD-OPS.md` + testes `admin-ops-*`.

## [2.12.36] — 2026-06-27

### Deploy — assets estáticos webchat/leads no dist

- **Fix ENOENT produção:** `npm run build` copia `webchat/*.{html,js}` e `leads/*.{html,js}` para `dist/services/web-dashboard/` (`copy-dashboard-static.cjs`).
- Corrige `/webchat/widget.html`, previews e `/leads/preview.html` no Docker/VPS.

## [2.12.35] — 2026-06-27

### Inbox — assumir manualmente (WebChat + WhatsApp)

- **Assumir/Aceitar/Puxar:** permite ação manual se conectado ao painel, mesmo com status Ausente/Ocupado/Supervisor; bloqueia só offline real ou limite simultâneo.
- **Capacidade WebChat:** contagem unificada (`with_agent` ou bridge) sem duplicar conversa; checagem também em `WebChatService.assignConversation`.
- **Mensagens:** erro específico para offline vs limite de atendimentos.

## [2.12.34] — 2026-06-27

### WebChat — fallback WhatsApp: correções de fluxo + countdown Inbox

- **Rotação WA:** aguarda timeout configurado (`whatsappFallbackAcceptTimeoutSeconds`) após alerta antes de rotacionar — campo `whatsappFallbackWaNotifiedAt`.
- **Cooldown:** `whatsappFallbackAlertSentAt` só quando alerta manual enviado com sucesso (ou equipe esgotada sem telefones); falha de envio não bloqueia 15 min.
- **Visitante:** mensagem configurada de fallback no chat na 1ª alerta WA (`whatsappFallbackVisitorNotifiedAt`).
- **Inbox:** banner/lista com countdown “Fallback WhatsApp em M:SS” / “WhatsApp enviado · !assumir em M:SS”.

## [2.12.33] — 2026-06-27

### Inbox — nome WebChat, cronômetros fila/atendimento, presença persistente

- **Nome visitante:** resolve campo pré-chat com `preset: name` (ex. `qual_seu_nome`); ignora label "Qual seu nome" como nome exibido.
- **Cronômetros:** espera na fila desde `queueEnteredAt` (ou `suggestedAt` com indicado); tempo de atendimento desde `acceptedAt` após assumir — lista e header do Inbox.
- **Presença:** status manual (ausente/ocupado) persistido no Redis; restaurado após F5 via `GET /inbox/presence/me` + hidratação no connect.

## [2.12.32] — 2026-06-27

### WebChat — fallback WhatsApp timing dual + encerramento por fila

- **Com atendente indicado online:** prazo maior (`whatsappFallbackAcceptTimeoutSeconds`, padrão **120s**) antes do alerta WA; cronômetro desde `whatsappFallbackPriorityStartedAt` (não reinicia ao rotacionar indicado).
- **Sem atendente disponível / fila aberta:** alerta imediato ou curto (`whatsappFallbackNoAgentTimeoutSeconds`, padrão **0**) na escalação e no scan — só se `whatsappFallbackEnabled`.
- **Tempo máximo na fila:** após `webchatQueueMaxWaitMinutes` (padrão **45**, 0=off) → mensagem configurável + encerramento automático.
- Re-tentativa fallback após **15 min** se ciclo esgotou (`whatsappFallbackAlertSentAt`).
- UI: Triagem e Bot → Fila e equipe → card Fallback WhatsApp.
- Util: `webchat-fallback-timing.util.ts`; testes `webchat-fallback-timing.util.test.ts`.
- **Fix leitura WebChat:** receipts no layout Copilot, painel `/platform/webchat` via socket, marcação inbound ao abrir conversa, queries Mongo `readAt`/`deliveredAt` null-safe.

## [2.12.31] — 2026-06-27

### Painel — `/sessions` mobile

- Card de conexão: identidade e ações em linhas separadas; telefone sem quebra; botões Reiniciar/Desconectar responsivos; QR `max-w-full`.

## [2.12.30] — 2026-06-27

### Painel — `/send` sidebar + Inbox nav

- **`/send`:** controles “Quando enviar” (imediato/agendar, prioridade, intervalo) e resumo na coluna direita sticky com scroll interno.
- **Inbox:** removido link duplicado “← Caixa de Entrada” fora do `InboxAtendimentoNav` (Respostas, Setores, Relatórios, Supervisor, Bot).
- **Dev:** `MONGODB_URL` com `127.0.0.1` documentado no `.env.example`; startup aguarda Mongo (`waitForMongoReady`).

## [2.12.29] — 2026-06-27

### Painel — padrão Salvar + toast de configuração

- **`ConfigSaveFooter`** (`@/design-system`) — botão inferior direito igual IA de Atendimento.
- **`notifyConfigSaved()`** — toast Sonner “Configurações salvas” (referência `/platform/inbox/ia`).
- Padronizado em: Triagem e Bot, IA, Respostas rápidas, WebChat, limites WA tenant/admin.
- Doc: [`docs/design-system/CONFIG-SAVE-FEEDBACK.md`](./design-system/CONFIG-SAVE-FEEDBACK.md).

## [2.12.28] — 2026-06-27

### Painel — Triagem e Bot: barra Salvar padronizada

- **`/platform/inbox/bot`:** uma única barra inferior (`SaveBar` do design system); removidas barras duplicadas no topo e no meio do formulário.

## [2.12.27] — 2026-06-27

### Painel — Triagem e Bot reorganizado

- **`/platform/inbox/bot`:** 4 abas (Mensagens, Horário, Fila e equipe, Qualidade) em vez de scroll único.
- Pills de variáveis clicáveis; barra **Salvar** fixa no topo e rodapé.
- Atalhos para Setores, Respostas rápidas, IA e WebChat.
- Campos expostos: `queuePositionMessage`, `queueAllBusyMessage`.
- SLA/atalhos colapsáveis em **Avançado**; presença e fallback WebChat em cards separados.

## [2.12.26] — 2026-06-27

### Inbox — atalhos `/enc_ok`, `/mais` e `/enc`

- **Dois caminhos independentes (configuráveis em Bot → SLA):** `/aus` → `/enc` (inatividade) e `/mais` → `/enc_ok` (encerramento natural).
- **`/enc_ok`:** envia despedida cordial e **encerra** a conversa (WA + WebChat).
- **`/mais`:** libera só `/enc_ok` — não `/enc` — após resposta do cliente ou tempo configurado.
- **`/enc_ok`** não apaga mais o estado do gate aberto por `/mais`.
- Painel: composer bloqueia `/enc` e `/enc_ok` separadamente conforme o caminho cumprido.

## [2.12.25] — 2026-06-27

### Deploy — fix build Docker do frontend

- `Dockerfile.monolith`: copia `package.json` da raiz para `/repo/` — `vite.config` lê versão na build da imagem GHCR.

## [2.12.24] — 2026-06-27

### Painel — versão no rodapé da sidebar

- Rodapé exibe `(vX.Y.Z)` lido do `package.json` na build (antes hardcoded `v2.0`).

## [2.12.23] — 2026-06-27

### QA — gate automatizado pós-deploy

- **`npm run qa:release-gate`:** Jest campanha/limites, build backend+frontend, E2E limites (`/admin/settings`, `/platform/wa-limits`, `/send`), `qa:atendimento:gate`, E2E Fase 1 (38 testes); smoke opcional com `RADARZAP_PUBLIC_URL`.
- **`npm run qa:campaign-limits`** / **`qa:campaign-limits:e2e`** / **`qa:campaign-limits:gate`:** atalhos focados em campanha.
- E2E: `e2e/qa-campaign-limits.spec.ts`, fixture `mock-campaign-limits-api.ts`; relatório JSON em `docs/qa-results/`.

## [2.12.22] — 2026-06-27

### Admin — intervalos de campanha editáveis

- **`/admin/settings`:** seção *Intervalos de campanha (Enviar agora)* — tiers protegidos (base + jitter), padrão, modo risco (3/10/20s).
- Persistido em `SystemWhatsAppPolicy.campaignDelays`; `/send` e dispatch usam a config do admin.

## [2.12.21] — 2026-06-27

### Envio — intervalos reais 30/40/60s com jitter

- **Modo protegido:** tiers Mínimo (30–39s), Normal (40–59s), Ótimo (60–80s) — delay aleatório entre envios.
- **1 destino por ciclo** — respeita marketing msg/min em toda a campanha (ex.: 1000 contatos a 2/min).
- **Modo risco:** 3s, 10s, 20s (antes de 30s) — mínimo 3s para não travar o sistema.
- Dispatch síncrono (`skipQueue`) + rate limit ativo no modo protegido.

## [2.12.20] — 2026-06-27

### Envio — limites reais admin → empresa no /send

- **`GET /campaigns/send-policy`:** hierarquia admin/empresa/efetivo para quem usa Enviar agora (`send:test`).
- **`/send`:** card com limites reais; intervalo no modo protegido ≥ cadência marketing (ex.: 10/min → mín. 6s, sem opção enganosa de 5s).
- **Dono:** checkbox em Limites de envio para liberar equipe desativar proteção anti-ban.
- **Atendentes:** checkbox de risco só aparece se o dono liberou; backend valida em `POST /campaigns`.

## [2.12.19] — 2026-06-27

### Classificação — Pacote J (Supervisor filtro + atalhos Inbox nos relatórios)

- **`GET /inbox/supervisor/dashboard?class=`** — filtra conversas ativas e fila por classificação CRM (paridade com Inbox).
- **Supervisor UI:** chips de classificação + URL `?class=`.
- **Relatórios:** breakdowns e segmentos dinâmicos com atalho **Inbox** além de **Contatos**.

## [2.12.18] — 2026-06-27

### Classificação — Pacote I (filtro Inbox server-side)

- **`GET /inbox/conversations?class=`** — filtra conversas WA + WebChat por classificação do contato CRM vinculado (`destinationId` ∈ IDs que batem com o preset).
- **Inbox UI:** chips de classificação na barra lateral da lista; URL `?class=opt_in|pending|hot|blocked|lead|client|prospect`.
- Paridade com `/contact?class=` e `findDestinationIdsMatchingClassification`.

## [2.12.17] — 2026-06-27

### Classificação — Pacote H (Supervisor + consolidação)

- **Supervisor:** badges de classificação CRM nas conversas ativas e na fila (`GET /inbox/supervisor/dashboard` → `contactClassification`).
- **Plataforma:** atalhos em `/platform` para segmentos e contatos opt-in (`/contact?class=opt_in`).
- **Docs:** `SISTEMA-REGISTRO.md`, regra do agente, `INBOX-ATENDIMENTO.md` § Classificação CRM; `CONTATOS-CLASSIFICACAO.md` atualizado.

## [2.12.16] — 2026-06-27

### Classificação — Pacote G (Inbox lista + doc + testes)

- **Inbox:** badges de classificação na lista de conversas quando o contato CRM está vinculado (WA + WebChat).
- **API:** `attachClassificationToConversationRows` em `GET /inbox/conversations` (lista unificada).
- **Doc:** `docs/CONTATOS-CLASSIFICACAO.md` — mapa completo do módulo e APIs.
- **Testes:** filtros `?class=`, CSV de stats (`destination-classification.filters.test.ts`).

## [2.12.15] — 2026-06-27

### Classificação — Pacote F (filtro server-side + export CSV)

- **`GET /destinations?class=`** — filtra contatos por classificação no servidor (opt_in, pending, hot, blocked, lead, client, prospect…).
- **`GET /destinations/classification-stats/export-csv`** — resumo agregado em CSV.
- **`GET /destinations/classification-export-csv`** — lista de contatos com colunas de classificação; aceita `?class=` opcional.
- **`/contact`:** chips usam stats da API; lista reflete filtro server-side; botão exportar CSV quando filtro ativo.
- **`/platform/reports`:** botões CSV resumo e CSV contatos.

## [2.12.14] — 2026-06-27

### Classificação — Pacote E (relatórios)

- **`GET /destinations/classification-stats`:** totais por tipo, permissão, origem, temperatura, funil, qualidade de telefone; segmentos dinâmicos e pendências de backfill.
- **`/platform/reports`:** seção **Classificação de contatos** com KPIs, breakdowns clicáveis (atalho para `/contact?class=…`) e ação de backfill em lote.

## [2.12.13] — 2026-06-27

### Classificação — Pacote D (Contatos + WebChat Inbox)

- **`/contact`:** faixa de filtros rápidos por classificação (opt-in, pendente, quente/morno, bloqueio campanha, lead/cliente/prospect); URL `?class=opt_in` etc.
- **WebChat Inbox:** `getDetailForInbox` retorna `classification`, tags e `lastMessageSent` do contato CRM vinculado; card no painel lateral.
- **`PATCH /inbox/conversations/:id/visitor-profile`:** persiste tipo, origem, funil e temperatura no contato vinculado; editor do Inbox envia os campos.

## [2.12.12] — 2026-06-27

### Classificação — Pacote C (Leads × CRM)

- **Leads:** faixa de estatísticas CRM (opt-in, pendente, quentes/mornos, bloqueio campanha, sem contato).
- **API:** `GET /leads/classification-stats`; filtros em `GET /leads/captures` (`classificationKind`, `classificationOptInOnly`, `classificationPendingOnly`, `classificationHotOnly`, `classificationBlockedOnly`, `unlinkedOnly`).
- **UI:** badges na lista e Kanban; coluna Classificação; card na aba Contato do detalhe; filtros avançados no drawer.
- **OpenAPI:** schemas `LeadClassificationStats`, `LeadCaptureWithClassification` e rotas de leads documentadas.

## [2.12.11] — 2026-06-27

### Classificação — Pacote B (automações + OpenAPI)

- **Automações:** filtros por segmento dinâmico, tipo (lead/cliente/prospect), opt-in, temperatura e bloqueio de campanha; bloqueio `assertCampaignSendAllowed` em todos os envios automáticos.
- **Modelo** `BirthdayAutomationRule`: `destinationSmartSegmentId`, `destinationFilterKinds`, `destinationFilterPermissions`, `destinationFilterTemperatures`, `destinationCampaignSelectableOnly`.
- **OpenAPI:** schemas `ContactClassification`, `SmartSegmentPreset`, rotas de classificação e PATCH automações documentados.

## [2.12.10] — 2026-06-27

### Classificação de contatos — Pacote A (segmentos + backfill)

- **`/platform/segmentos`:** aba **Segmentos dinâmicos** com 5 presets (opt-in, clientes ativos, leads quentes, pendente, bloqueados), lista de membros com badges e atalho **Usar no envio**.
- **API:** `GET /destinations/smart-segments/:presetId/members`, `GET /destinations/classification-backfill-status`, `POST /destinations/backfill-classification`.
- **Backfill:** grava tipo, origem, funil e temperatura em contatos antigos sem campos persistidos (lote de 500).
- **`/send`:** aceita navegação vinda de segmentos dinâmicos (`smartSegmentId` + aba Segmentos).

## [2.12.9] — 2026-06-27

### Conta — remover e-mail ao desvincular Google

- Desvincular Google também limpa o e-mail da conta e da equipe.
- `DELETE /auth/account/email` e botão **Remover e-mail** quando Google já foi desvinculado.
- Fix UI: e-mail não aparece mais como “vinculado” ao Google sem OAuth ativo.

---

## [2.12.8] — 2026-06-27

### Conta — desvincular Google

- `DELETE /auth/account/google` — remove vínculo OAuth Google quando Discord também está vinculado.
- UI em Configurações → Conta vinculada: botão **Desvincular** no card Google.

---

## [2.12.7] — 2026-06-26

### Admin — IA da plataforma (credenciais + relatório)

- Nova página `/admin/ai-platform`: chaves OpenAI/Gemini criptografadas, modelo padrão Radar Chat, teste de conexão.
- API: `GET/PATCH /admin/ai-platform/credentials`, `DELETE …/keys/:target`, `POST …/test`, `GET /admin/ai-platform/usage`.
- Runtime `mode: radarzap` usa credenciais do painel (prioridade) ou `.env`; modelo global da plataforma.
- Relatório agregado de consumo LLM Radar Chat por cliente e últimas chamadas.

---

## [2.12.6] — 2026-06-24

### TOP 20 — Congelamento final e go-live controlado

- Status: `PRONTO PARA QA MANUAL` — gates automatizados verdes; QA manual A–J pendente Benhur.
- Docs: `docs/top/RADARZAP-TOP-20-CONGELAMENTO-FINAL-GO-LIVE-CONTROLADO.md`, `docs/RADARZAP-RESULTADO-FINAL-TOP-01-20.md`.
- Checklists: VPS/SSL/env, Stripe, WhatsApp real, bridge, segurança/LGPD, backup, monitoramento.
- Deploy não executado; Stripe live não ativado; produção não declarada estável.

### Organização documental pós-TOP20 (TOP 21 extra)

- Alinhamento versão `2.12.6` em doc mestre, README portal, índice.
- `docs/top/RADARZAP-TOP-21-DOCUMENTACAO-FINAL-UNICA-ORGANIZACAO.md` — mapa de docs; **TOP 20 como fonte oficial** para status e checklists.
- Revisão: doc mestre §15/16/25 — WhatsApp/Bridge fechados em código; pendente QA real blocos D/E.
- Regra preservação: índice canônico TOP 01–21 em `docs/top/`; não remover histórico auditoria.
- Sem alteração de código de produto; versão `package.json` mantida em `2.12.6`.

---

## [2.12.5] — 2026-06-24

### TOP 19 — QA final, regressão e checklist pré-go-live

- Gates obrigatórios verdes: typecheck, build, 772 testes Jest, `qa:atendimento:gate`, E2E 38/38.
- Doc: `docs/top/RADARZAP-TOP-19-QA-FINAL-REGRESSAO-GO-LIVE.md` — roteiro manual TOP 20, checklist pré-go-live.
- Fix E2E: seletores Inbox (título no Header) e radio Radar Chat (strict mode).
- Produção não declarada pronta; deploy não executado.

---

## [2.12.4] — 2026-06-24

### TOP 18 — Auditoria, segurança, LGPD e hardening

- `mask-secret.util.ts`; redact em `AttendanceEvent`, `AuditLog`, logger.
- Eventos: `ticket.public_lookup_failed`, `form.blocked`, `billing.*`.
- Doc: `docs/top/RADARZAP-TOP-18-AUDITORIA-SEGURANCA-LGPD-HARDENING.md`.

---

## [2.12.3] — 2026-06-24

### TOP 17 — Billing, assinaturas, limites e bloqueios

- Helpers `billing-state.util.ts`, `plan-limit.util.ts`, `plan-limit-enforcement.ts`.
- Checkout Stripe pacotes IA (`POST /billing/checkout/ai-credits`); webhook idempotente → `purchasedCredits`.
- Enforcement: `webchatWidgets`, `leadsPerMonth`, `contacts`, `ticketsPerMonth`.
- `invoice.payment_failed` → `past_due` + grace 3 dias documentado.
- Doc: `docs/top/RADARZAP-TOP-17-BILLING-ASSINATURAS-LIMITES-BLOQUEIOS.md`.

---

## [2.12.2] — 2026-06-24

### TOP 16 — IA Créditos, carteira, consumo e fallback

- Helpers `ai-credit-alerts.util.ts`, `ai-credit-packages.util.ts`; `canConsumeAiCredits`, eventos `ai.credits.*`.
- Gate reforçado WebChat + `AiProviderService`; APIs `credit-packages` e `wallet/purchased` (sem checkout).
- Doc [`top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md`](./top/RADARZAP-TOP-16-IA-CREDITOS-CARTEIRA-CONSUMO-FALLBACK.md); §19 doc mestre.

---

## [2.12.1] — 2026-06-24

### TOP 15 — IA Premium, base de conhecimento e handoff

- Helpers `premium-ai.util.ts`: gate central, limites resposta, sanitização, handoff pré-chamada, anti-segredo.
- Eventos `ai.premium.*` em `AttendanceEvent`; integração `WebChatAiService` + `InboxService.sendAiReply`.
- Doc [`top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md`](./top/RADARZAP-TOP-15-IA-PREMIUM-KB-HANDOFF.md); §18 doc mestre.

---

## [2.12.0] — 2026-06-24

### TOP 14 — IA Básica, triagem e encaminhamento

- Intenções `ticket_status`, `complaint`, `partnership`; threshold roteamento 0.75.
- Helpers `basic-triage.util.ts` (produto, confiança, ação, anti-bridge, auditoria).
- Evento `triage.classified`; integração WA + WebChat.
- Doc [`top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md`](./top/RADARZAP-TOP-14-IA-BASICA-TRIAGEM-ENCAMINHAMENTO.md).

---

## [2.11.99] — 2026-06-24

### TOP 13 — Bridge WebChat ↔ WhatsApp

- Helpers `webchat-bridge.util.ts` (anti-loop, idempotência, estados, cross-tenant).
- Dedupe encaminhamento visitante→WA; bloqueio eco em resposta atendente.
- Eventos `bridge.message_forwarded`, `bridge.loop_prevented`.
- Doc [`top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md`](./top/RADARZAP-TOP-13-BRIDGE-WEBCHAT-WHATSAPP.md).

---

## [2.11.98] — 2026-06-24

### TOP 12 — WhatsApp, sessão, QR, reconexão, comandos e documentação consolidada

- Helpers `whatsapp-session.util.ts` (status produto, RBAC sessão, sanitização outbound, cross-tenant).
- `isWhatsappTeamCommand` em comandos equipe WA.
- Documentação mestre [`RADARZAP-SISTEMA-COMPLETO.md`](./RADARZAP-SISTEMA-COMPLETO.md).
- Doc [`top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md`](./top/RADARZAP-TOP-12-WHATSAPP-SESSAO-QR-RECONEXAO-COMANDOS.md).

---

## [2.11.97] — 2026-06-24

### TOP 11 — WebChat, widget, fallback e experiência do visitante

- Helpers `webchat-public.util.ts` (sanitização, fila, gate IA Premium, assinatura config).
- Widget: `outsideHoursMessage`, mensagem oficial de fila, sync expandida no refresh.
- IA Premium indisponível escala para fila humana; mensagens de escalação unificadas.
- Testes `webchat-public.util`, `webchat-public-security`; doc [`top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md`](./top/RADARZAP-TOP-11-WEBCHAT-WIDGET-FALLBACK-EXPERIENCIA.md).

---

## [2.11.96] — 2026-06-24

### TOP 10 — Formulários públicos, embed e captura de leads

- Validação central `lead-form-submit.util.ts`; limite `leadForms` por plano em `createForm`/`duplicateForm`.
- Submit público: dedupe lead aberto (TOP 09); resposta sem `captureId`; UTM no webhook.
- Testes `lead-form-*`; documento [`top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md`](./top/RADARZAP-TOP-10-FORMULARIOS-PUBLICOS-EMBED-CAPTURA-LEADS.md).

---

## [2.11.95] — 2026-06-24

### TOP 09 — Contatos, leads, Kanban e deduplicação

- Helpers `lead-stage.util.ts`, `lead-dedupe.util.ts`, `lead-inbound.util.ts` (funil oficial, dedupe, regras inbound).
- Capabilities `leads:view|manage|kanban:manage|export` e `contacts:view|manage`; API `/leads/*` com fallback legado.
- WhatsApp/WebChat genérico não cria lead automático (exige intenção comercial no 1º contato).
- Kanban: rótulos alinhados ao funil TOP 09.
- Documento [`top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md`](./top/RADARZAP-TOP-09-CONTATOS-LEADS-KANBAN-DEDUPLICACAO.md).

---

## [2.11.94] — 2026-06-24

### TOP 08 — Tickets, chamados, TK e rastreabilidade

- Helpers `ticket-status.util.ts` (estados de produto, `canCustomerReplyToTicket`) e `ticket-sla-priority.util.ts` (metas SLA por prioridade).
- Auditoria `AttendanceEvent`: `ticket.reopened`, `ticket.assigned`.
- Testes: status/SLA, notas internas fora da consulta pública, token ≠ TK, reabertura auditada.
- Documento [`top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md`](./top/RADARZAP-TOP-08-TICKETS-CHAMADOS-TK-RASTREABILIDADE.md).

---

## [2.11.93] — 2026-06-24

### TOP 07 — Inbox, conversas, fila e transferência

- Helpers `inbox-conversation-status.util.ts`, `inbox-org-access.util.ts`, `inbox-queue-eligibility.util.ts`.
- Fila: round-robin via `filterQueueEligibleAgentIds`; assumir valida presença+capacidade.
- Transferência: bloqueio conversa alheia; audit `inbox.queued|assigned|transferred|reassigned`.
- Eventos painel `inbox:assigned`, `inbox:transferred`.
- Anti cross-tenant em `getConversationIfAllowed`.
- Doc: `docs/top/RADARZAP-TOP-07-INBOX-CONVERSAS-FILA-TRANSFERENCIA.md`.

---

## [2.11.92] — 2026-06-24

### TOP 06 — modos de atendimento unificados

- Modos oficiais: `disabled`, `robotic`, `basic_triage`, `premium_assistant`, **`hybrid`**.
- Tipo central ampliado: `normalizeAttendanceMode`, helpers de cadeia, separação modo/provedor/créditos/fila.
- WhatsApp: `disabled` → fila humana direta; híbrido `handleHybridBotTriage`.
- WebChat: `runVisitorAutomationPipeline` com fallback humano.
- UI: card Híbrido + provedor IA em Premium/Híbrido.
- Doc: `docs/top/RADARZAP-TOP-06-MODOS-ATENDIMENTO.md`.

---

## [2.11.91] — 2026-06-24

### TOP 05 — status operacional, presença e fila segura

- Helper `agent-availability.ts`; regra central somente `online` na fila.
- `supervisor_online` validado no socket heartbeat; mensagem de erro oficial.
- Limite simultâneo por plano em `config/plans.json` (`maxConcurrentChatsPerAgent`).
- Alerta `inbox:agent_offline_risk` ao desconectar com chats ativos.
- Testes: `agent-availability`, `inbox-agent-presence-api`, plan-config.
- Documento `docs/top/RADARZAP-TOP-05-STATUS-PRESENCA-FILA.md`.

---

## [2.11.90] — 2026-06-24

### TOP 04 — RBAC, permissões, equipe e segurança multiempresa

- Matriz oficial de cargos/permissões documentada em `docs/top/RADARZAP-TOP-04-RBAC-PERMISSOES-EQUIPE-SEGURANCA.md`.
- Limites de equipe por plano (`includedUsers`, `includedAgents`, `includedSupervisors`) no convite e troca de cargo — `team-plan-limits.ts`.
- Papéis custom sugeridos: Financeiro, Marketing/Leads, Somente leitura (`defaultOrgCustomRoles`).
- Auditoria `AuditLog` em convite, alteração de cargo e remoção de membro.
- Testes: `capabilities-rbac`, `team-plan-limits`, `organization-team-cross-tenant`.

---

## [2.11.89] — 2026-06-24

### TOP 03 — planos, mensalidades e limites comerciais

- Matriz comercial oficial em `config/plans.json` (trial, free, starter, pro, enterprise).
- Validador de catálogo e tipos em `plan-config.ts`; limites operacionais via `resolveOperationalLimits`.
- IA Créditos por plano lidos do catálogo (`ai-wallet.ts`).
- Testes ampliados em `plan-config.test.ts`.
- Documento `docs/top/RADARZAP-TOP-03-PLANOS-MENSALIDADES-LIMITES.md`.

---

## [2.11.88] — 2026-06-24

### TOP 02 — baseline gates e governança

- Corrigido baseline TypeScript backend (`WebChatService`: datas ISO, badge setor, tipo `inactivitySla` no detalhe Inbox).
- Corrigido build frontend estrito (`InboxBotSettings`: campo `inactivityCloseGracefulQuickCode` tipado).
- Corrigido teste integração CSAT — mock `ConsentService.findContactDestinationForInbound`.
- CI frontend alinhado: `npm run build` (`tsc -b && vite build`) em vez de só `vite build`.
- Documento `docs/top/RADARZAP-TOP-02-GOVERNANCA-BASELINE-GATES.md` e gates oficiais TOP 02/20.

---

## [2.11.87] — 2026-06-24

### UI — Inbox e IA mais compactos (1080p)

- Layout viewport: `main` flex sem `calc(100dvh)` duplicado — corrige corte do composer/rodapé.
- Inbox: nav oculta com conversa aberta; visitantes recolhíveis; filtros com wrap; lista e painel direito mais estreitos.
- IA Atendimento: `PlatformPage`/`PageHeader` compact; stats row horizontal; blueprint em `<details>`.
- Componentes: `InboxStatsRow`, `InboxAtendimentoNav`, `InboxLiveVisitors` modo compact.

## [2.11.86] — 2026-06-24

### Fix — detalhe de chamados WebChat no painel

- **Sintoma:** tickets apareciam em **Atendimento → Chamados**, mas ao clicar **Abrir** a tela mostrava *Ticket não encontrado*.
- **Causa:** `GET /api/inbox/tickets/:ref` para `channel: webchat_site` chama `WebChatService.getDetailForInbox`; faltavam imports em `WebChatService.ts` (`loadInboxSettings`, `departmentBadgeFieldsFrom`, `WebhookDispatcherService`, bridge/fallback/painel) → `ReferenceError` em runtime.
- **Correção:** imports restaurados; `InboxTicketDetail.tsx` exibe a mensagem real da API (não só *não encontrado*).
- **Refs `TK-…`:** geração em `generateInboxTicketRef()` passa a usar alfabeto sem `0`/`O`/`1`/`I`/`L` (refs antigas em base36 continuam válidas — copie da lista ou use **Abrir**).
- **Vários TK do mesmo cliente:** esperado — cada sessão WebChat ou conversa convertida cria um chamado independente.
- Docs: `INBOX-ATENDIMENTO.md` § Lista × detalhe; `TICKET-ATENDIMENTO.md` § Referência `TK-…`; `WEBCHAT.md` § Chamados.

## [2.11.85] — 2026-06-24

### Docs — cobrança LLM × IA

- [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md) § Como funciona a cobrança: guia produto, tabelas LM/IA, exemplos de débito, fluxo mermaid.

## [2.11.84] — 2026-06-24

### IA — créditos, carteira mensal e barra do painel

- Carteira mensal por empresa: franquia do plano + créditos comprados; débito proporcional ao custo real de cada LLM Radar Chat (`AI_CREDIT_USD_UNIT`).
- Cota de **aprendizagem** (skills/memória automáticas) com limite mensal por plano.
- Barra superior: WhatsApp (todos com `inbox:view`), saldo **IA** e **LM** (`usado/total`) só com `inbox:ai:balance:view`.
- `GET /api/platform/ai/balance`, `GET /api/inbox/whatsapp-status`.
- Doc canônico: [`IA-CREDITOS-E-CARTEIRA.md`](./IA-CREDITOS-E-CARTEIRA.md).

## [2.11.83] — 2026-06-21

### Inbox — triagem visível para atendentes (configurável)

- Novo toggle em **Triagem e Bot → Triagem — visibilidade no Inbox** (`attendantTriageVisible`, padrão desligado).
- Dono/admin liberam conversas em `bot_triage` (antes da escolha do setor) para atendentes dos setores verem e assumirem no painel (WA + WebChat).

## [2.11.82] — 2026-06-21

### Inbox — triagem configurável

- Dono define tempos e mensagens de inatividade na triagem (`triageWarningMinutes`, `triageCloseAfterWarningMinutes`, mensagens custom).
- Padrão: 2 min → "Você está aí?"; +1 min → "Conversa encerrada por inatividade."
- UI em `/platform/inbox/bot` — card **Triagem — inatividade do visitante**.

## [2.11.81] — 2026-06-21

### Inbox — triagem

- Cronômetro **sem atendimento humano** na lista e no chat (`bot_triage`, WA + WebChat).
- Encerramento automático na triagem quando o cliente não interage (mesmo SLA de inatividade do Bot).
- `triageWaitSince` / `triageElapsedSec` / `triageUrgency` na API unificada.

## [2.11.80] — 2026-06-21

### Inbox — badge por setor + fix numeração Menu WhatsApp

- Badge na lista alinhado a **Setores**: nome do setor (público) ou **2ª instância** (interno); tags empilhadas ao lado do status.
- **Menu 1,2,3…** só para setores **ativos** e públicos; internos usam `i1`; inativos liberam número (`o1`).
- Reparo automático ao abrir Setores/Inbox; fix `clientOid` duplicado em `listConversations`.

---

## [2.11.79] — 2026-06-21

### Inbox — badge Lead/Comercial na lista (correção UX)

- Badge roxo **Comercial** (ou nome do setor) na **lista lateral** e no **header** do chat, ao lado de WhatsApp/Site e status — não na timeline.
- API `listConversations` / `getConversationDetail`: campos `isLeadEntry` e `leadSectorLabel` (vínculo `LeadCapture.inboxConversationId` ou setor comercial).
- Removido card visual na mensagem de sistema do chat (2.11.78).

## [2.11.78] — 2026-06-23

### Inbox — card do setor Comercial no chat (Lead) *(substituído por 2.11.79)*

- Mensagem de abertura da Central de Leads renderiza **card visual** (setor, Lead, origem, atendente, motivo).
- Backend inclui linha `Setor: …` na mensagem de sistema para histórico.

---

## [2.11.77] — 2026-06-23

### Leads — abrir atendimento cria conversa Lead no Inbox

- **Abrir atendimento** na Central de Leads cria conversa `in_progress` (não reutiliza triagem bot ociosa).
- Setor **Comercial/Lead** + segmento **Lead** + tag no contato; mensagem de sistema com origem da captura.
- Conversa encerrada vinculada ao lead não bloqueia nova abertura.

---

## [2.11.76] — 2026-06-23

### Leads — fix Abrir atendimento (cria conversa no Inbox)

- Lead com contato vinculado sem conversa: botão **Abrir atendimento** (não "Assumir") — chama `POST /open-inbox` e cria ou reutiliza conversa no Inbox.
- Kanban, lista e painel lateral alinhados; toast "Conversa aberta no Inbox".

---

## [2.11.75] — 2026-06-23

### Leads — paridade WebChat no detalhe + refresh ao assumir

- Painel lateral e aba **Conversa**: link Inbox para leads WebChat (`wc:`).
- **Assumir atendimento** em conversa WA existente promove status para `in_progress` e emite refresh.
- Kanban: atalho **Inbox** no hover quando lead já tem conversa aberta.

---

## [2.11.74] — 2026-06-23

### Leads — classificador comercial + refresh tempo real

- Intenção comercial usa **classificador local** (`classifyLocal`) — evita confundir financeiro/suporte; frases explícitas como fallback.
- Evento socket silencioso `lead:updated` atualiza Kanban/lista ao mudar status (ex.: encerrar atendimento).
- Modo Lista: link **Inbox** também para leads WebChat (`wc:`).

---

## [2.11.73] — 2026-06-23

### Leads — lista + sync ao encerrar atendimento

- Modo **Lista**: ações rápidas Assumir, WhatsApp e Salvar como contato (paridade com Kanban).
- Ao encerrar conversa **Inbox** ou **WebChat**, lead `in_progress` vinculado passa automaticamente para **Qualificado**.

---

## [2.11.72] — 2026-06-23

### Leads — intenção comercial + ações Kanban

- Lead automático por palavras-chave comerciais em conversa WA/WebChat aberta (contato existente).
- Kanban: WhatsApp inline e Salvar como contato no hover; util `hasCommercialLeadIntent`.

## [2.11.71] — 2026-06-23

### Leads — retorno WA/WebChat + Assumir no Kanban

- Lead automático quando cliente existente abre nova conversa WhatsApp ou nova sessão WebChat.
- Assumir atendimento atribui responsável no lead; botão rápido Assumir no hover do Kanban.

## [2.11.70] — 2026-06-23

### Leads — WebChat inbound + notificação painel

- Nova sessão WebChat (telefone desconhecido) gera lead com origem `webchat` e vínculo `wc:` no Inbox.
- Evento `lead:new_entry` no sino; página Leads atualiza via socket.
- E2E Leads alinhado às métricas operacionais.

## [2.11.69] — 2026-06-23

### Leads — WhatsApp inbound + captura manual

- Primeiro contato WhatsApp gera `LeadCapture` automaticamente (`maybeCaptureWhatsAppInbound` + hook no Inbox).
- Botão **Capturar lead** e `POST /leads/captures` para entrada manual.
- Filtros operacionais: `origins` (multi-origem) e `openOnly` alinhados aos cards de métricas.
- Kanban: motivo opcional ao marcar Perdido/Spam via drag.

## [2.11.68] — 2026-06-23

### UX — Leads: Central de Entrada Comercial

- Métricas operacionais (Novos, WhatsApp aguardando, Site/Formulários, Sem responsável, etc.) com clique para filtrar.
- Textos amigáveis, abas Conversa/Contato, bloco "Próxima ação", Kanban com coluna Aguardando e cards informativos.
- Modo Lista em tabela com ações rápidas; filtro por responsável; stats `operational` na API.

## [2.11.67] — 2026-06-23

### UX — Leads: layout CRM com painel lateral

- Aba Capturas: Kanban/lista + detalhe lateral fixo (420px), sem rolagem da página inteira.
- Painel com abas internas (Resumo, Atendimento, Listas, Histórico), ação primária destacada e menu Mais.
- Cards e funil compactos; filtros em barra + drawer avançado; preferência Lista/Kanban em localStorage.
- Mobile: detalhe em drawer full screen; Kanban com scroll interno por coluna.

## [2.11.66] — 2026-06-23

### Feat — Leads: vínculo com contato, WhatsApp inline e temperatura

- **Vincular contato**: modal com busca (`GET /leads/contacts-search`) e vínculo sem converter (`POST …/link`).
- **WhatsApp**: painel inferior com composer + respostas rápidas; envia via Inbox (abre conversa se necessário).
- **Temperatura do lead** (Fria / Morna / Quente) substitui o seletor de status duplicado no detalhe; badge no cabeçalho.

## [2.11.65] — 2026-06-23

### Feat — Leads: Kanban, embed completo, preview inline, responsável padrão

- **Kanban** na aba Capturas (drag-and-drop de status).
- **form.js**: select/checkbox/hidden, tema claro/escuro/auto, tamanho compact/padrão/largo, logo Radar Chat.
- **Integrar no site**: pré-visualização iframe inline + alerta de domínios.
- **Responsável padrão**: seletor de equipe (`GET /leads/assignees`), nome no detalhe do lead.
- Editor: bloco Aparência; opções de select no editor de campos.
- E2E `e2e/leads-panel.spec.ts`; mocks ampliados.

### Fix — Notificações painel (offline / mutations)

- Sonner apenas — removido fallback `window.alert()` duplicado.
- Dedupe de toasts de API offline (5 s); mensagem unificada ao reiniciar o servidor.
- Kanban: não dispara PATCH se o status já é o mesmo.

## [2.11.64] — 2026-06-23

### Feat — Leads: hub completo captura → qualificação → conversão

- Cards de métricas (`GET /leads/stats`), funil visual, filtros avançados (origem, formulário, lista, período, consentimento).
- Painel de detalhe com histórico, deduplicação, conversão/vínculo a contato, listas, UTM e badges LGPD.
- Aba **Listas e segmentos** com atalhos ao módulo Contatos (`GET /leads/segments-summary`).
- Formulários: destino do lead (status inicial, listas, tags, modo contato), consentimento/honeypot, duplicar, stats por form.
- API: `POST …/convert`, `…/add-to-groups`, `DELETE …/captures/:id`, webhooks `lead.*`.
- Status `qualified` e `spam`; embed com UTM, consentimento e honeypot.

## [2.11.63] — 2026-06-23

### Feat — Leads: excluir formulário + campos customizados

- Botão **Excluir** no card e no editor (API DELETE já existia).
- Editor de campos: ativar/desativar e-mail e mensagem (com obrigatório), adicionar/remover campos extras.
- `customFields` no embed `form.js` e metadados na captura; proxy Vite `/leads`.

## [2.11.62] — 2026-06-23

### Feat — Leads: hub de integração no painel

- Aba **Integrar no site** em `/platform/leads`: embed padrão, API/fetch, HTML, WordPress (CF7), Elementor e construtores.
- Snippets copiáveis por formulário; domínios permitidos no editor; `GET /leads/forms` também com `consent:view`.

## [2.11.61] — 2026-06-23

### Fix — Leads preview "Formulário indisponível"

- GET `/api/leads/public/forms/:key/config` sem checagem de origem (validada no submit).
- `isWebChatOriginAllowed`: em dev, permite request sem Origin/Referer (preview same-origin).
- `form.js` exibe mensagem de erro da API.

## [2.11.60] — 2026-06-23

### Fix — Preview Leads embed vazio

- `form.js`: fallback quando `document.currentScript` é null (script injetado dinamicamente na preview).
- Preview dev auto-carrega formulário ativo via `GET /api/leads/dev/preview-config` (sem `?key=` na URL).

## [2.11.59] — 2026-06-23

### QA — Preview embed Leads + setup script

- `GET /leads/preview.html?key=lfm_…` — página de teste para QA § B.1.
- `npm run qa:leads:setup` — garante formulário ativo, `localhost` em `allowedDomains`, imprime URL.
- `qa:prep` lista formulários Leads ativos.

## [2.11.58] — 2026-06-22

### Feat — Lead → Inbox em um clique

- `POST /api/leads/captures/:id/open-inbox` (`inbox:reply`): cria ou reutiliza conversa, mensagem de sistema com dados do formulário, atribui ao atendente.
- Campo `inboxConversationId` em `LeadCapture`; botões **Iniciar atendimento** / **Continuar no Inbox** na UI Leads.
- `InboxService.openConversationFromLead`; E2E mock da rota.

## [2.11.57] — 2026-06-22

### Feat — Formulário público de Leads + fila por capacidade do atendente

- **Leads:** modelos `LeadForm` / `LeadCapture`, API pública `/api/leads/public`, embed `/leads/form.js`, menu **Contatos → Leads** (`/platform/leads`).
- Captura cria/atualiza `Destination` + segmento Lead (`ContactAutoSegmentService.tagLeadFromForm`).
- **Fila:** `maxConcurrentChatsPerAgent` (padrão 1), round-robin ignora atendentes no limite (Inbox + WebChat + bridge WA), mensagem com posição na fila, scan `processBusySuggestedPriority`.
- E2E mock `/platform/leads`; deep link `?search=` no Inbox; ação **Abrir Inbox** no detalhe do lead.

---

## [2.11.56] — 2026-06-22

### Fix — loop infinito presença no painel

- **Maximum update depth:** callbacks de presença em `actionsRef`; `setPresenceLocal` e sync `/inbox/presence/me` só atualizam quando o valor muda.
- **Build QA:** `CardTitle` aceita `className` (corrige `TeamMembers` / `qa:fase1:e2e`).
- **E2E local:** Playwright limita workers paralelos fora do CI (evita timeout no preview :4174).

---

## [2.11.55] — 2026-06-22

### Fix — bridge WA→WebChat com delay curto

- Respostas via bridge WhatsApp usam humanização **reduzida** (~0,35–1,1s) em vez de zero ou o delay do painel (1,5–10s).
- Painel continua com delay completo para parecer digitação natural no widget.

---

## [2.11.54] — 2026-06-22

### Fix — bridge WA → WebChat instantâneo

- Respostas do atendente via **bridge WhatsApp** (`!assumir`) usam delay curto (~0,35–1,1s) antes de aparecer no widget — não o delay longo do painel (1,5–10s).
- Sincronização do comentário no ticket roda em background para não bloquear a entrega da mensagem.

---

## [2.11.53] — 2026-06-22

### Fix — presença atendentes + fallback WA rotativo

- **Presença:** heartbeat inicial não rebaixa mais atendentes para `offline` (socket ativo → `online` no supervisor e round-robin).
- **Fallback WebChat:** alerta WhatsApp **um atendente por vez** (WA verificado na equipe); sem `!assumir` no timeout → próximo; esgotados → telefones manuais em `whatsappFallbackAlertPhones`.
- Escalação sem ninguém online no painel dispara alerta imediato ao 1º atendente com WA.

---

## [2.11.52] — 2026-06-22

### Fix — OTP WhatsApp perfil

- OTP de confirmação usa `sendOperationalTextMessage` — **não exige** número em Contatos/consentimento.
- Resolve variantes BR (9º dígito) via `onWhatsApp` antes do envio.

## [2.11.51] — 2026-06-22

### Fix — Meu perfil

- **Fix:** `/settings#perfil` travava em "Carregando perfil…" — frontend chamava `/api/auth/me/*` mas rotas estão em `/auth/me/*`; `sessionApi` no painel.

## [2.11.50] — 2026-06-22

### Equipe / Perfil — política e confirmações

- Dono define se atendentes **podem editar** dados em Meu perfil (`teamSettings.allowMembersEditOwnProfile`; padrão: bloqueado).
- Empresa cadastra nome, e-mail e WhatsApp; atendente **sempre confirma** e-mail (OTP) e WhatsApp (OTP), mesmo com edição bloqueada.
- Login **Google** dispensa confirmação de e-mail (já verificado pelo OAuth).
- API: `GET/PATCH /organization/team-settings`, `PATCH /team/members/:id/profile`, `POST /auth/me/email/*`.

## [2.11.49] — 2026-06-22

### Equipe / Perfil — verificação WhatsApp

- Dono/admin **pode** cadastrar WhatsApp do membro na equipe, mas o número **só é salvo após OTP** enviado ao próprio número.
- Membro também confirma em **Meu perfil** com o mesmo fluxo de código de segurança.
- Quando admin inicia o cadastro, o **dono da empresa** recebe aviso de auditoria no WhatsApp verificado dele.
- API: `POST /team/members/:id/whatsapp/request-code`, `…/confirm`, `DELETE …/whatsapp`.

## [2.11.48] — 2026-06-22

### Equipe / Perfil / Inbox

- WhatsApp pessoal: só o próprio membro cadastra com **código OTP** enviado no WA da empresa (`/auth/me/whatsapp/*`).
- Admin não edita mais telefone no modal de papel — `/settings#perfil` + link no header.
- Atendente sem setor atribuído **não vê** filas abertas — só conversas atribuídas a ele (WA + WebChat).

## [2.11.47] — 2026-06-22

### Painel / Notificações

- Notificações do sino **persistidas no Redis** — sobrevivem ao F5 (últimos 80 eventos / 14 dias).
- API: `GET /panel/notifications`, `POST …/read`, `POST …/read-all`, `POST …/ingest` (WA client).
- Página **Ver todas**: `/dashboard/notificacoes` + link no balão do sino.

## [2.11.46] — 2026-06-22

### WhatsApp / Sessões

- **Fix:** erro 440 (conexão substituída) — bloqueia auto-reconnect em loop; exige connect manual.
- **Fix:** dev lock mata processo órfão no hot-reload (ts-node-dev) antes de restaurar WA — causa raiz do 440 em dev.
- **Fix:** **Novo QR** usa `refreshQr` (reinicia socket sem apagar credenciais) em vez de `forceQr`.

## [2.11.45] — 2026-06-22

### WhatsApp / Sessões

- **Fix:** deadlock após escanear QR (código 515 `restartRequired`) — `sessionCreatePromises` impedia nova socket.
- **Fix:** reconexão agendada não bloqueia mais pedido explícito de connect; timers cancelados no `abort`.
- **Fix:** cooldowns de reconexão excessivos revertidos (2s→30s exponencial); auto-reconnect 60s.
- **Fix:** botão **Novo QR** envia `forceQr: true` para gerar QR fresco.

## [2.11.44] — 2026-06-22

### Inbox / Supervisão

- Chat interno: menção `@supervisor` dispara notificação no sino (`inbox:supervisor_help`) para quem tem `inbox:supervise`.
- Dashboard supervisor: card **Pedidos de ajuda**, badge nas conversas ativas e preview da mensagem interna.

---

## [2.11.43] — 2026-06-22

### Estabilidade WhatsApp

- Fix loop conectar/desconectar: `connectInstance` idempotente (não aborta sessão ativa); uma promise por `createWhatsAppSession` (evita erro 440 / ban).
- Reconexão automática: cooldown 30–120s, máx. 5 tentativas; auto-reconnect a cada 5 min via `restoreSession` (sem `abort`).
- Eventos painel: remove pub/sub duplicado; alertas WA com debounce 60s; erro 440 orienta reconexão manual.
- Dev: `ts-node-dev` ignora `sessions/`, `data/`, `test-results/` (Baileys gravava creds e reiniciava o backend em loop).

---

## [2.11.42] — 2026-06-22

### Equipe

- Fix convite de membro: índice `companyMembers` permite vários convites pendentes por empresa (partial `userId`).
- Convite vincula conta existente imediatamente (`linkedAccount`); login Google associa todos os convites pendentes do e-mail (multi-empresa).

---

## [2.11.41] — 2026-06-22

### Testes

- E2E presença operacional: `e2e/qa-fase1-presence.spec.ts` (seletor status + PATCH).
- Script `npm run qa:fase1:all` (Playwright + gate Jest); `qa:fase1:e2e` faz build do frontend antes do preview.
- Fix `InboxSectors.tsx`: `useMemo` antes do guard `canManage` (violação Rules of Hooks quebrava página após `auth/me` async).
- Docs QA: `QA-FASE1-RAPIDO.md`, `QA-FASE1-CHECKLIST.md` atualizados (§ B coberto por E2E mock).

---

## [2.11.40] — 2026-06-22

### Testes

- E2E Playwright § B painel: `e2e/qa-fase1-panel.spec.ts` (tickets, setores, bot, respostas, relatórios, webchat) — `npm run qa:fase1:e2e` (32 testes).
- Fix mock `webchat/stats` no fixture E2E (rota única `/api/webchat/**`).

---

## [2.11.39] — 2026-06-22

### Documentação

- Arquivados em `docs/concluidos/`: `ENTREGA-ATENDIMENTO-2.11.24-28.md`, `ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`; links atualizados em todo o repo.

---

## [2.11.38] — 2026-06-22

### Corrigido

- CI: `npm audit` — override `undici@6.27.0` (vulnerabilidade high via `discord.js`).

---

## [2.11.37] — 2026-06-22

### Corrigido

- E2E Supervisor: seletor strict mode para métrica «Em atendimento» (`inbox-authenticated.spec.ts`).

### Documentação

- `INDICE-DOCUMENTACAO.md` § QA; `SISTEMA-REGISTRO.md` 2.11.36; `qa-prep` aponta KICKOFF.

---

## [2.11.36] — 2026-06-22

### Corrigido

- Build TypeScript: import `CampaignDispatchService` / `CampaignPriority` em `DashboardService.ts`.

### Documentação

- `QA-FASE1-KICKOFF.md` — ponto de partida gate humano; checklist/ROADMAP sincronizados (2.11.35).

---

## [2.11.35] — 2026-06-22

### Adicionado

- Testes integrados `inbox-inbound-order.integration.test.ts` — ordem ticket → consent → inbox (espelho `WhatsAppService`), CSAT antes de ticket/inbox, complemento ticket, consent bloqueia inbox.

---

## [2.11.34] — 2026-06-22

### Adicionado

- Audit log append-only `AttendanceEvent` para ticket: `ticket.created`, `ticket.client_replied`, `ticket.closed` em `InboxService` (meta sem corpo de mensagem).
- Testes `attendance-audit.service.test.ts` e `inbox-ticket-audit.integration.test.ts` no gate.

---

## [2.11.33] — 2026-06-22

### Adicionado

- Webhooks outbound: `ticket.created`, `ticket.client_replied`, `ticket.closed`, `webchat.bridge.started`, `webchat.bridge.closed` — em `InboxService`, `webchat-whatsapp-bridge.service.ts`, catálogo `WEBHOOK_EVENTS` e UI Webhooks.
- Testes `webhook-events.test.ts` e `webchat-bridge-webhook.test.ts` no gate `qa:atendimento:gate`.
- Doc `WEBHOOKS.md` § payloads ticket/bridge.

---

## [2.11.32] — 2026-06-22

### Adicionado

- E2E Playwright autenticado (mock API): `e2e/inbox-authenticated.spec.ts` — Inbox (lista, fila, thread, Assumir, banner WebChat) + Supervisor (métricas, abas fila/atendimento).
- Fixture `e2e/fixtures/mock-inbox-api.ts` — mock `/auth/me` + APIs Inbox/Supervisor/presença.

---

## [2.11.31] — 2026-06-22

### Adicionado

- Testes integrados `inbox-ticket-inbound.integration.test.ts` — `handleTicketInboundMessage`: novo atendimento, janela 12h, expires inflado, competição fila, CSAT primeiro.

---

## [2.11.30] — 2026-06-22

### Adicionado

- Testes integrados `inbox-csat-reply.integration.test.ts` — `tryHandleCsatReply` + ordem CSAT em `handleInboundMessage` (6 casos no gate).

---

## [2.11.29] — 2026-06-22

### Adicionado

- Testes `panel-critical-alerts.service.test.ts` — cota mensagens/IA, dedup, config fallback e IA sem chave.
- Gate `qa:atendimento:gate` inclui `panel-critical-alerts`.

---

## [2.11.28] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md).

### Adicionado

- **Fallback WhatsApp deferido:** campo `whatsappFallbackAcceptTimeoutSeconds` (30–900s, padrão 60); após escala na fila aguarda aceite no painel; scan ~60s (`processWebChatFallbackAcceptTimeouts`); evento `webchat:fallback_missed` (urgente, `targetUserId`).
- **Notificações críticas (sino vermelho):** `src/types/panel-events.ts` + `PanelCriticalAlertsService` — plano, cota IA/mensagens, config incompleta; urgentes operacionais: `whatsapp:disconnected`, `inbox:queue_sla`, `inbox:ticket_sla`.
- Eventos `billing:*`, `ai:quota_*`, `system:critical_config` — `ownerOnly` (`billing:view`).

### Corrigido

- **WebChat IA Básica:** `WebChatBasicTriageService` / `isBasicTriageMode` — não cai no menu robotizado na 1ª mensagem.
- **Fallback com atendente online:** presença por heartbeat (`availableForQueue`); fallback removido de `escalateToQueue` imediato.
- **Testes:** mock `whatsapp-send-policy` em `WhatsAppService.test.ts`.

---

## [2.11.25] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §3.

### Adicionado

- **Status operacional:** `online`, `ausente`, `ocupado`, `offline`, `supervisor_online` — seletor header, auto-ausente por inatividade, RR/fila por `availableForQueue`.
- API `GET/PATCH /inbox/presence/me`, `GET /inbox/presence/team`, `PATCH /inbox/presence/:userId`, `GET /inbox/presence/config`.
- Campo `presenceIdleTimeoutSeconds` (60–3600s, padrão 300); constantes `src/constants/agent-presence.ts`.
- Frontend: `agentPresenceContext`, `useAgentPresenceHeartbeat`, `AgentStatusSelector`.

---

## [2.11.24] — 2026-06-21

Doc detalhada: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §2.

### Adicionado

- **Supervisão avançada:** `GET /inbox/supervisor/dashboard` — equipe, presença, conversas ativas WA+WebChat, fila unificada, métricas 7d (TMA, puxar fila, CSAT).
- `InboxSupervisorDashboardService`, tipos `inbox-supervisor.ts`, `SupervisorMonitorDrawer`.
- Reassign supervisor inclui IDs `wc:`.

---

## [2.11.16] — 2026-06-21

### Adicionado / corrigido

- Auditoria completa reescrita: [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md) (revisão 2, evidências no código).
- Script `npm run qa:atendimento:gate` — jest atendimento crítico + `qa:webchat-wa`.
- Anti-loop alerta fallback WebChat: ignora telefones que coincidem com sessão Baileys (`filterFallbackAlertPhones`).

---

## [2.11.15] — 2026-06-21

### Documentação

- Pasta [`concluidos/`](./concluidos/README.md) — 12 entregas finalizadas arquivadas (fases modos 1–8, FAQ WA, upgrade Inbox, audit menus).
- Links atualizados em índice, consolidado, CHANGELOG e protocolo de versionamento.

---

## [2.11.14] — 2026-06-21

### Documentação

- Consolidação rascunhos GG → `PLANO-CONSULTA-ATUALIZACAO-APLICACAO.md`, [`ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md`](./concluidos/ANALISE-CRITICA-ATENDIMENTO-ESTABILIZACAO.md), `RADARZAP-VISAO-PRODUTO-DIFERENCIACAO.md`.
- `TICKET-ATENDIMENTO.md` § mensagens visíveis vs `!nota` interna.
- `INDICE-DOCUMENTACAO.md` atualizado.

---

## [2.11.13] — 2026-06-21

### Adicionado

- Chamado WebChat: mensagens ao cliente (`comments`) publicadas no chat e consulta TK+token; `!nota` e notas internas só equipe.
- Bridge WA `TK-…` sincroniza `comments`; visitante sincroniza `clientReplies`.

---

## [2.11.11] — 2026-06-21

### Corrigido

- Consulta pública: oculta intake/bridge; rejeita assunto placeholder do alerta WA `!abrir`.

---

## [2.11.10] — 2026-06-21

### Corrigido

- Atualização de chamado WebChat enviada ao visitante (não WhatsApp); consulta TK+token prioriza token e ampliada.

---

## [2.11.9] — 2026-06-19

### Adicionado / alterado

- Menu `!ajuda` reorganizado por seções (atendimento, consulta, encerrar).
- **`!abertos`** / **`!meus`** — listar chamados abertos ou atribuídos ao atendente.
- **`!nota TK-…`** — nota interna no chamado.
- **`!abrir TK-… motivo`** — texto após a referência vira assunto + nota interna (@setores); visitante só recebe token.

---

## [2.11.8] — 2026-06-19

### Adicionado

- Comando WhatsApp **`!abrir TK-XXXX`** (alias `!abrirchamado`) — abre chamado formal no chat do site e envia token ao visitante (paridade com painel Inbox).
- Alerta fallback WA e `!ajuda` atualizados com `!abrir`.

---

## [2.11.7] — 2026-06-19

### Corrigido

- **`!assumir`** no WebChat volta a **não abrir chamado** — só assume conversa + bridge WhatsApp.
- Abertura formal + token ao visitante permanecem só em **Inbox → Abrir chamado** (ou IA quando configurada).
- **`!token`** exige chamado já aberto no painel.

---

## [2.11.6] — 2026-06-19

### Corrigido (revertido em 2.11.7)

- ~~`!assumir` abria chamado automaticamente~~ — comportamento incorreto para o produto.

---

## [2.11.5] — 2026-06-19

### Adicionado / alterado

- **WebChat painel:** editor guiado (navegação lateral, simples/avançado, visão geral, barra de salvar, duplicar widget).
- **Preview:** `livePreviewTemplateId`, prévia interativa Chat Box, fixes overlay e sessão local.
- **Widget/API:** `previewTemplateId` na config pública; localhost liberado em dev; notas de contato truncadas (2000 chars).

### Documentação

- `docs/WEBCHAT.md` — seção contrato painel ↔ widget (2.10.100–2.10.105).

---

## [2.11.4] — 2026-06-19

### Adicionado

- **Fase 8:** E2E Playwright autenticado (mock API) dos 4 modos em `/platform/inbox/ia`.
- Fixtures `e2e/fixtures/mock-panel-api.ts` + spec `e2e/attendance-modes.spec.ts`.
- `data-testid` nos cards de `AttendanceModePicker`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-8.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-8.md)

---

## [2.11.3] — 2026-06-19

### Adicionado

- **Fase 7:** campo `usageKind` em `AiUsage` — contadores Premium vs IA Básica (LLM fallback).
- `GET /platform/ai/usage` retorna `totals.byKind` e linhas tipadas.
- UI Logs: breakdown por modo + tabela de chamadas; Geral mostra uso diário por modo.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-7.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-7.md)

---

## [2.11.2] — 2026-06-19

### Alterado

- **Fase 6:** WebChat alinhado ao modo global — IA Premium conversacional só com `premium_assistant` + toggle do widget.
- `GET /webchat/ai-status` retorna `attendanceMode`, `premiumAiAllowed`, `globalModeHint`.
- UI WebChat: checkbox renomeado; desabilitado fora de Premium.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-6.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-6.md)

---

## [2.11.1] — 2026-06-19

### Adicionado

- **IA Básica (Fase 5):** modo `basic_triage` com classificador local, auto-resolve KB/skills, encaminhamento por setor (WA + WebChat).
- `AiBasicTriageService`, `WebChatBasicTriageService`, `basic-triage-classifier.ts`.
- Campo `basicTriageLlmFallbackEnabled` em `AiPrompt` — LLM Radar Chat opcional em ambiguidade.
- `AiProviderService.completeForBasicTriage()` — fallback econômico.

### Alterado

- UI `/platform/inbox/ia`: card IA Básica habilitado; banner e toggle LLM fallback.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-5.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-5.md)
- Consolidado modos atualizado para `2.11.1`.

---

## [2.11.0] — 2026-06-19

### Adicionado

- **Governança:** protocolo oficial de versionamento e documentação em `.md` ([`VERSIONAMENTO-E-DOCUMENTACAO.md`](./VERSIONAMENTO-E-DOCUMENTACAO.md)).
- **Índice:** [`INDICE-DOCUMENTACAO.md`](./INDICE-DOCUMENTACAO.md) com mapa de todos os docs relevantes.
- **Modos de atendimento (baseline minor):** Fases 1–4 agrupadas sob versão de produto `2.11.0`.

### Documentação

- Consolidado modos: [`RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md`](./RADARZAP-MODOS-ATENDIMENTO-IMPLEMENTACAO.md).
- Análise: [`ANALISE-MODOS-ATENDIMENTO.md`](./concluidos/ANALISE-MODOS-ATENDIMENTO.md).
- Fases: [`PHASE-1`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-1.md), [`PHASE-3`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-3.md), [`PHASE-4`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-4.md).
- [`SISTEMA-REGISTRO.md`](./SISTEMA-REGISTRO.md) sincronizado até `2.11.0`.

**Commits:** `171b078`, `f899af0`, `b240284`, `2cc2b2a`

---

## [2.10.108] — 2026-06-19

### Adicionado

- WebChat: menu robotizado quando `AiSettings.attendanceMode === robotic` (`WebChatRoboticTriageService`, reusa `inbox-triage.ts`).

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-4.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-4.md)

**Commit:** `f899af0`

---

## [2.10.107] — 2026-06-19

### Adicionado

- Campo `attendanceMode` em `AiSettings` (Mongo) com backfill lazy.
- API `GET/PATCH /platform/ai/settings` inclui `settings.attendanceMode`.
- `isAiActive()` exige `premium_assistant`; helper `shouldRunGenerativeAi()`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-3.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-3.md)

**Commit:** `b240284`

---

## [2.10.106] — 2026-06-19

### Adicionado

- Tipos e adapter `src/types/attendance-mode.ts` (modo × provedor legado).
- UI `/platform/inbox/ia`: 4 cards de modo + seção Provedor da IA.
- Componentes `AttendanceModePicker`, `lib/attendanceMode.ts`.

### Documentação

- [`RADARZAP-ATTENDANCE-MODES-PHASE-1.md`](./concluidos/RADARZAP-ATTENDANCE-MODES-PHASE-1.md)
- [`ANALISE-MODOS-ATENDIMENTO.md`](./concluidos/ANALISE-MODOS-ATENDIMENTO.md)

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
