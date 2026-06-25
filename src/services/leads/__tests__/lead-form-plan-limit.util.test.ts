import {
  LEAD_FORM_LIMIT_MESSAGE,
  canCreateLeadFormAtPlanLimit,
  checkLeadFormPlanLimit,
  resolveLeadFormsPlanLimit,
} from '../lead-form-plan-limit.util';

describe('lead-form-plan-limit.util', () => {
  it('resolveLeadFormsPlanLimit retorna limites do catálogo', () => {
    expect(resolveLeadFormsPlanLimit('free')).toBe(1);
    expect(resolveLeadFormsPlanLimit('starter')).toBe(2);
    expect(resolveLeadFormsPlanLimit('pro')).toBe(5);
    expect(resolveLeadFormsPlanLimit('enterprise')).toBe(20);
  });

  it('canCreateLeadFormAtPlanLimit bloqueia quando count >= limit', () => {
    expect(canCreateLeadFormAtPlanLimit(0, 2)).toBe(true);
    expect(canCreateLeadFormAtPlanLimit(1, 2)).toBe(true);
    expect(canCreateLeadFormAtPlanLimit(2, 2)).toBe(false);
    expect(canCreateLeadFormAtPlanLimit(5, 2)).toBe(false);
  });

  it('checkLeadFormPlanLimit retorna mensagem amigável', () => {
    expect(checkLeadFormPlanLimit(0, 'free').ok).toBe(true);
    const blocked = checkLeadFormPlanLimit(1, 'free');
    expect(blocked.ok).toBe(false);
    if (blocked.ok === false) {
      expect(blocked.message).toBe(LEAD_FORM_LIMIT_MESSAGE);
    }
  });

  it('org legada acima do limite continua com formulários existentes — só bloqueia novo', () => {
    expect(canCreateLeadFormAtPlanLimit(3, 1)).toBe(false);
    expect(canCreateLeadFormAtPlanLimit(3, 1)).toBe(false);
  });
});
