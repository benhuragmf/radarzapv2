import {
  AI_CREDITS_CLIENT_FALLBACK_MESSAGE,
  AI_CREDITS_INTERNAL_BLOCKED_REASON,
  buildLearningDepletedReason,
  buildWalletDepletedReason,
  canConsumeAiCredits,
  getAiWalletPlanLimits,
  resolveAiWalletBalance,
} from '@/types/ai-wallet';

describe('ai-wallet', () => {
  it('limites por plano', () => {
    expect(getAiWalletPlanLimits('free').monthlyCreditsIncluded).toBe(0);
    expect(getAiWalletPlanLimits('trial').monthlyCreditsIncluded).toBe(100);
    expect(getAiWalletPlanLimits('starter').monthlyCreditsIncluded).toBe(400);
    expect(getAiWalletPlanLimits('pro').monthlyCreditsIncluded).toBe(2500);
    expect(getAiWalletPlanLimits('enterprise').monthlyCreditsIncluded).toBe(12000);
    expect(getAiWalletPlanLimits('pro').monthlyLearningOps).toBe(120);
  });

  it('mensagem de saldo esgotado orienta recarga ou API própria', () => {
    const msg = buildWalletDepletedReason({ balance: 0, actionHint: 'recharge' });
    expect(msg).toMatch(/Recarregue/);
    expect(msg).toMatch(/API própria/);
  });

  it('mensagem de aprendizagem esgotada', () => {
    expect(buildLearningDepletedReason()).toMatch(/aprendizagem/);
  });

  it('canConsumeAiCredits bloqueia free e saldo insuficiente', () => {
    expect(
      canConsumeAiCredits(
        { balance: 0, totalAllowance: 0, usedThisMonth: 0, depleted: false },
        1,
      ).allowed,
    ).toBe(false);
    expect(
      canConsumeAiCredits(
        { balance: 0.5, totalAllowance: 400, usedThisMonth: 399.5, depleted: true },
        1,
      ).allowed,
    ).toBe(false);
    expect(
      canConsumeAiCredits(
        { balance: 10, totalAllowance: 400, usedThisMonth: 390, depleted: false },
        1,
      ).allowed,
    ).toBe(true);
  });

  it('resolveAiWalletBalance nunca negativo', () => {
    expect(resolveAiWalletBalance({ balance: -3, totalAllowance: 100, usedThisMonth: 103 })).toBe(0);
  });

  it('mensagens fallback cliente vs interno', () => {
    expect(AI_CREDITS_CLIENT_FALLBACK_MESSAGE).not.toMatch(/crédito/i);
    expect(AI_CREDITS_INTERNAL_BLOCKED_REASON).toMatch(/crédito/i);
  });
});
