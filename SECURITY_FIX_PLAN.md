# Plano de correção de segurança — RadarZap

Priorizado por impacto. Status: junho 2026.

---

## Fase 0 — Concluído (2026-06-09)

| # | Item | Sev. | Arquivos |
|---|------|------|----------|
| 0.1 | IDOR rules (PUT/toggle/DELETE) | CRÍTICO | `DashboardService.ts` |
| 0.2 | IDOR channels (DELETE/toggle) | CRÍTICO | `DashboardService.ts` |
| 0.3 | IDOR `/sessions/:id/groups` | CRÍTICO | `DashboardService.ts` |
| 0.4 | Socket QR leak cross-tenant | CRÍTICO | `DashboardService.ts` |
| 0.5 | Helmet + security headers painel | ALTO | `DashboardService.ts` |
| 0.6 | Rate limit `/auth` + `/api` | ALTO | `DashboardService.ts` |
| 0.7 | Remover broadcast stats global | ALTO | `DashboardService.ts` |
| 0.8 | API key bypass com flag explícita | ALTO | `middleware/auth.ts` |
| 0.9 | Ban `ALLOW_DEV_BILLING` em prod | ALTO | `environment.ts` |
| 0.10 | Webhook PATCH sem secret | MÉDIO | `DashboardService.ts` |
| 0.11 | Redação logs OAuth | MÉDIO | `redact-sensitive.ts` |
| 0.12 | `.gitignore` + `.env.example` | BAIXO | raiz |

**Testes após Fase 0:** `npm test`, `npm run build`

---

## Fase 1 — Concluído (2026-06-05)

| # | Item | Sev. | Status |
|---|------|------|--------|
| 1.1 | `GET /sessions/:id/connect` → 405 em prod; `POST` mantido | ALTO | ✅ |
| 1.2 | Docker monolito `USER radarzap` | ALTO | ✅ `docker/Dockerfile.monolith` |
| 1.3 | Redis `requirepass` em prod | ALTO | 📄 `docs/PRODUCTION.md` §8 |
| 1.4 | Escape `$regex` em `/api/logs` | MÉDIO | ✅ |
| 1.5 | Handler de erro genérico em prod | MÉDIO | ✅ `production-safe-error.ts` |
| 1.6 | `npm audit` runtime bloqueante no CI | MÉDIO | ✅ `--omit=dev` |
| 1.7 | gitleaks / secret scan no CI | MÉDIO | 📄 recomendado em §8 |

Extras Fase 1: `requireDashboardOrigin`, `field-encryption.ts`, testes `field-encryption.test.ts`.

---

## Fase 2 — Parcial (2026-06-05)

| # | Item | Sev. | Status |
|---|------|------|--------|
| 2.1 | Criptografar `WebhookEndpoint.secret` at-rest | MÉDIO | ✅ + `decryptField` no dispatcher |
| 2.2 | Backup export criptografado | ALTO | ✅ `BACKUP_ENCRYPT_EXPORT` (prod) |
| 2.3 | Auditoria export/import backup | MÉDIO | ✅ login/plano — pendente |
| 2.4 | CORS estrito em prod | MÉDIO | ✅ `middleware/security.ts` |
| 2.5 | Bind `3001` só localhost + nginx | MÉDIO | 📄 `docs/PRODUCTION.md` §8 |
| 2.6 | Testes RBAC/IDOR automatizados | MÉDIO | pendente |
| 2.7 | Upgrade `@typescript-eslint` (audit chain) | MÉDIO | pendente |

---

## Fase 3 — Evolução (trimestre)

| # | Item |
|---|------|
| 3.1 | 2FA para donos (Google Authenticator / WebAuthn) |
| 3.2 | Cloud API Meta com verify signature Meta |
| 3.3 | WAF / rate limit por org no edge |
| 3.4 | SBOM + Dependabot |
| 3.5 | Pentest externo antes de go-live enterprise |
| 3.6 | Política de retenção LGPD automatizada |

---

## Critérios de aceite por fase

- **Fase 1:** nenhum IDOR conhecido; connect WA não mutável via GET; containers non-root.
- **Fase 2:** secrets at-rest criptografados; backup com aviso + opção cripto.
- **Fase 3:** compliance documentada para clientes enterprise.
