import {
  estimateWaValidationHoursForPace,
  resolveWaRegistrationPaceFromPlanId,
} from '@/services/destinations/wa-registration-pace.service';

describe('wa-registration pace by plan', () => {
  it('free/trial = lenta (~24h por 1000)', () => {
    const pace = resolveWaRegistrationPaceFromPlanId('free');
    expect(pace.tier).toBe('slow');
    expect(pace.referenceHoursPer1000).toBe(24);
    expect(estimateWaValidationHoursForPace(1000, pace)).toBeGreaterThanOrEqual(23);
  });

  it('pro/starter = média (~6h por 1000)', () => {
    const pro = resolveWaRegistrationPaceFromPlanId('pro');
    const starter = resolveWaRegistrationPaceFromPlanId('starter');
    expect(pro.tier).toBe('medium');
    expect(starter.tier).toBe('medium');
    expect(estimateWaValidationHoursForPace(1000, pro)).toBe(6);
  });

  it('enterprise = rápida (~1h por 1000)', () => {
    const pace = resolveWaRegistrationPaceFromPlanId('enterprise');
    expect(pace.tier).toBe('fast');
    expect(estimateWaValidationHoursForPace(1000, pace)).toBe(1);
    expect(pace.manualBatchMax).toBeGreaterThan(10);
  });
});
