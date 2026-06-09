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
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
SUBSCRIPTION_SWEEP_MS=3600000
ALLOW_DEV_BILLING=true   # dev: POST /api/billing/dev/activate
```

Webhook URL em produção: `https://seu-dominio/api/billing/webhook/stripe`

## UI

| Rota | Quem | Função |
|------|------|--------|
| `/plans` | tenant (`billing:view`) | catálogo, assinatura, checkout |
| `/admin/payments` | admin (`system:payments:view`) | pedidos, sweep manual |
| `/admin/plans` | admin | override manual de plano por usuário |

## Bloqueio por plano

- `Organization.canSendMessage()` — bloqueia envio se plano pago expirado
- Rate limit diário continua via `limits.messagesPerDay`

## Arquivos principais

- `src/services/billing/BillingService.ts`
- `src/services/billing/stripe-webhook.util.ts`
- `src/services/billing/subscription-expiry.service.ts`
- `src/models/BillingOrder.ts`
- `config/plans.json`
