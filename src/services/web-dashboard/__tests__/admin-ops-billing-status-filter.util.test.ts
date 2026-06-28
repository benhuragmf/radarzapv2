import { normalizeBillingStatus } from '@/services/billing/billing-state.util';
import { buildMongoFilterForAdminOpsBillingStatus } from '@/services/web-dashboard/admin-ops-billing-status-filter.util';
import type { AdminOpsOrgBillingStatus } from '@/types/admin-ops-organizations';
import type { OrgPlanId } from '@/services/billing/plan-config';

const NOW = new Date('2026-06-28T12:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 86400000 * 30);
const PAST = new Date(NOW.getTime() - 86400000 * 30);

type SampleOrg = {
  plan: OrgPlanId;
  planExpiresAt?: Date | null;
  stripeSubscriptionStatus?: string | null;
};

const SAMPLES: SampleOrg[] = [
  { plan: 'free' },
  {
    plan: 'starter',
    planExpiresAt: FUTURE,
    stripeSubscriptionStatus: 'trialing',
  },
  {
    plan: 'pro',
    planExpiresAt: FUTURE,
    stripeSubscriptionStatus: 'past_due',
  },
  {
    plan: 'enterprise',
    planExpiresAt: FUTURE,
    stripeSubscriptionStatus: 'manual',
  },
  {
    plan: 'starter',
    planExpiresAt: PAST,
    stripeSubscriptionStatus: null,
  },
  {
    plan: 'starter',
    planExpiresAt: FUTURE,
    stripeSubscriptionStatus: null,
  },
  {
    plan: 'pro',
    planExpiresAt: PAST,
    stripeSubscriptionStatus: 'manual',
  },
  {
    plan: 'starter',
    stripeSubscriptionStatus: 'canceled',
  },
];

function evalFieldOperators(value: unknown, op: Record<string, unknown>): boolean {
  if ('$in' in op && !(op.$in as unknown[]).includes(value)) return false;
  if ('$regex' in op) {
    const re = op.$regex as RegExp;
    if (typeof value !== 'string' || !re.test(value)) return false;
  }
  if ('$gt' in op) {
    if (!(value instanceof Date) || value.getTime() <= (op.$gt as Date).getTime()) return false;
  }
  if ('$lte' in op) {
    if (!(value instanceof Date) || value.getTime() > (op.$lte as Date).getTime()) return false;
  }
  if ('$exists' in op) {
    const exists = value !== undefined && value !== null;
    if (op.$exists !== exists) return false;
  }
  if ('$ne' in op && value === op.$ne) return false;
  if ('$not' in op) {
    const inner = op.$not as Record<string, unknown>;
    if (inner.$regex && typeof value === 'string' && (inner.$regex as RegExp).test(value)) {
      return false;
    }
  }
  return true;
}

function matchesMongoFilter(org: SampleOrg, filter: Record<string, unknown>): boolean {
  const evalOrg = (doc: Record<string, unknown>, clause: Record<string, unknown>): boolean => {
    for (const [key, expected] of Object.entries(clause)) {
      if (key === '$and') {
        if (!(expected as Record<string, unknown>[]).every(c => evalOrg(doc, c))) return false;
        continue;
      }
      if (key === '$or') {
        if (!(expected as Record<string, unknown>[]).some(c => evalOrg(doc, c))) return false;
        continue;
      }
      const value = doc[key];
      if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
        const op = expected as Record<string, unknown>;
        const isOperator =
          '$in' in op ||
          '$regex' in op ||
          '$gt' in op ||
          '$lte' in op ||
          '$exists' in op ||
          '$ne' in op ||
          '$not' in op;
        if (isOperator) {
          if (!evalFieldOperators(value, op)) return false;
          continue;
        }
      }
      if (value !== expected) return false;
    }
    return true;
  };

  return evalOrg(org as Record<string, unknown>, filter);
}

describe('admin-ops-billing-status-filter (AH-E01)', () => {
  const statuses: AdminOpsOrgBillingStatus[] = [
    'free',
    'trialing',
    'active',
    'past_due',
    'unpaid',
    'canceled',
    'paused',
    'incomplete',
    'manual',
  ];

  it('starter stripe canceled não entra em active', () => {
    const org = { plan: 'starter' as const, stripeSubscriptionStatus: 'canceled' };
    expect(matchesMongoFilter(org, buildMongoFilterForAdminOpsBillingStatus('active', NOW))).toBe(false);
    expect(matchesMongoFilter(org, buildMongoFilterForAdminOpsBillingStatus('canceled', NOW))).toBe(true);
  });

  it('manual expirado entra em canceled', () => {
    const org = { plan: 'pro' as const, planExpiresAt: PAST, stripeSubscriptionStatus: 'manual' };
    expect(normalizeBillingStatus(org, NOW)).toBe('canceled');
    expect(matchesMongoFilter(org, buildMongoFilterForAdminOpsBillingStatus('canceled', NOW))).toBe(true);
  });

  it.each(statuses)('filtro Mongo alinha com normalizeBillingStatus para %s', status => {
    const filter = buildMongoFilterForAdminOpsBillingStatus(status, NOW);
    for (const org of SAMPLES) {
      const normalized = normalizeBillingStatus(org, NOW);
      const mongoMatch = matchesMongoFilter(org, filter);
      expect(mongoMatch).toBe(normalized === status);
    }
  });
});
