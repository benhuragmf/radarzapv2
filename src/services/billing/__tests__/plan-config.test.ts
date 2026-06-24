import fs from 'fs';
import path from 'path';
import {
  canSubscribeToPlan,
  commercialPlanRank,
  PlanConfigService,
  planRank,
  resolveOperationalLimits,
  validatePlanCatalog,
  type CatalogPlanId,
} from '../plan-config';

describe('plan-config', () => {
  it('rankeia planos pagos (Organization.plan)', () => {
    expect(planRank('free')).toBeLessThan(planRank('starter'));
    expect(planRank('pro')).toBeLessThan(planRank('enterprise'));
  });

  it('rankeia planos comerciais incluindo trial', () => {
    expect(commercialPlanRank('free')).toBeLessThan(commercialPlanRank('trial'));
    expect(commercialPlanRank('trial')).toBeLessThan(commercialPlanRank('starter'));
    expect(commercialPlanRank('starter')).toBeLessThan(commercialPlanRank('pro'));
    expect(commercialPlanRank('pro')).toBeLessThan(commercialPlanRank('enterprise'));
  });

  it('impede downgrade ou mesmo plano', () => {
    expect(canSubscribeToPlan('pro', 'starter').ok).toBe(false);
    expect(canSubscribeToPlan('free', 'starter').ok).toBe(true);
    expect(canSubscribeToPlan('starter', 'pro').ok).toBe(true);
  });

  it('valida catálogo config/plans.json sem erros', () => {
    const filePath = path.resolve(process.cwd(), 'config/plans.json');
    const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const errors = validatePlanCatalog(doc);
    expect(errors).toEqual([]);
  });

  it('contém planos obrigatórios do lançamento', () => {
    const ids = PlanConfigService.getInstance()
      .getCatalog()
      .map(p => p.id);
    for (const id of ['trial', 'free', 'starter', 'pro', 'enterprise'] as CatalogPlanId[]) {
      expect(ids).toContain(id);
    }
  });

  it('cada plano tem limites comerciais obrigatórios', () => {
    for (const plan of PlanConfigService.getInstance().getCatalog()) {
      expect(plan.limits.includedAgents).toBeGreaterThanOrEqual(0);
      expect(plan.limits.includedUsers).toBeGreaterThanOrEqual(plan.limits.includedAgents);
      expect(plan.limits.messagesPerDay).toBeGreaterThan(0);
      expect(plan.limits.webchatWidgets).toBeGreaterThan(0);
      expect(plan.limits.leadForms).toBeGreaterThan(0);
      expect(plan.limits.aiCreditsMonthly).toBeGreaterThanOrEqual(0);
      expect(plan.limits.historyRetentionDays).toBeGreaterThan(0);
      expect(plan.currency).toBe('BRL');
    }
  });

  it('IA Créditos por plano batem com matriz TOP 03', () => {
    const svc = PlanConfigService.getInstance();
    expect(svc.getCommercialLimits('free')?.aiCreditsMonthly).toBe(0);
    expect(svc.getCommercialLimits('trial')?.aiCreditsMonthly).toBe(100);
    expect(svc.getCommercialLimits('starter')?.aiCreditsMonthly).toBe(400);
    expect(svc.getCommercialLimits('pro')?.aiCreditsMonthly).toBe(2500);
    expect(svc.getCommercialLimits('enterprise')?.aiCreditsMonthly).toBe(12000);
  });

  it('planos pagos têm preço; free/trial/enterprise não são checkout Stripe', () => {
    const svc = PlanConfigService.getInstance();
    expect(svc.findPlan('starter')?.priceMonthlyCents).toBe(9900);
    expect(svc.findPlan('pro')?.priceMonthlyCents).toBe(29900);
    expect(svc.findPlan('free')?.purchasable).toBe(false);
    expect(svc.findPlan('trial')?.purchasable).toBe(false);
    expect(svc.findPlan('enterprise')?.purchasable).toBe(false);
  });

  it('resolveOperationalLimits lê messagesPerDay do catálogo', () => {
    expect(resolveOperationalLimits('starter').messagesPerDay).toBe(500);
    expect(resolveOperationalLimits('pro').messagesPerDay).toBe(2500);
    expect(resolveOperationalLimits('enterprise').messagesPerDay).toBe(20000);
  });

  it('documenta pacotes IA extras sem checkout (futuro)', () => {
    const packs = PlanConfigService.getInstance().getMeta().aiCreditPacks ?? [];
    expect(packs.length).toBeGreaterThanOrEqual(3);
    expect(packs.every(p => p.status === 'documented_future')).toBe(true);
  });
});
