# Billing Stripe — RadarZap v2

Assinaturas mensais por **organização** (empresa), padrão inspirado no radargamev4 (fetch + HMAC webhook, sem SDK Stripe).

## Planos

Catálogo em `config/plans.json`:

| ID | Nome | Preço | Comprável |
|----|------|-------|-----------|
| `free` | Free | — | default |
| `starter` | Starter | R$ 99/mês | sim |
| `pro` | Pro | R$ 299/mês | sim |
| `enterprise` | Enterprise | sob consulta | não (contato) |

Limites aplicados em `Organization.limits` ao ativar; expiração volta para `free`.

## Fluxo

1. **Checkout** — `POST /api/billing/checkout` `{ planId }` → redirect Stripe Checkout
2. **Webhook** — `POST /api/billing/webhook/stripe` (raw body) — eventos:
   - `checkout.session.completed` — ativa plano + `BillingOrder` paid
   - `invoice.paid` — renova `planExpiresAt`
   - `customer.subscription.deleted` — expira org
3. **Confirm** — redirect `?checkout=success&session_id=…` → `POST /api/billing/confirm` (fallback se webhook atrasar)
4. **Sweep** — timer + `POST /api/billing/subscriptions/sweep` — orgs com `planExpiresAt` vencido → `free`

## Variáveis de ambiente

```env
STRIPE_SECRET_KEY=rk_test_...   # ou sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
SUBSCRIPTION_SWEEP_MS=3600000
ALLOW_DEV_BILLING=true   # dev: POST /api/billing/dev/activate
```

Webhook URL em produção: `https://seu-dominio/api/billing/webhook/stripe`

## Chaves Stripe → RadarZap

Referência: [Stripe API keys](https://docs.stripe.com/keys). Checkout **hospedado** (redirect) — **não** usa `pk_test_` no frontend.

| O que é (Stripe) | Prefixo | `.env`? | Variável |
|------------------|---------|---------|----------|
| Restricted key (RAK) | `rk_test_` / `rk_live_` | ✅ | `STRIPE_SECRET_KEY` |
| Secret key | `sk_test_` / `sk_live_` | ✅ dev | `STRIPE_SECRET_KEY` |
| ID da chave (Dashboard) | `mk_…` | ❌ | — |
| Publishable key | `pk_…` | ❌ | não usado |
| Webhook signing secret | `whsec_…` | ✅ | `STRIPE_WEBHOOK_SECRET` |
| Price ID | `price_…` | ✅ | `STRIPE_PRICE_ID_*` |

**Chave `radarzap`:** token `rk_test_…` em `STRIPE_SECRET_KEY`. Edite permissões (Checkout Sessions Write, Customers Write, Subscriptions Read, Prices Read) — [Restricted keys](https://docs.stripe.com/keys/restricted-api-keys).

**Webhook:** API keys ≠ webhook secret. Dev: `npm run stripe:webhook` (Stripe CLI + atualiza `whsec_` no `.env`) ou `stripe listen --forward-to localhost:3001/api/billing/webhook/stripe`. Prod: [Webhooks](https://dashboard.stripe.com/webhooks).

**Live:** `rk_live_`/`sk_live_`, prices live, webhook live, `ALLOW_DEV_BILLING=false` — [go-live checklist](https://docs.stripe.com/get-started/checklist/go-live).

## UI

| Rota | Quem | Função |
|------|------|--------|
| `/plans` | tenant (`billing:view`) | catálogo, assinatura, checkout |
| `/admin/payments` | admin (`system:payments:view`) | pedidos, sweep manual |
| `/admin/plans` | admin | override manual de plano por usuário |

## Bloqueio por plano

- `Organization.canSendMessage()` — bloqueia envio se plano pago expirado
- Rate limit diário continua via `limits.messagesPerDay`

## Alertas no painel (2.11.28)

Referência completa: [`ENTREGA-ATENDIMENTO-2.11.24-28.md`](./concluidos/ENTREGA-ATENDIMENTO-2.11.24-28.md) §5.

Dono/admin com `billing:view` recebe no **sino vermelho** (urgente + som `urgent`):

| Evento | Quando | Dedup |
|--------|--------|-------|
| `billing:plan_expiring` | Plano pago expira em ≤7 dias (`scanSubscriptionExpiring`, ~60s) | 12h se ≤1d; 24h caso contrário |
| `billing:plan_expired` | Plano expirou (`subscription-expiry.service`) | 7 dias |
| `billing:messages_quota_exceeded` | `Organization.usage.messagesUsed >= limits.messagesPerDay` | 24h |

Alertas IA (mesma visibilidade):

| Evento | Quando |
|--------|--------|
| `ai:quota_exceeded` | `AiUsageMeterService` bloqueia chamada |
| `ai:quota_low` | ≥90% cota diária ou mensal |

Config incompleta (`system:critical_config`, dedup 3 dias):

- Fallback ativo sem telefones de alerta.
- IA modo empresa ativa sem API key.

Implementação: `PanelCriticalAlertsService` · tipos `src/types/panel-events.ts` · UI `EventNotificationBell`.

## Arquivos principais

- `src/services/billing/BillingService.ts`
- `src/services/billing/stripe-webhook.util.ts`
- `src/services/billing/subscription-expiry.service.ts`
- `src/models/BillingOrder.ts`
- `config/plans.json`
