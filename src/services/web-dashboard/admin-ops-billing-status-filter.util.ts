import type { AdminOpsOrgBillingStatus } from '@/types/admin-ops-organizations';
import type { OrgPlanId } from '@/services/billing/plan-config';

const PAID_PLANS: OrgPlanId[] = ['starter', 'pro', 'enterprise'];

const STRIPE_CANCELED_REGEX = /^cancel(l)?ed$/i;

const STRIPE_OVERRIDE_REGEX =
  /^(past_due|unpaid|cancel(?:l)?ed|paused|incomplete(_expired)?|trialing|manual)$/i;

/** Expiração local — `manual` expirado vira `canceled`, não fica bloqueado aqui. */
const STRIPE_EXPIRY_BLOCK_REGEX =
  /^(past_due|unpaid|cancel(?:l)?ed|paused|incomplete(_expired)?|trialing)$/i;

function paidPlanClause(): Record<string, unknown> {
  return { plan: { $in: PAID_PLANS } };
}

/** Stripe não define status de produto — cai no cálculo local (expiração). */
function stripeNotOverriddenClause(expiryPath = false): Record<string, unknown> {
  const blockRegex = expiryPath ? STRIPE_EXPIRY_BLOCK_REGEX : STRIPE_OVERRIDE_REGEX;
  return {
    $or: [
      { stripeSubscriptionStatus: { $exists: false } },
      { stripeSubscriptionStatus: null },
      { stripeSubscriptionStatus: '' },
      {
        stripeSubscriptionStatus: {
          $not: { $regex: blockRegex },
        },
      },
    ],
  };
}

function planNotExpiredClause(now: Date): Record<string, unknown> {
  return {
    $or: [
      { planExpiresAt: { $exists: false } },
      { planExpiresAt: null },
      { planExpiresAt: { $gt: now } },
    ],
  };
}

function planExpiredClause(now: Date): Record<string, unknown> {
  return {
    planExpiresAt: { $exists: true, $ne: null, $lte: now },
  };
}

function stripeStatusRegex(status: string): Record<string, unknown> {
  return { stripeSubscriptionStatus: { $regex: new RegExp(`^${status}$`, 'i') } };
}

/**
 * Espelha `normalizeBillingStatus` em filtro MongoDB — evita full scan (AH-E01).
 */
export function buildMongoFilterForAdminOpsBillingStatus(
  status: AdminOpsOrgBillingStatus,
  now = new Date(),
): Record<string, unknown> {
  switch (status) {
    case 'free':
      return { plan: 'free' };

    case 'trialing':
      return { ...paidPlanClause(), ...stripeStatusRegex('trialing') };

    case 'past_due':
      return { ...paidPlanClause(), ...stripeStatusRegex('past_due') };

    case 'unpaid':
      return { ...paidPlanClause(), ...stripeStatusRegex('unpaid') };

    case 'paused':
      return { ...paidPlanClause(), ...stripeStatusRegex('paused') };

    case 'incomplete':
      return {
        ...paidPlanClause(),
        stripeSubscriptionStatus: { $regex: /^incomplete(_expired)?$/i },
      };

    case 'manual':
      return {
        $and: [
          paidPlanClause(),
          stripeStatusRegex('manual'),
          planNotExpiredClause(now),
        ],
      };

    case 'canceled':
      return {
        $or: [
          {
            $and: [
              paidPlanClause(),
              { stripeSubscriptionStatus: { $regex: STRIPE_CANCELED_REGEX } },
            ],
          },
          {
            $and: [
              paidPlanClause(),
              stripeNotOverriddenClause(true),
              planExpiredClause(now),
            ],
          },
        ],
      };

    case 'active':
      return {
        $and: [
          paidPlanClause(),
          stripeNotOverriddenClause(),
          planNotExpiredClause(now),
        ],
      };

    default:
      return {};
  }
}
