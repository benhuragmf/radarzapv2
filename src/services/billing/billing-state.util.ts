import type { OrgPlanId } from './plan-config';
import {
  computeSubscriptionStatus,
  isPaidPlanActive,
  type SubscriptionStatus,
} from './subscription.util';

/** Status de produto (mapeamento documentado; Stripe pode usar nomes próprios). */
export type BillingProductStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'paused'
  | 'incomplete'
  | 'manual';

export const BILLING_GRACE_PERIOD_DAYS = 3;

export function normalizeBillingStatus(
  input: {
    plan: OrgPlanId;
    planExpiresAt?: Date | null;
    stripeSubscriptionStatus?: string | null;
  },
  now = new Date(),
): BillingProductStatus {
  if (input.plan === 'free') return 'free';

  const stripe = (input.stripeSubscriptionStatus ?? '').toLowerCase();
  if (stripe === 'past_due') return 'past_due';
  if (stripe === 'unpaid') return 'unpaid';
  if (stripe === 'canceled' || stripe === 'cancelled') return 'canceled';
  if (stripe === 'paused') return 'paused';
  if (stripe === 'incomplete' || stripe === 'incomplete_expired') return 'incomplete';
  if (stripe === 'trialing') return 'trialing';
  if (stripe === 'manual') {
    const local: SubscriptionStatus = computeSubscriptionStatus(
      input.plan,
      input.planExpiresAt,
      now,
    );
    if (local === 'expired') return 'canceled';
    return 'manual';
  }

  const local: SubscriptionStatus = computeSubscriptionStatus(
    input.plan,
    input.planExpiresAt,
    now,
  );
  if (local === 'expired') return 'canceled';
  return 'active';
}

export function isBillingActive(status: BillingProductStatus): boolean {
  return (
    status === 'active' ||
    status === 'trialing' ||
    status === 'manual' ||
    status === 'past_due'
  );
}

export function isBillingInGrace(
  status: BillingProductStatus,
  pastDueSince?: Date | null,
  now = new Date(),
): boolean {
  if (status !== 'past_due' || !pastDueSince) return false;
  const graceMs = BILLING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - pastDueSince.getTime() <= graceMs;
}

export function shouldBlockPaidFeatures(
  status: BillingProductStatus,
  opts?: { inGrace?: boolean },
): boolean {
  if (opts?.inGrace) return false;
  return status === 'unpaid' || status === 'canceled' || status === 'incomplete';
}

export function buildBillingBlockReason(status: BillingProductStatus): string {
  switch (status) {
    case 'past_due':
      return 'Pagamento pendente. Regularize em Planos e cobrança para evitar bloqueio.';
    case 'unpaid':
      return 'Assinatura inadimplente. Acesse Planos para regularizar o pagamento.';
    case 'canceled':
      return 'Assinatura cancelada ou expirada. Faça upgrade para liberar recursos pagos.';
    case 'incomplete':
      return 'Checkout incompleto. Conclua o pagamento em Planos.';
    default:
      return 'Recurso indisponível no plano atual.';
  }
}

export function isPaidPlanCurrentlyActive(
  plan: OrgPlanId,
  expiresAt?: Date | null,
): boolean {
  if (plan === 'free') return false;
  return isPaidPlanActive(plan, expiresAt);
}

export function isStripeWebhookEventProcessed(
  processedIds: Set<string> | string[],
  eventId: string,
): boolean {
  const set = processedIds instanceof Set ? processedIds : new Set(processedIds);
  return set.has(eventId.trim());
}
