# Radar Chat — TOP 17/20 — Billing, Assinaturas, Limites e Bloqueios

**Versão:** `2.12.3` · **Data:** 2026-06-24 · **Commit base:** `943d966` (TOP 16)

---

## Resumo executivo

O TOP 17 consolida o módulo de **billing comercial**: diagnóstico do Stripe/checkout existente, checkout de **pacotes IA Créditos**, helpers de estado de assinatura, grace period documentado, enforcement backend de limites prioritários (widgets, leads, contatos, tickets) e documentação mestre atualizada.

**Não** declara produção pronta. **Não** implementa gateway brasileiro (PIX/boleto). Stripe permanece em **modo teste** quando `STRIPE_SECRET_KEY=sk_test_…`.

---

## Herança dos TOPs anteriores

| TOP | Herança relevante para billing |
|-----|-------------------------------|
| **03** | Matriz `config/plans.json`: Trial/Free/Starter R$99/Pro R$299/Enterprise; limites comerciais; extra user R$29 |
| **04** | RBAC: `BILLING_MANAGE`; Owner/Admin/Financeiro; cross-tenant bloqueado |
| **09–10** | `leadForms` enforced; `leadsPerMonth`/`contacts` pendentes → TOP 17 aplica |
| **11** | `webchatWidgets` pendente → TOP 17 aplica em `WebChatService.createWidget` |
| **12** | `messagesPerDay` via `Organization.canSendMessage`; `whatsappDestinations` documentado pendente |
| **16** | Pacotes IA (`pack_1k`/`pack_5k`/`pack_15k`); carteira; sem checkout → TOP 17 conecta Stripe |

**TOP 17 fecha:** billing documentado, checkout pacotes IA, limites backend seguros, status/grace, testes helpers.

**TOP 17 não faz:** gateway BR real, trial runtime completo na org, enforcement arriscado de `conversationsPerMonth`/`messagesPerDay` em todos os caminhos, auditoria billing completa (→ TOP 18).

---

## Estado Git inicial

| Item | Valor |
|------|-------|
| Branch | `main` |
| Último commit antes | `943d966` — `chore(top): ia creditos carteira e fallback 2.12.2` |
| Working tree | Limpo (untracked: `data/`, `mocker/modelochat/` — não commitados) |

---

## Escopo autorizado

Billing, Stripe test, checkout assinatura/pacotes IA, webhooks, limites, bloqueios, painel/API, testes, documentação. Sem segredos no repositório.

---

## Diagnóstico atual de billing

| Item | Existe? | Arquivo | Observação |
|------|---------|---------|------------|
| Serviço billing | Sim | `src/services/billing/BillingService.ts` | Checkout assinatura, webhooks, dev activate |
| Stripe | Sim | `src/config/billing-env.ts` | `sk_test_` / `sk_live_`; boot log sem segredo |
| Checkout assinatura | Sim | `BillingService.createCheckout` | Requer `STRIPE_PRICE_ID_*` |
| Checkout pacote IA | **TOP 17** | `BillingService.createAiCreditPackCheckout` | `mode=payment` + `price_data` |
| Webhook | Sim | `DashboardService` + `stripe-webhook.util.ts` | HMAC; idempotência parcial |
| Customer | Parcial | Stripe Checkout | Sem Customer Portal dedicado |
| Subscription | Sim | `Organization.stripeSubscriptionId` | Renovação `invoice.paid` |
| Invoice | Parcial | Webhook `invoice.paid` / `payment_failed` | Sem UI faturas |
| Status assinatura | Parcial | `subscription.util` + `billing-state.util` | `past_due` via Stripe espelho |
| Trial | Catálogo | `config/plans.json` | 7 dias; não persistido em `Organization.plan` |
| Upgrade/downgrade | Parcial | `activatePlan`, expiry sweep | Downgrade → `free` sem apagar dados |
| Cancelamento | Sim | `customer.subscription.deleted` | Expira org |
| Inadimplência | Parcial | `invoice.payment_failed` | `stripeSubscriptionStatus=past_due` |
| Bloqueio | Parcial | Limites + `shouldBlockPaidFeatures` | Grace 3 dias documentado |
| Limites por plano | Parcial | `plan-limit.util` + enforcement | Ver tabela abaixo |
| Painel | Sim | `/plans`, APIs `/billing/*` | RBAC `BILLING_MANAGE` |
| API | Sim | `DashboardService.ts` | Cross-tenant bloqueado |
| Testes | Sim | `billing-state`, `plan-limit`, gate | 759 testes verdes |

---

## Diagnóstico de planos e preços

| Plano | Preço catálogo | Stripe Price ID | Status | Observação |
|-------|----------------|-----------------|--------|------------|
| Trial | R$0 (7 dias) | — | Catálogo | Não comprável; 100 créditos IA |
| Free | R$0 | — | Default org | Limites mínimos |
| Starter | R$99 (`9900`) | `CONFIG_MISSING` ou env `STRIPE_PRICE_ID_STARTER` | Comprável | |
| Pro | R$299 (`29900`) | `CONFIG_MISSING` ou env `STRIPE_PRICE_ID_PRO` | Comprável | |
| Enterprise | Consultar | — | Manual | `purchasable: false` |
| Extra user | R$29/mês | — | Documentado | `extraUserPriceCentsMonthly: 2900` |

---

## Diagnóstico de Stripe e checkout

- **Modo:** `stripeModeLabel()` → `off` | `test` | `live` conforme key.
- **Assinatura:** `mode=subscription` + price ID do env.
- **Pacotes IA:** `mode=payment` + `price_data` inline (não exige Price ID no catálogo).
- **Sem key:** retorno `mode: manual` + `BillingOrder` pendente (sem creditar).
- **Success/cancel:** `/plans` (assinatura) e `/platform/ai` (pacotes).
- **Metadata:** `organizationId`, `userId`, `orderKind`, `creditPackId`, `credits`.
- **Estado validação real:** `OK_TEST` quando key test + webhook local; não `OK_REAL`.

---

## Diagnóstico de webhooks

| Evento | Assinatura | Idempotência | Efeito |
|--------|------------|--------------|--------|
| `checkout.session.completed` | HMAC | Order `paid` + plano ativo | Assinatura ou pacote IA |
| `checkout.session.expired` | HMAC | Cancela order pendente | — |
| `invoice.paid` | HMAC | Renova `planExpiresAt` | Limpa `past_due` |
| `invoice.payment_failed` | HMAC | — | `past_due` + `stripePastDueAt` |
| `customer.subscription.deleted` | HMAC | — | Downgrade/expira |
| `payment_intent.*` | — | Não tratado | Pendente |

Pacote IA: crédito **somente** após `payment_status=paid`; order `paid` impede duplicação.

---

## Diagnóstico de trial

| Item | Estado |
|------|--------|
| Duração | 7 dias no catálogo |
| Cartão obrigatório | **Pendente Benhur** |
| Expiração runtime | Não aplicada em `Organization.plan` |
| Créditos IA | 100 no catálogo `trial` |
| Avisos pré-expiração | Não implementados |

---

## Diagnóstico de assinaturas e status

| Status produto | Status código/Stripe | Ação no sistema |
|----------------|----------------------|-----------------|
| `free` | `plan=free` | Limites Free |
| `trialing` | Stripe `trialing` | Liberado (quando existir) |
| `active` | Plano pago + `planExpiresAt` futuro | Recursos do plano |
| `past_due` | `stripeSubscriptionStatus=past_due` | Grace 3 dias |
| `unpaid` | Stripe `unpaid` | `shouldBlockPaidFeatures` |
| `canceled` | Expirado / deleted | Downgrade `free`; dados preservados |
| `incomplete` | Checkout incompleto | Não libera pago |
| `manual` | Enterprise | Ajuste manual |

---

## Diagnóstico de upgrade e downgrade

- **Upgrade:** `createCheckout` → webhook/confirm → `upgradePlan` + 30 dias.
- **Downgrade:** `SubscriptionExpiryService` → `free`; recursos existentes mantidos; novas criações bloqueadas por limite.
- **Excedentes:** não apagados; bloqueio só em novas ações.

---

## Diagnóstico de inadimplência e grace period

- `invoice.payment_failed` → `past_due` + `stripePastDueAt`.
- Grace: **3 dias** (`BILLING_GRACE_PERIOD_DAYS`) — `isBillingInGrace`.
- Após grace: `shouldBlockPaidFeatures` (recursos pagos novos).
- Login, billing e leitura preservados.

---

## Diagnóstico de limites por plano

| Limite | Implementado? | Onde | Ação TOP 17 |
|--------|---------------|------|-------------|
| `includedUsers/Agents/Supervisors` | Sim | `team-plan-limits.ts` | Revisado (TOP 04) |
| `webchatWidgets` | **Sim** | `plan-limit-enforcement` + `WebChatService` | Novo |
| `leadForms` | Sim | `lead-form-plan-limit.util` | Revisado |
| `contacts` | **Sim** | Import CSV + enforcement | Novo |
| `leadsPerMonth` | **Sim** | `LeadFormService.tryCreateInboundLead` | Novo |
| `ticketsPerMonth` | **Sim** | `InboxService.ensureTicketRecord` | Novo |
| `aiCreditsMonthly` | Sim | TOP 16 `AiWalletService` | Preservado |
| `messagesPerDay` | Parcial | `Organization.canSendMessage` | Documentado |
| `whatsappDestinations` | Parcial | — | Pendente controlado |
| `templatesMax` | Parcial | `Organization.limits` | Herda User presets |
| `conversationsPerMonth` | Não | — | Pendente |
| `departments` | Não | — | Pendente |
| `monthlyLearningOps` | Sim | `AiWalletService` | TOP 16 |

---

## Diagnóstico de pacotes IA Créditos

| Pacote | Créditos | Preço | Checkout |
|--------|----------|-------|----------|
| `pack_1k` | 1000 | R$29 | Stripe quando key configurada |
| `pack_5k` | 5000 | R$99 | Idem |
| `pack_15k` | 15000 | R$249 | Idem |

- API: `GET /platform/ai/credit-packages` → `checkoutEnabled` dinâmico.
- API: `POST /billing/checkout/ai-credits` (`BILLING_MANAGE`).
- Manual: `POST /platform/ai/wallet/purchased` preservado (admin).

---

## Diagnóstico de painel e APIs

| Rota | Cap | Backend valida |
|------|-----|----------------|
| `GET /billing/pricing` | Auth | Sim |
| `POST /billing/checkout` | `BILLING_MANAGE` | Sim |
| `POST /billing/checkout/ai-credits` | `BILLING_MANAGE` | Sim |
| `POST /billing/confirm` | `BILLING_MANAGE` | Org match |
| `GET /billing/subscription` | Auth | Org scope |
| `POST /api/billing/webhook/stripe` | HMAC | Sem sessão |

---

## Diagnóstico de RBAC e cross-tenant

- Billing: `Cap.BILLING_MANAGE` (Owner/Admin/Financeiro conforme preset).
- Atendente: sem gerenciar billing.
- `organizationId` validado em confirm/checkout.

---

## Regras oficiais de billing

1. Toda regra de plano/limite/bloqueio no **backend**.
2. Frontend pode ocultar UI; API rejeita.
3. Sem segredos em logs/commits.
4. Não marcar produção pronta nesta etapa.

## Regras oficiais de trial

7 dias, 100 créditos IA, limites Trial no catálogo. Runtime trial na org → decisão Benhur.

## Regras oficiais de assinatura

Status mapeados em `billing-state.util.ts`. `active`/`trialing` liberam; `past_due` grace; `unpaid` bloqueia novos recursos pagos.

## Regras oficiais de upgrade e downgrade

Upgrade imediato; downgrade preserva dados; bloqueia novas criações acima do limite.

## Regras oficiais de inadimplência e bloqueio

Grace 3 dias em `past_due`. Mantém login, billing, leitura, conversas ativas.

## Regras oficiais de limites por plano

`resolvePlanLimit` + `checkPlanResourceLimit` + `plan-limit-enforcement.ts`.

## Regras oficiais de pacotes IA Créditos

Crédito só após pagamento confirmado; idempotência via `BillingOrder` `paid`.

---

## Eventos, logs e rastreabilidade

Sugeridos para TOP 18: `billing.checkout.completed`, `billing.ai_credit_pack.purchased`, `billing.limit.blocked`.

Hoje: logs `BillingService` sem payload sensível; `ai.credits.adjusted` na carteira.

---

## Atualização da documentação mestre

`docs/RADARCHAT-SISTEMA-COMPLETO.md` §20, `CHANGELOG.md`, `INDICE-DOCUMENTACAO.md`, `SISTEMA-REGISTRO.md`, `IA-CREDITOS-E-CARTEIRA.md`, `radarchat-v2-system-registry.mdc`.

---

## Correções ou ajustes aplicados

- `billing-state.util.ts` — status, grace, bloqueio.
- `plan-limit.util.ts` + `plan-limit-enforcement.ts`.
- `BillingOrder` — `orderKind`, `creditPackId`, `stripeEventId`.
- `BillingService` — checkout pacotes IA, `invoice.payment_failed`.
- `Organization` — `stripeSubscriptionStatus`, `stripePastDueAt`.
- Enforcement: WebChat widget, leads, contatos CSV, tickets.
- APIs: `/billing/checkout/ai-credits`, `checkoutEnabled` dinâmico.
- Testes lead: mock `plan-limit-enforcement`.

---

## Testes criados ou atualizados

- `billing-state.util.test.ts`
- `plan-limit.util.test.ts`
- Mocks em `lead-*-inbound.test.ts`, `lead-commercial-intent-capture.test.ts`
- Gate: padrão `billing-state|plan-limit`

---

## Gates executados

```bash
npm run typecheck   # verde
npm run build       # verde
npm test            # 759 passed
npm run qa:atendimento:gate  # verde (+ qa:webchat-wa)
```

Frontend build: **não alterado** nesta etapa.

---

## Arquivos alterados

- `src/services/billing/*` (helpers, BillingService, testes)
- `src/models/BillingOrder.ts`, `Organization.ts`
- `src/services/webchat/WebChatService.ts`
- `src/services/leads/LeadFormService.ts`
- `src/services/destinations/contactCsvImportService.ts`
- `src/services/inbox/InboxService.ts`
- `src/services/web-dashboard/DashboardService.ts`
- `src/types/ai-credit-packages.util.ts`
- `package.json`, docs oficiais

---

## Riscos reduzidos

- Pacotes IA sem pagamento não creditam.
- Limites comerciais em caminhos de alta prioridade no backend.
- Webhook HMAC mantido; duplicação de crédito mitigada.

---

## Riscos restantes

- Trial runtime não aplicado na org.
- `whatsappDestinations`, `conversationsPerMonth` sem enforcement total.
- Customer Portal / faturas UI ausentes.
- Gateway brasileiro não implementado.
- Auditoria billing completa → TOP 18.

---

## Decisões pendentes para Benhur

1. Trial exige cartão?
2. Comportamento pós-trial (Free vs bloqueio).
3. Quando ativar Stripe live e Price IDs produção.

---

## Próximo passo recomendado

**TOP 18** — Auditoria, logs estruturados `billing.*`, segurança transversal, LGPD export, hardening webhooks.
