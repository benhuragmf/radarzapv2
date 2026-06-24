import {
  buildLearningDepletedReason,
  buildWalletDepletedReason,
  getAiWalletPlanLimits,
} from '@/types/ai-wallet';

describe('ai-wallet', () => {
  it('limites por plano', () => {
    expect(getAiWalletPlanLimits('starter').monthlyCreditsIncluded).toBe(400);
    expect(getAiWalletPlanLimits('pro').monthlyLearningOps).toBe(120);
    expect(getAiWalletPlanLimits('free').monthlyCreditsIncluded).toBe(0);
  });

  it('mensagem de saldo esgotado orienta recarga ou API própria', () => {
    const msg = buildWalletDepletedReason({ balance: 0, actionHint: 'recharge' });
    expect(msg).toMatch(/Recarregue/);
    expect(msg).toMatch(/API própria/);
  });

  it('mensagem de aprendizagem esgotada', () => {
    expect(buildLearningDepletedReason()).toMatch(/aprendizagem/);
  });
});
