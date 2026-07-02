# RadarChat — Auditoria Geral de Segurança, Dados, Estabilidade e Garantia — 5 Etapas — 2.17.62

**Data da auditoria:** 2026-07-01  
**Versão do código auditada:** `2.17.61` (`package.json`)  
**Ciclo do documento:** `2.17.62`  
**Executor:** agente Cursor (auditoria local, sem deploy/push/produção)  
**Escopo:** código em `c:\Users\benhu\OneDrive\Área de Trabalho\Projetos\radarzapv2`

---

## 1. Resumo executivo

Auditoria em 5 etapas sobre o Radar Chat v2 (Node.js 24 + TypeScript + Express + MongoDB + Redis/BullMQ + React/Vite). O sistema possui **arquitetura multiempresa madura no painel monolith** (`DashboardService`), RBAC granular (`Cap.*`), consentimento LGPD, WebChat público com origem/token, WhatsApp Baileys isolado por `clientId`, catálogo/PIX com aprovação humana, IA com metering de créditos e gates de QA automatizados.

**Correções aplicadas nesta auditoria (2):**
1. **P0 — IDOR APIGateway templates:** middleware `validateClientOwnership` aplicado em todas as rotas `/api/v1/templates/client/:clientId/*`.
2. **P1 — Token de comprovante PIX sem expiração:** novos links com TTL 72h; legado aceito temporariamente.

**Veredito:** **NÃO liberado para produção plena** — Fase 1 de estabilização do roadmap ainda aberta; pendências P1 em atendimento WA, tokens legados PIX, PII em prompts IA e QA manual. Base técnica sólida; gates automatizados verdes no escopo executado.

---

## 2. Status final

| Campo | Valor |
|-------|-------|
| **Status geral** | Parcialmente pronto — núcleo implementado, hardening em progresso |
| **Pode ir para produção?** | **NÃO** (go-live completo) |
| **Motivo** | Roadmap Fase 1 (estabilização atendimento WA) não fechada; P1 abertos; 33 itens de QA manual pendentes no checklist `qa-auditoria-geral` |
| **Bloqueadores P0** | Nenhum P0 aberto após correção IDOR templates (verificar deploy APIGateway porta 3000) |
| **Bloqueadores P1** | Estabilidade WA em produção não validada; token PIX legado sem expiração ainda aceito; PII para LLM sem mascaramento; `SYSTEM_ADMIN` bypass total |
| **Riscos P2** | CORS aberto WebChat público; PDF WebChat sem scan profundo; `findById` + check tardio em rotas painel; Socket.IO sem sessão em non-prod |
| **Melhorias P3** | `getTenantFilter` não usado; lint parcial (`lint` só 3 arquivos); chunks frontend >500kB |

---

## 3. Escopo analisado

- Estrutura do monorepo (`src/`, `docker/`, `e2e/`, `docs/`, `scripts/`)
- Backend: `src/index.ts`, `DashboardService.ts`, serviços em `src/services/*`, modelos `src/models/*`, auth `src/auth/rbac/*`, middlewares `src/middleware/*`
- Frontend painel: `src/services/web-dashboard/frontend/` (React 19 + Vite 8)
- WebChat widget: `src/services/web-dashboard/webchat/widget.js`
- APIGateway legado: `src/services/api-gateway/APIGateway.ts`
- Catálogo/PIX: `CatalogSalesService.ts`, `docs/CATALOGO-PIX-PEDIDOS.md`
- IA: `src/services/ai/*`, `docs/IA-CREDITOS-E-CARTEIRA.md`
- CI/CD: `.github/workflows/ci.yml`, `deploy.yml`
- Gates: `npm run qa:auditoria:quick`, `npm run typecheck`, `npm audit`, testes focados

---

## 4. Escopo não analisado e motivo

| Item | Motivo |
|------|--------|
| VPS/Coolify em produção | Instrução explícita: não alterar produção |
| Pentest externo / DAST | Fora do escopo local |
| Carga/stress test | Não executado (risco em ambiente real) |
| Todos os ~301 endpoints do painel linha a linha | Amostragem + padrões + testes cross-tenant; revisão exaustiva manual pendente |
| Discord bot em runtime real | Requer credenciais e guild ativa |
| Baileys sessão real WhatsApp | Requer dispositivo pareado |
| E2E Playwright completo (14 gates) | Não executado nesta sessão (tempo); build + jest quick verdes |
| Backup/restore Mongo em produção | Não executado |

---

## 5. ETAPA 1 — Inventário real do sistema

| Área | Encontrado? | Evidência | Risco inicial | Observação |
|------|-------------|-----------|---------------|------------|
| Estrutura geral | Sim | `src/`, `docker/`, `e2e/`, `scripts/`, `config/` | P3 | Monolito principal + microserviços legados em `docker-compose.yml` |
| Scripts `package.json` | Sim | 50+ scripts: `build`, `dev`, `test`, `qa:*`, `pre-push:gate` | P2 | `qa:auditoria:gate`, `qa:atendimento:gate`, `pre-push:gate` documentados |
| Framework backend | Sim | Express 4.19 (`package.json`, `DashboardService.ts`) | P2 | Socket.IO no mesmo processo |
| Framework frontend | Sim | React 19.2 + Vite 8 + TanStack Query (`frontend/package.json`) | P3 | Design system em `design-system/` |
| TypeScript | Sim | `tsconfig.json`, `tsc` no build, strict em projetos | P2 | Alguns `any` em áreas legadas |
| Banco de dados | Sim | MongoDB 6 + Mongoose 8 (`DatabaseManager.ts`, 49 models) | P1 | Tenant via `clientId` / `organizationId` |
| Redis/fila/cache | Sim | `RedisManager.ts`, BullMQ 5 (`QueueManager.ts`) | P1 | Obrigatório em prod; `INFRA_DEGRADED_BOOT` só dev |
| Docker/Coolify | Sim | `docker/Dockerfile.monolith`, `docker-compose.coolify-ghcr.yml`, workflows Coolify | P2 | Deploy automático na `main` |
| Serviços principais | Sim | `whatsapp/`, `webchat/`, `inbox/`, `ai/`, `billing/`, `catalog/`, `leads/`, `consent/`, `integrations/` | P1 | Boot em `src/index.ts` |
| Rotas/endpoints | Sim | `DashboardService.ts` (~301 rotas `r.get/post/...`); APIGateway `/api/v1/*` | P1 | Públicas montadas antes de auth |
| Models/schemas | Sim | 49 arquivos em `src/models/` | P2 | TTL em `AttendanceEvent`, `SystemLog`, `AuditLog` |
| Middlewares globais | Sim | `helmet`, `cors`, `sanitizeInput`, `rateLimiters`, `requireDashboardOrigin`, `loadAuthContext` | P2 | CSRF via same-origin, não `csurf` |
| Autenticação | Sim | `express-session` + Redis, OAuth Google/Discord (`DashboardService.ts` ~751+) | P1 | Cookie `radarchat.sid`, TTL 7d |
| RBAC | Sim | `src/auth/rbac/` — `Cap`, `can()`, `requireCapability()` | P1 | `SYSTEM_ADMIN` bypass total |
| Multiempresa | Sim | `auth.clientId` = `organizationId`; `resolveClientId()` | P0→CORRIGIDO | IDOR templates APIGateway corrigido |
| WebChat | Sim | `WebChatService.ts`, `webchat-public.routes.ts`, `widget.js` | P2 | Origem + visitor token hash |
| WhatsApp | Sim | `WhatsAppService.ts`, Baileys 7 RC, `sessions/{clientId}/` | P1 | Lock Redis único por tenant |
| Inbox | Sim | `InboxService.ts`, tickets, CSAT, bridge | P1 | Fixes 2.8.7–2.11.x documentados |
| Contatos | Sim | `Destination` model, `/contact`, consentimento LGPD | P2 | Classificação Pacotes A–J |
| Leads | Sim | `LeadCapture`, `LeadForm`, `/api/leads/public` | P2 | Form key + fila |
| Catálogo | Sim | `AiKnowledgeBase`, produtos, `docs/PRODUTOS-CATALOGO.md` | P2 | Perfil comercial configurável |
| Pedidos | Sim | `CatalogSalesOrder`, `CatalogSalesService.ts` | P2 | Status ricos, auditoria |
| PIX/comprovantes | Sim | `catalog-sales-pix.ts`, fluxo em `CatalogSalesService` | P1→CORRIGIDO | TTL 72h em novos tokens |
| IA | Sim | `AiProviderService`, wallet, basic/premium modes | P1 | PII no prompt se `useSystemContext` |
| Billing | Sim | `BillingService.ts`, Stripe webhook, `config/plans.json` | P2 | Grace `past_due` documentado |
| Admin global | Sim | `/admin/*`, `Cap.DASHBOARD_GLOBAL`, `Admin Ops` | P1 | Cross-tenant intencional para staff |
| Upload/anexos | Sim | `webchat-attachment.util.ts`, `inbox-media-storage.ts`, `safe-image-upload.ts` | P2 | 5MB declarado, ~1MB JSON efetivo |
| Logs | Sim | Pino + `SystemLog` (TTL 30d), `mask-secret.util.ts` | P2 | Mascaramento de segredos |
| Auditoria | Sim | `AttendanceEvent` (TTL 90d), `AuditLog` (180d), `attendance-audit.service.ts` | P2 | Eventos ticket/bridge/billing |
| Testes | Sim | Jest ~200 suites, Playwright 17 specs `e2e/` | P2 | `cross-tenant-scope.integration.test.ts` |
| CI/CD | Sim | `.github/workflows/ci.yml`, `deploy.yml` | P2 | Node 24, audit high+ |
| Documentação | Sim | 65+ docs em `docs/`, `CHANGELOG.md`, `SISTEMA-REGISTRO.md` | P3 | Índice em `INDICE-DOCUMENTACAO.md` |
| Changelog/versionamento | Sim | Semver `2.17.61`, protocolo em `VERSIONAMENTO-E-DOCUMENTACAO.md` | P3 | Não incrementado nesta auditoria |

---

## 6. ETAPA 2 — Segurança de dados, LGPD, multiempresa, auth e RBAC

### 6.1 Dados pessoais e sensíveis

| Item | Status | Evidência | Risco | Correção feita? | Arquivos |
|------|--------|-----------|-------|-----------------|----------|
| Nome | OK | Armazenado em `Destination`, `User`, intake WebChat | P2 | Não | `models/Destination.ts`, `WebChatService.ts` |
| Telefone | OK | E.164 validado; mascaramento em logs | P2 | Não | `redact-sensitive.ts`, `catalog-sales.ts` |
| E-mail | OK | OTP verificação equipe; redact em OAuth logs | P2 | Não | `CompanyMember.ts` |
| Endereço | OK | Catálogo entrega; geocoding | P2 | Não | `catalog-delivery-address.ts` |
| Mensagens | OK | Inbox/WebChat/WA; sanitização widget | P2 | Não | `webchat-public.util.ts`, `widget.js` |
| Anexos | OK | Magic bytes, path traversal block | P2 | Não | `webchat-attachment.util.ts` |
| Imagens | OK | JPEG/PNG/WebP whitelist | P2 | Não | `safe-image-upload.ts` |
| Comprovantes PIX | CORRIGIDO | HMAC + TTL 72h novos links | P1→P2 | **Sim** | `CatalogSalesService.ts` |
| Dados de pedido | OK | `clientId` obrigatório em queries | P2 | Não | `getOrderForClient()` |
| Dados de pagamento | OK | Chave PIX em config org; sem cartão | P2 | Não | `catalog-sales-pix.ts` |
| Histórico atendimento | OK | `InboxMessage`, `AttendanceEvent` | P2 | Não | `InboxService.ts` |
| Dados enviados IA | PENDENTE | PII em prompt se contexto ativo | P1 | Não | `AiContextService.ts` |
| Logs dados privados | OK | `maskSecret`, `redactSensitiveMeta`, `sanitizeLogPayload` | P2 | Não | `mask-secret.util.ts` |
| Backups | OK | `SystemBackupSettings`, workflow Atlas | P2 | Não | `.github/workflows/vps-mongo-atlas-backup.yml` |
| Dados em cache | OK | Sessão Redis; dedup keys por tenant | P2 | Não | `RedisManager.ts` |

### 6.2 Isolamento multiempresa (20 áreas)

| Recurso | Filtro tenant | Evidência | Risco |
|---------|---------------|-----------|-------|
| Usuários | Sim | `User` global; acesso via `CompanyMember` | P2 |
| Equipe | Sim | `CompanyMember.organizationId` | P2 |
| Contatos | Sim | `Destination.clientId` | P2 |
| Leads | Sim | `LeadCapture.clientId` | P2 |
| Conversas | Sim | `InboxConversation.clientId` | P2 |
| Mensagens | Sim | via `conversationId` + assert org | P2 |
| WebChat | Sim | `WebChatConversation.clientId` | P2 |
| WA sessions | Sim | `sessions/{clientId}/`, lock Redis | P1 |
| Inbox | Sim | `assertInboxOrganizationMember` | P2 |
| Tickets | Sim | `{ clientId, ticketRef }` unique index | P2 |
| Catálogo | Sim | KB por org em `AiKnowledgeBase` | P2 |
| Produtos | Sim | Conteúdo KB vinculado à org | P2 |
| Pedidos | Sim | `getOrderForClient(clientId, id)` | P2 |
| PIX | Sim | Config em `Organization.catalogSales` | P2 |
| Comprovantes | Sim | Rota proof exige auth + `clientId` | P1 |
| Billing | Sim | `organizationId` em assinaturas | P2 |
| Config empresa | Sim | `Organization.findById(auth.clientId)` | P2 |
| Integrações | Sim | `ApiKey.organizationId` | P2 |
| IA | Sim | `AiSettings`, `AiUsage` por `clientId` | P2 |
| Logs/auditoria | Sim | `AttendanceEvent.clientId`; admin global separado | P1 |

### 6.3 Autenticação

| Item | Status | Evidência |
|------|--------|-----------|
| Login | OK | OAuth Google/Discord `/auth/*` |
| Logout | OK | `POST /auth/logout` destroy session |
| Refresh token | OK | JWT refresh no APIGateway legado; sessão painel via cookie |
| Expiração | OK | Sessão 7d; JWT `JWT_EXPIRES_IN` |
| Usuário desativado | OK | `buildAuthContext` valida membership ativo |
| Troca senha | N/A JUSTIFICADO | Auth OAuth primário; sem senha local |
| Reset senha | N/A JUSTIFICADO | OAuth-only para login principal |
| Convite equipe | OK | E-mail OTP + `TeamInvite` flow |
| Cookie/session | OK | `httpOnly`, `sameSite: lax`, `secure` em prod |
| Brute force | OK | `rateLimiters.auth`, OTP Redis |

### 6.4 RBAC

| Item | Status | Evidência |
|------|--------|-----------|
| Admin global | OK | `SystemRole.SYSTEM_ADMIN`, caps `SYSTEM_*` |
| Dono empresa | OK | `CompanyRole.OWNER`, `BILLING_MANAGE` |
| Supervisor | OK | `MANAGER` + caps inbox supervisor |
| Atendente | OK | `ATTENDANT`, escopo setor |
| Financeiro | OK | Preset custom / caps billing |
| Suporte | OK | Via papéis custom |
| Permissão por rota | OK | `ROUTE_PERMISSIONS` frontend + `requireCapability` backend |
| Permissão por ação | OK | `Cap.ORDERS_APPROVE_PAYMENT`, etc. |
| Permissão por empresa | OK | `auth.clientId` em services |
| Proteção backend | OK | Maioria das rotas `/api` |
| URL direta sem perm | OK | `ProtectedRoute` + 403 API |
| API manual sem perm | OK | `requireCapability` retorna 403 |

### 6.5 Falhas encontradas

| Falha encontrada | Severidade | Impacto | Correção | Teste | Pendente |
|------------------|------------|---------|----------|-------|----------|
| IDOR APIGateway templates (`:clientId` ≠ API key tenant) | P0 | Leitura/escrita templates de outro tenant | **CORRIGIDO** — `validateClientOwnership` em `templateRoutes.ts` | Build OK; sem teste dedicado | Teste integração APIGateway recomendado |
| Token comprovante PIX sem expiração | P1 | Link vazado válido indefinidamente | **CORRIGIDO** — TTL 72h + legado temporário | `catalog-proof-token.test.ts` 3/3 pass | Remover aceite legado após janela |
| PII enviada ao LLM | P1 | LGPD / vazamento para provedor | Não corrigido | N/A | Mascarar em `AiContextService` |
| `SYSTEM_ADMIN` bypass `can()` | P1 | Staff acessa tudo | Não corrigido (by design) | N/A | Política de concessão SYSTEM_ADMIN |
| `findById` sem `clientId` na query | P2 | Race/teórico IDOR se check falhar | Não corrigido | N/A | Refatorar para query atômica |
| `ALLOW_DEV_API_KEY_BYPASS` | P2 | Bypass em dev/staging | Não corrigido | Bloqueado em prod | Nunca em staging compartilhado |
| Socket.IO sem sessão em non-prod | P2 | Conexão painel aberta em dev | Não corrigido | N/A | Documentar risco staging |

---

## 7. ETAPA 3 — Segurança de API, Node/TypeScript, WebChat, WhatsApp, IA, PIX e uploads

| Fluxo | Status | Evidência | Falha | Severidade | Correção | Teste |
|-------|--------|-----------|-------|------------|----------|-------|
| Validação body | OK | Joi + `sanitizeInput` | Parcial em rotas legadas | P3 | Não | jest validation |
| Validação query/params | OK | ObjectId checks, parsers | Algumas rotas admin | P3 | Não | Manual |
| Rate limit | OK | `express-rate-limit`, tipos WA/WebChat | GET público sem limit | P3 | Não | `whatsapp-session-rate-limit` tests |
| Payload limit | OK | JSON 1MB `DashboardService` | WebChat 5MB vs 1MB | P3 | Não | N/A |
| CORS | PENDENTE | `security.ts` prod; WebChat `origin: true` | CORS aberto embed | P2 | Não | `same-origin.test.ts` pass |
| Headers segurança | OK | Helmet, CSP, HSTS | N/A | P3 | N/A | N/A |
| Erros produção | OK | `production-safe-error.ts` | N/A | P3 | N/A | N/A |
| Webhooks assinatura | OK | HMAC outbound `webhook-signature.ts` | Inbound só no consumidor | P2 | Não | `webhook-signature.test.ts` |
| Idempotência webhooks | OK | RadarGamer Redis key; Stripe event id | N/A | P3 | N/A | `radargamer-inbound.service.test.ts` |
| NoSQL injection | OK | `escapeMongoRegex`, Mongoose | N/A | P3 | N/A | N/A |
| SQL injection | N/A JUSTIFICADO | MongoDB only | N/A | N/A | N/A | N/A |
| Command injection | OK | `execFile` só dev lock; sem shell user input | N/A | P3 | N/A | N/A |
| Path traversal | OK | `resolveWebChatMediaPath`, `resolveInboxMediaPath` | N/A | P3 | N/A | `webchat-safe-url` tests |
| SSRF | OK | `safe-external-url.util.ts` | N/A | P3 | N/A | N/A |
| XSS mensagens | OK | `escHtml` widget; sanitize painel | innerHTML shell widget | P3 | Não | `webchat-visitor-message` tests |
| CSRF cookie | OK | `requireDashboardOrigin` prod | Off em non-prod | P2 | Não | `same-origin.test.ts` |
| Enumeração IDs | PENDENTE | ObjectIds Mongo; tokens públicos rate limited | Widget keys enumeráveis | P3 | Não | N/A |
| eval/Function | OK | Não encontrado uso perigoso | N/A | P3 | N/A | grep |
| child_process | OK | Só `dev-instance-lock.ts` `execFile` | N/A | P3 | N/A | N/A |
| FS inseguro | OK | Paths resolvidos com `clientId` | Disco sem encrypt | P3 | N/A | N/A |
| ReDoS | OK | Sem regex críticas identificadas | N/A | P3 | N/A | N/A |
| Dependências vulneráveis | OK | `npm audit --omit=dev --audit-level=high` → 0 | N/A | P3 | N/A | Executado 2026-07-01 |
| Secrets no código | OK | `.env` gitignored; defaults só dev | Defaults dev fracos | P2 | Não | `validateConfig()` prod |
| Graceful shutdown | OK | `GracefulShutdown.ts` 30s | N/A | P3 | N/A | Código revisado |
| WebChat token/origem | OK | `assertOrigin`, `wcv_*` hash, header prod | CORS aberto | P2 | Não | jest webchat-token |
| WebChat spam | OK | honeypot + rate limit sessão/envio | N/A | P3 | N/A | `webchat-public-abuse` |
| WA sessão isolada | OK | Map por `clientId`, lock Redis | Credenciais disco | P2 | N/A | `whatsapp-session.util.test.ts` |
| WA QR protegido | OK | POST only + capability | Staff cross-tenant | P2 | N/A | CSRF fix documentado |
| WA rate limit | OK | 2/10/min + jitter | N/A | P3 | N/A | jest |
| IA tenant/créditos | OK | `getUsageSnapshot` pré-call | PII no prompt | P1 | Não | `ai-wallet` tests |
| IA não aprova PIX | OK | `requireHumanApproval` default true | N/A | P3 | N/A | `catalog-sales.test.ts` |
| PIX comprovante | CORRIGIDO | Aprovação humana; token TTL | Legado sem exp | P1 | **Sim** | `catalog-proof-token.test.ts` |
| Uploads WebChat | OK | MIME + magic bytes | PDF sem scan JS | P2 | Não | attachment util |

---

## 8. ETAPA 4 — Estabilidade, banco, filas, observabilidade, testes e gates locais

### 8.1 Áreas de estabilidade

| Área | Status | Evidência | Risco | Correção | Pendente |
|------|--------|-----------|-------|----------|----------|
| Conexão Mongo | OK | `DatabaseManager`, retry 10× | SPOF | Não | Monitorar prod |
| Índices | OK | Schemas + sync pós-connect | Índices faltantes em coleções legadas | Não | Revisar slow queries |
| Queries sem tenant | PENDENTE | Admin global intencional; alguns `findById` | P2 | Não | Refatorar queries |
| Filas BullMQ | OK | 6 filas + watchdog 20s | Redis SPOF | N/A | Redis HA prod |
| Retry jobs | OK | 3 attempts, backoff exponencial | N/A | N/A | N/A |
| Dead-letter | PENDENTE | `removeOnFail: 50` | Jobs perdidos após 50 | P2 | Não | Bull Board admin |
| Idempotência | OK | Dedup 6h Discord; RadarGamer Redis | N/A | N/A | N/A |
| Healthcheck | OK | `GET /api/services/health` | Liveness mínimo | N/A | N/A |
| Graceful shutdown | OK | SIGTERM 30s, handlers paralelos | N/A | N/A | N/A |
| Request ID | OK | `securityMiddleware.requestId` | N/A | N/A | N/A |
| Logs estruturados | OK | Pino + `SystemLog` | N/A | N/A | N/A |
| Mascaramento | OK | `mask-secret.util.ts` | N/A | N/A | N/A |
| unhandledRejection | OK | Handlers em `index.ts` + `GracefulShutdown` | Log only | P3 | Não | N/A |

### 8.2 Comandos executados

| Comando | Resultado | Evidência | Falha | Corrigido? | Bloqueia produção? |
|---------|-----------|-----------|-------|------------|-------------------|
| `npm run qa:auditoria:quick` | **PASS** | `docs/qa-results/auditoria-geral-2026-07-01.json` | Nenhuma | N/A | Não |
| `npm run typecheck` | **PASS** | exit 0 | Nenhuma | N/A | Não |
| `npm audit --omit=dev --audit-level=high` | **PASS** | 0 vulnerabilities | Nenhuma | N/A | Não |
| `npm test -- catalog-proof-token` | **PASS** | 3/3 tests | Nenhuma | N/A | Não |
| `npm run qa:atendimento:gate` | NÃO EXECUTADO | Tempo | N/A | N/A | **Sim** (recomendado pré-main) |
| `npm run pre-push:gate` | NÃO EXECUTADO | Inclui Docker build | N/A | N/A | **Sim** (obrigatório pré-push main) |
| `npm run qa:fase1:e2e` | NÃO EXECUTADO | 6 specs Playwright | N/A | N/A | **Sim** (gate Fase 1) |
| `npm run lint` | NÃO EXECUTADO | Escopo parcial (3 arquivos) | N/A | N/A | Não |
| `npm run lint:all` | NÃO EXECUTADO | — | N/A | N/A | P3 |

---

## 9. ETAPA 5 — Correções finais, documentação, riscos e garantia

### 9.1 Correções realizadas

| # | Arquivo | Motivo | Impacto | Teste |
|---|---------|--------|---------|-------|
| 1 | `src/services/templates/templateRoutes.ts` | P0 IDOR: API key acessava templates de outro `:clientId` | Bloqueia cross-tenant no APIGateway `/api/v1/templates/client/*` | `npm run build` OK |
| 2 | `src/services/catalog/CatalogSalesService.ts` | P1: token comprovante sem expiração | Novos links expiram em 72h; legado aceito temporariamente | `catalog-proof-token.test.ts` 3/3 |
| 3 | `src/services/catalog/__tests__/catalog-proof-token.test.ts` | Cobertura da correção PIX | Regressão token | Jest pass |

### 9.2 Documentação/changelog

| Item | Status | Motivo |
|------|--------|--------|
| CHANGELOG | NÃO ATUALIZADO | Auditoria sem bump de versão solicitado; correções localizadas |
| SISTEMA-REGISTRO | NÃO ATUALIZADO | Mesmo motivo |
| Este arquivo único | **CRIADO** | Entrega obrigatória do ciclo 2.17.62 |

### 9.3 Critérios objetivos para liberar produção

1. `npm run qa:atendimento:gate` verde  
2. `npm run pre-push:gate` verde (inclui Docker frontend-builder)  
3. `npm run qa:fase1:all` ou `qa:release-gate` verde  
4. QA manual — [`RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](../RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) Parte H (detalhe: [`QA-AUDITORIA-GERAL-SISTEMA.md`](./QA-AUDITORIA-GERAL-SISTEMA.md))  
5. Gate estabilização Fase 1 em `docs/ROADMAP-COMPLETUDE.md` fechado  
6. P1 resolvidos ou aceitos com mitigação documentada (PII IA, token PIX legado, WA estabilidade)  
7. `PUBLIC_EMBED_ALLOW_OPEN_ORIGIN=false` e `allowedDomains` preenchidos por tenant em prod  
8. APIGateway porta 3000 não exposta publicamente sem mesmas proteções do monolith  

---

## 10. Arquivos analisados (amostra representativa)

`package.json`, `src/index.ts`, `src/config/environment.ts`, `src/database/DatabaseManager.ts`, `src/cache/RedisManager.ts`, `src/cache/QueueManager.ts`, `src/middleware/auth.ts`, `src/middleware/security.ts`, `src/middleware/same-origin.ts`, `src/middleware/rateLimiter.ts`, `src/middleware/production-safe-error.ts`, `src/auth/rbac/*`, `src/services/web-dashboard/DashboardService.ts`, `src/services/api-gateway/APIGateway.ts`, `src/services/templates/*`, `src/services/webchat/*`, `src/services/whatsapp/WhatsAppService.ts`, `src/services/inbox/InboxService.ts`, `src/services/catalog/CatalogSalesService.ts`, `src/services/ai/AiProviderService.ts`, `src/services/ai/AiContextService.ts`, `src/services/billing/BillingService.ts`, `src/services/integrations/WebhookDispatcherService.ts`, `src/utils/mask-secret.util.ts`, `src/utils/webhook-signature.ts`, `src/utils/GracefulShutdown.ts`, `docker/Dockerfile.monolith`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `scripts/qa-auditoria-geral.mjs`, `scripts/pre-push-deploy-gate.mjs`, `docs/ROADMAP-COMPLETUDE.md`, `docs/CONSENTIMENTO-LGPD.md`, `docs/WEBCHAT.md`, `docs/CATALOGO-PIX-PEDIDOS.md`, `e2e/cross-tenant-isolation.spec.ts`

---

## 11. Arquivos alterados

1. `src/services/templates/templateRoutes.ts`  
2. `src/services/catalog/CatalogSalesService.ts`  
3. `src/services/catalog/__tests__/catalog-proof-token.test.ts` (novo)  
4. `RADARCHAT-AUDITORIA-GERAL-SEGURANCA-DADOS-ESTABILIDADE-5-ETAPAS-2.17.62.md` (este arquivo)

---

## 12. Correções feitas

Ver seção 9.1.

---

## 13. Falhas encontradas e não corrigidas

| Falha | Severidade | Motivo não corrigido | Recomendação |
|-------|------------|---------------------|--------------|
| PII no prompt LLM | P1 | Escopo LGPD amplo; requer produto | Opção mascarar telefone/e-mail em `AiContextService` |
| Token PIX legado sem exp | P1 | Compatibilidade links em circulação | Remover após 72h + comunicar equipe |
| CORS `origin: true` WebChat | P2 | Quebra embed se restrito mal | Alinhar CORS com `assertOrigin` |
| PDF WebChat sem scan profundo | P2 | Complexidade | Reusar regras `safe-image-upload` |
| `findById` + check tardio painel | P2 | Refatoração ampla | Queries `{ _id, clientId }` |
| Estabilidade WA produção | P1 | Requer QA manual real | Executar `qa:atendimento:gate` + piloto |
| 33 itens QA manual | P1 | Automatização parcial | [`RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](../RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) |
| `getTenantFilter` dead code | P3 | Baixo impacto | Usar ou remover |
| Lint parcial | P3 | Escopo histórico | Expandir `lint:all` no CI |

---

## 14. Riscos por severidade

### P0 — Crítico

| Risco | Status |
|-------|--------|
| IDOR APIGateway templates | **CORRIGIDO** nesta auditoria |

### P1 — Alto

| Risco | Status |
|-------|--------|
| Estabilidade atendimento WhatsApp em produção | PENDENTE — gate Fase 1 |
| PII enviada a provedores LLM | PENDENTE |
| Token comprovante PIX legado válido indefinidamente | PARCIAL — novos com TTL 72h |
| `SYSTEM_ADMIN` bypass total | PENDENTE — by design, exige governança |
| Redis SPOF sem HA | PENDENTE — infra prod |

### P2 — Médio

CORS WebChat aberto; credenciais WA em disco; Socket.IO dev; staging com secrets default; admin cross-tenant se cap mal atribuída; PDF upload; webhook TLS não pinado.

### P3 — Baixo/Melhoria

Chunks frontend grandes; GET público sem rate limit; `innerHTML` widget shell; lint parcial.

---

## 15. Comandos executados

```
npm run qa:auditoria:quick
npm run typecheck
npm audit --omit=dev --audit-level=high
npm test -- --testPathPattern=catalog-proof-token --forceExit
```

---

## 16. Resultado dos testes/gates

| Gate | Resultado |
|------|-----------|
| Build backend + frontend (`qa:auditoria:quick`) | PASS |
| Jest webchat-security (20 tests) | PASS |
| Jest crm-completeness (6 tests) | PASS |
| Jest mask-secret (12 tests) | PASS |
| Jest catalog-proof-token (3 tests) | PASS |
| Typecheck | PASS |
| npm audit high+ | PASS (0 vulns) |
| qa:atendimento:gate | NÃO EXECUTADO |
| pre-push:gate (Docker) | NÃO EXECUTADO |
| E2E Playwright full | NÃO EXECUTADO |

---

## 17. Evidências importantes

- Sessão painel: cookie `radarchat.sid` + Redis (`DashboardService.ts` ~751)  
- RBAC: `requireCapability(Cap.*)` em rotas tenant  
- WebChat público montado **antes** de `loadAuthContext` com auth própria  
- Multi-tenant test: `src/services/__tests__/cross-tenant-scope.integration.test.ts`  
- Aprovação PIX humana: `requireHumanApproval: true` default (`catalog-sales.test.ts`)  
- Produção não alterada; sem deploy/push nesta sessão  

---

## 18. Itens marcados como NÃO ENCONTRADO

| Item | Evidência |
|------|-----------|
| `csurf` / CSRF token clássico | Substituído por `requireDashboardOrigin` |
| SQL / banco relacional | Stack é MongoDB only |
| Auto-aprovação PIX por OCR/IA | Fluxo exige conferência humana |
| `verifyWebhookSignature` em endpoint inbound | Só outbound + testes |
| Uso de `eval()` / `new Function()` | grep sem ocorrências perigosas |
| Teste dedicado `validateClientOwnership` em templates | NÃO ENCONTRADO — recomendado criar |

---

## 19. Itens marcados como N/A JUSTIFICADO

| Item | Justificativa |
|------|---------------|
| SQL injection | MongoDB/Mongoose, sem SQL |
| Reset/troca senha local | Login OAuth primário |
| Pentest externo | Fora do escopo local |
| Alteração produção VPS | Proibido nesta auditoria |

---

## 20. Impacto das alterações

- **Templates APIGateway:** integrações com API key só acessam templates do próprio `organizationId`; breaking change apenas para atacantes/abuso.  
- **Token PIX:** novas notificações geram links com validade 72h; links antigos (formato hex puro) continuam funcionando até remoção explícita do fallback legado.  
- **Compatibilidade:** WebChat, WhatsApp, Inbox, painel — sem alteração de contrato público.  

---

## 21. Compatibilidade com módulos

| Módulo | Status | Nota |
|--------|--------|------|
| WebChat | OK | Sem mudança de contrato widget |
| WhatsApp | OK | Sem mudança |
| Inbox | OK | Sem mudança |
| Leads | OK | Sem mudança |
| Contatos | OK | Sem mudança |
| Catálogo | OK | Sem mudança |
| PIX/pedidos | CORRIGIDO | TTL token novos links |
| IA | OK | Pendência PII separada |
| Billing | OK | Sem mudança |

---

## 22. Checklist final de segurança

| Item | Status |
|------|--------|
| Autenticação session + OAuth | OK |
| API key hash `rz_*` | OK |
| RBAC backend enforced | OK |
| CSRF same-origin prod | OK |
| Helmet + rate limit | OK |
| Mascaramento segredos logs | OK |
| Webhook HMAC outbound | OK |
| Cross-tenant templates API | CORRIGIDO |
| Proof token expiração | CORRIGIDO (parcial legado) |

---

## 23. Checklist final de estabilidade

| Item | Status |
|------|--------|
| Mongo connect + retry | OK |
| Redis obrigatório prod | OK |
| BullMQ retry/backoff | OK |
| Healthcheck Docker | OK |
| Graceful shutdown | OK |
| Dedup filas | OK |
| Gate build local | OK |
| Gate atendimento completo | PENDENTE |
| pre-push Docker gate | PENDENTE |

---

## 24. Checklist final de dados/LGPD

| Item | Status |
|------|--------|
| Consentimento outbound 1/2 | OK |
| 3 recusas definitivo | OK |
| Opt-out vs atendimento ativo | OK |
| TTL logs auditoria | OK |
| PII em prompts IA | PENDENTE |
| Portal LGPD E2E | NÃO EXECUTADO (e2e-lgpd gate) |

---

## 25. Checklist final de permissões/RBAC

| Item | Status |
|------|--------|
| Capabilities granulares | OK |
| Papéis custom org | OK |
| Frontend ProtectedRoute | OK |
| Backend requireCapability | OK |
| Switch org valida membership | OK |
| Admin cross-tenant intencional | OK (com risco se mal usado) |

---

## 26. Checklist final de produção

| Item | Status |
|------|--------|
| Versão 2.17.61 buildável | OK |
| npm audit runtime | OK |
| Roadmap Fase 1 gate | BLOQUEADO |
| QA manual 33 itens | PENDENTE |
| Deploy não executado | OK |
| Push não executado | OK |
| Produção não alterada | OK |

---

## 27. Próximos 5 passos recomendados

1. Executar `npm run qa:atendimento:gate` e `npm run pre-push:gate` localmente; corrigir falhas.  
2. Rodar `npm run qa:auditoria:gate` completo (inclui E2E cross-tenant, LGPD, inbox).  
3. Remover aceite de token PIX legado após janela de 72h e comunicar operação.  
4. Implementar mascaramento opcional de PII em `AiContextService` antes de chamadas LLM.  
5. Fechar checklist manual em [`RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md`](../RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md) e gate Fase 1 em `ROADMAP-COMPLETUDE.md`.

---

## 28. Conclusão final para o usuário enviar ao ChatGPT

O Radar Chat v2 **2.17.61** é um sistema **maduro em arquitetura multiempresa, RBAC, LGPD base, WebChat, Inbox, catálogo/PIX e IA com metering**, com **~200 suites Jest**, gates automatizados e CI Node 24. **Não está liberado para go-live pleno** porque o roadmap interno (Fase 1 — estabilização WA) e 33 itens de QA manual permanecem abertos.

Nesta auditoria **2.17.62** foram corrigidos com segurança: **(1) IDOR no APIGateway de templates** via `validateClientOwnership`; **(2) expiração de 72h em tokens de comprovante PIX** (com compatibilidade legado temporária). Gates executados: **build, typecheck, audit npm 0 vulns, jest segurança WebChat/mask-secret, teste novo proof token** — todos **verdes**.

**Pendências P1 principais:** estabilidade WA em uso real, PII em prompts IA, remoção token PIX legado, QA E2E/atendimento completo. **Produção, deploy e push não foram tocados.**

---

## Checklist final obrigatório

| Item | Status | Evidência | Observação |
|------|--------|-----------|------------|
| Multiempresa validado | OK | `cross-tenant-scope.integration.test.ts`, padrão `auth.clientId` | IDOR templates corrigido |
| RBAC validado | OK | `requireCapability`, `can.ts`, E2E admin mock | SYSTEM_ADMIN bypass by design |
| Auth validado | OK | Session Redis, OAuth, API key hash | Dev bypasses documentados |
| Dados sensíveis em logs checados | OK | `mask-secret.util.ts`, 12 jest pass | |
| Uploads checados | OK | `webchat-attachment.util.ts`, magic bytes | PDF scan superficial P2 |
| WebChat checado | OK | jest webchat-security 20 pass | CORS aberto P2 |
| WhatsApp checado | OK | lock, rate limit, QR POST-only | Estabilidade prod P1 |
| IA checada | PENDENTE | créditos OK; PII prompt P1 | Mascarar contexto |
| PIX/pedidos checados | CORRIGIDO | TTL 72h + teste 3/3 | Legado temporário |
| Webhooks checados | OK | HMAC outbound, Stripe sig | Inbound verify no consumidor |
| Rate limit checado | OK | `rateLimiter.ts`, WA/WebChat tipados | GET público sem limit P3 |
| Banco checado | OK | `DatabaseManager`, índices tenant | |
| Redis/fila/cache checado | OK | BullMQ 6 filas, dedup 6h | Redis SPOF prod |
| Healthcheck checado | OK | `/api/services/health`, Docker HC | |
| Graceful shutdown checado | OK | `GracefulShutdown.ts` 30s | |
| Testes executados | OK | quick gate + proof token + typecheck | Full gate pendente |
| Build executado | OK | `qa:auditoria:quick` build pass | |
| CI analisado | OK | `ci.yml` test+audit+build+e2e | |
| Documentação atualizada | N/A JUSTIFICADO | Só este arquivo por instrução | CHANGELOG não alterado |
| Changelog atualizado | NÃO ENCONTRADO | Sem bump versão nesta sessão | Correções localizadas |
| Produção não alterada | OK | Sem SSH/deploy | |
| Deploy não realizado | OK | Instrução explícita | |
| Push não realizado | OK | Instrução explícita | |

---

*Fim do relatório — RadarChat Auditoria 5 Etapas 2.17.62*
