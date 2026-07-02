# Auditoria de segurança — Radar Chat v2.5.1

**Data:** 2026-06-09  
**Tipo:** Revisão defensiva estática + `npm audit` (sem ataques reais)  
**Escopo:** Repositório completo

---

## 1. Visão geral do sistema

### Stack

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js 24 LTS, TypeScript, Express |
| Frontend | React 19, Vite, Tailwind 4 |
| Banco | MongoDB (Mongoose) |
| Cache/filas | Redis, BullMQ |
| WhatsApp | Baileys (`@whiskeysockets/baileys`) |
| Discord | discord.js v14 |
| Pagamentos | Stripe (checkout + webhooks) |
| Sessão | `express-session` + Redis (`radarchat.sid`, HttpOnly) |
| Tempo real | Socket.IO |
| Deploy | Docker monolito, GitHub Actions → GHCR |

### Fluxo resumido

1. Usuário autentica via **Google** (dono) ou **Discord** (equipe) → cookie de sessão.
2. `loadAuthContext` resolve organização (tenant) e **capabilities** RBAC.
3. Operações passam por `DashboardService` (`:3001`) com filtro `clientId` / `organizationId`.
4. Envios Discord→WA: captura → `RulesEngine` → fila → `WhatsAppService`.
5. Integrações externas: `X-API-Key` (hash SHA-256) no `APIGateway` legado (`:8080`).
6. Webhooks outbound: HMAC `X-Radar Chat-Signature` via fila `notifications`.

### Pontos críticos de segurança

- **Multi-tenant:** isolamento por `clientId` / `organizationId` — falhas = IDOR.
- **Sessões WA:** credenciais Baileys em `./sessions/` + Mongo criptografado.
- **Socket.IO:** eventos de QR/conexão — risco de vazamento cross-tenant.
- **Stripe webhook:** body raw + HMAC — rota sensível.
- **Backup JSON:** exporta PII do tenant.

---

## 2. OWASP — achados

| ID | Categoria OWASP | Severidade | Status |
|----|-----------------|------------|--------|
| A01 | Broken Access Control | **CRÍTICO** | Parcialmente corrigido (rules, channels, groups, socket) |
| A01 | BOLA / IDOR | **CRÍTICO** | Ver §13 — correções aplicadas em 2026-06-09 |
| A02 | Cryptographic failures | MÉDIO | Webhook secrets plain text no Mongo |
| A03 | Injection | MÉDIO | `$regex` em `/api/logs` sem escape |
| A04 | Insecure design | MÉDIO | Stats globais via socket (removido broadcast) |
| A05 | Security misconfiguration | ALTO | Painel sem helmet/rate-limit (corrigido) |
| A07 | Auth failures | MÉDIO | API key bypass dev (restrito a flag explícita) |
| A08 | Software integrity | MÉDIO | `npm audit` high em devDependencies ESLint chain |
| A09 | Logging failures | MÉDIO | OAuth errors logavam tokens (redigido) |
| A10 | SSRF | BAIXO | Fetch só para OAuth/APIs conhecidas |

**Não encontrado:** SQL injection (NoSQL only), `dangerouslySetInnerHTML` no frontend, secrets commitados no repo.

---

## 3. Proteção contra invasão

### Login e sessão

| Controle | Estado |
|----------|--------|
| OAuth state (CSRF login) | ✅ Discord + Google |
| Cookie HttpOnly | ✅ |
| Cookie Secure em prod | ✅ validado em `validateConfig` |
| SameSite | `lax` — mitiga parcial CSRF POST |
| 2FA | ❌ não implementado |
| Rate limit `/auth` | ✅ aplicado (2026-06-09) |
| Brute force | Parcial — rate limit 10/15min em `/auth` |

### RBAC

- Capabilities granulares (`src/auth/rbac/capabilities.ts`).
- Staff interno via `RADARCHAT_SYSTEM_ADMIN_DISCORD_IDS`.
- **Risco:** UI esconde menus; backend é autoridade — correto, mas rotas novas devem sempre usar `requireCapability`.

### Achados

| Sev. | Título | Local | Risco | Correção |
|------|--------|-------|-------|----------|
| ALTO | GET `/sessions/:id/connect` mutável via CSRF | `DashboardService.ts` | Link externo pode iniciar conexão WA | Mudar para POST + token |
| MÉDIO | Sem CSRF token em mutações POST | Painel cookie-based | SameSite=Lax mitiga | Origin check ou double-submit |
| MÉDIO | Socket dev aceita anônimo | `DashboardService.ts` | Apenas dev | Manter bloqueio em prod ✅ |

---

## 4. Proteção contra vazamento de dados

| Sev. | Título | Local | Risco | Correção |
|------|--------|-------|-------|----------|
| **CRÍTICO** | QR Code WA via `io.emit` global | `DashboardService.ts` | Tenant A via QR de tenant B | ✅ `io.to('tenant:…')` |
| **ALTO** | Stats globais via socket | `DashboardService.ts` | Contagem de orgs/API keys vazava | ✅ broadcast removido |
| **ALTO** | Backup JSON com PII completo | `TenantBackupService.ts` | Arquivo em disco do usuário | Criptografar export; aviso UI |
| MÉDIO | `WebhookEndpoint.secret` plain text | Mongo | Acesso ao DB expõe secrets | Criptografar at-rest |
| MÉDIO | PATCH webhook retornava `secret` | `DashboardService.ts` | ✅ corrigido |
| MÉDIO | Logs OAuth | `DashboardService.ts` | ✅ redação aplicada |
| BAIXO | Capabilities no `/auth/me` | API | Disclosure de nomes | Aceitável |

**Frontend:** sem tokens em `localStorage` — apenas guild/emoji prefs.

---

## 5. Proteção contra cópia do sistema

| Medida | Estado |
|--------|--------|
| Regras críticas no backend | ✅ |
| Secrets no frontend | ✅ ausentes (só `VITE_DISCORD_CLIENT_ID` público) |
| Validação de plano server-side | ✅ `BillingService`, limits |
| Licenciamento por domínio | ❌ não implementado |
| API rate limit por plano | Parcial (`/integrations/rate-limit`) |
| Obfuscação | ❌ não recomendado como proteção principal |

**Recomendações:** contrato de licença (já em LICENSE.md), telemetria opcional de instalação, watermark em builds enterprise — ver [`../security/SECURITY_RECOMMENDATIONS.md`](../security/SECURITY_RECOMMENDATIONS.md).

---

## 6. Banco de dados

| Modelo | Tenant field | Sensível |
|--------|--------------|----------|
| Destination | `clientId` | telefone, email, notas |
| Organization | — | taxId, plano |
| WebhookEndpoint | `organizationId` | `secret` plain |
| ApiKey | `organizationId` | `keyHash` ✅ |
| WhatsAppSession | `clientId` | `sessionData` AES ✅ |

**Riscos:** nomenclatura mista `clientId` vs `organizationId`; `AuditLog` sem `organizationId`; queries staff com filtro `{}`.

---

## 7. API e backend

- **~200 rotas** em `DashboardService.ts` — maioria com `requireCapability`.
- **Públicas:** `/auth/*`, webhooks Stripe/Cloud stub, static SPA.
- **Validação:** Joi/limits em campanhas; CSV import com dry-run; imagens com magic bytes.
- **Gaps corrigidos:** rules/channels/groups IDOR; helmet + rate limit no painel.
- **Gaps pendentes:** erro genérico em prod; escape `$regex` em logs; POST connect session.

---

## 8. Frontend

| Item | Estado |
|------|--------|
| `ProtectedRoute` | UX only — backend obrigatório |
| XSS | Baixo — React escape |
| Plano só no frontend | Não — backend valida capabilities/plano |
| PWA / touch | Sem impacto direto em segurança |

---

## 9. Dependências (supply chain)

`npm audit` (jun/2026): vulnerabilidades **high** principalmente em cadeia **@typescript-eslint** → `minimatch` (devDependencies).  
Runtime prod: Express 4.x, Baileys RC — monitorar advisories.

**CI:** `npm audit --audit-level=high` adicionado (não bloqueia ainda — `|| true`).

**Sugestões:** Dependabot, `osv-scanner`, gitleaks no CI, SBOM.

---

## 10. Infraestrutura e deploy

| Item | Sev. | Nota |
|------|------|------|
| Monolito Docker como root | ALTO | Adicionar `USER nodejs` |
| Redis sem senha (compose prod) | ALTO | `requirepass` |
| Mongo/Redis expostos (dev compose) | MÉDIO | Só local |
| `.env` no gitignore | ✅ | |
| `sessions/` no gitignore | ✅ | + `**/creds.json` |
| Deploy secrets via GH Environments | ✅ | |
| health-monitor + docker.sock | ALTO | Não usar em prod |

---

## 11. Monitoramento e auditoria

**Existente:** `AuditLog`, `SystemLog`, alertas Slack WA, webhook delivery status.

**Faltando:** log de login, export de dados, alteração de plano, detecção de brute force centralizada, SIEM.

---

## 12. LGPD

**Existente:** `ConsentService`, status de consentimento, renovação, doc `CONSENTIMENTO-LGPD.md`.

**Gaps:** política de retenção formal; criptografia de backup; DPO/processo de exclusão documentado para clientes enterprise.

---

## 13. Correções aplicadas nesta auditoria (2026-06-09)

| Sev. | Correção |
|------|----------|
| CRÍTICO | IDOR rules/channels — filtro `clientId` |
| CRÍTICO | `/sessions/:id/groups` — `requireSelfOrStaff` + capability |
| CRÍTICO | Socket `session:update` — room `tenant:{clientId}` |
| ALTO | Helmet + security headers no `DashboardService` |
| ALTO | Rate limit `/auth` e `/api` |
| ALTO | Removido broadcast global `stats` via socket |
| MÉDIO | API key bypass exige `ALLOW_DEV_API_KEY_BYPASS=true` |
| MÉDIO | `ALLOW_DEV_BILLING` bloqueado em prod no `validateConfig` |
| MÉDIO | Webhook PATCH não retorna `secret` |
| MÉDIO | Logs OAuth redigidos |
| BAIXO | `.gitignore` reforçado; `.env.example` comentários |

---

## 14. Itens NÃO corrigidos (requer revisão)

| Sev. | Item | Motivo |
|------|------|--------|
| CRÍTICO | Cloud API Meta completa | Roadmap — stub apenas |
| ALTO | Docker monolito non-root | Mudança de deploy |
| ALTO | Redis auth em prod | Breaking change compose |
| ALTO | GET `/sessions/:id/connect` → POST | Breaking API |
| MÉDIO | Criptografar webhook secrets | Migração Mongo |
| MÉDIO | Erros genéricos em prod | Refactor handlers |
| MÉDIO | Backup JSON criptografado | Feature nova |

---

*Próximo passo: [SECURITY_FIX_PLAN.md](../security/SECURITY_FIX_PLAN.md)*
