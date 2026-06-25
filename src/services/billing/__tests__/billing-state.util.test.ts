import {
  BILLING_GRACE_PERIOD_DAYS,
  isBillingActive,
  isBillingInGrace,
  normalizeBillingStatus,
  shouldBlockPaidFeatures,
} from '@/services/billing/billing-state.util';

describe('billing-state.util', () => {
  it('normaliza free', () => {
    expect(normalizeBillingStatus({ plan: 'free' })).toBe('free');
  });

  it('mapeia past_due do Stripe', () => {
    expect(
      normalizeBillingStatus({
        plan: 'pro',
        planExpiresAt: new Date(Date.now() + 86400000),
        stripeSubscriptionStatus: 'past_due',
      }),
    ).toBe('past_due');
  });

  it('active pago com plano vigente', () => {
    expect(
      normalizeBillingStatus({
        plan: 'starter',
        planExpiresAt: new Date(Date.now() + 86400000 * 10),
      }),
    ).toBe('active');
  });

  it('grace period de 3 dias em past_due', () => {
    const pastDueSince = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(
      isBillingInGrace('past_due', pastDueSince),
    ).toBe(true);
    const old = new Date(Date.now() - (BILLING_GRACE_PERIOD_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(isBillingInGrace('past_due', old)).toBe(false);
  });

  it('bloqueia recursos pagos em unpaid', () => {
    expect(shouldBlockPaidFeatures('unpaid')).toBe(true);
    expect(shouldBlockPaidFeatures('past_due', { inGrace: true })).toBe(false);
  });

  it('isBillingActive inclui past_due', () => {
    expect(isBillingActive('past_due')).toBe(true);
    expect(isBillingActive('unpaid')).toBe(false);
  });
});
