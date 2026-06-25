import { PlanConfigService } from '@/services/billing/plan-config';
import {
  canCreateResourceUnderPlanLimit,
  resolvePlanLimit,
} from '@/services/billing/plan-limit.util';

describe('plan-limit.util', () => {
  const plans = PlanConfigService.getInstance();

  it('resolve limites do catálogo TOP 03', () => {
    expect(resolvePlanLimit('starter', 'webchatWidgets')).toBeGreaterThan(0);
    expect(resolvePlanLimit('free', 'contacts')).toBeGreaterThanOrEqual(0);
  });

  it('starter e pro têm preços do catálogo', () => {
    const starter = plans.findPlan('starter')!;
    const pro = plans.findPlan('pro')!;
    expect(starter.priceMonthlyCents).toBe(9900);
    expect(pro.priceMonthlyCents).toBe(29900);
  });

  it('canCreateResourceUnderPlanLimit respeita teto', () => {
    expect(canCreateResourceUnderPlanLimit(2, 3)).toBe(true);
    expect(canCreateResourceUnderPlanLimit(3, 3)).toBe(false);
    expect(canCreateResourceUnderPlanLimit(10, -1)).toBe(true);
  });

  it('trial tem 100 créditos IA no catálogo', () => {
    const trial = plans.getCommercialLimits('trial');
    expect(trial?.aiCreditsMonthly).toBe(100);
  });
});
