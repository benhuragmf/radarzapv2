import { canSubscribeToPlan, planRank } from '../plan-config';

describe('plan-config', () => {
  it('rankeia planos', () => {
    expect(planRank('free')).toBeLessThan(planRank('starter'));
    expect(planRank('pro')).toBeLessThan(planRank('enterprise'));
  });

  it('impede downgrade ou mesmo plano', () => {
    expect(canSubscribeToPlan('pro', 'starter').ok).toBe(false);
    expect(canSubscribeToPlan('free', 'starter').ok).toBe(true);
    expect(canSubscribeToPlan('starter', 'pro').ok).toBe(true);
  });
});
