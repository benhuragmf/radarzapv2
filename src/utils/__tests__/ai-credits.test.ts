import {
  AI_CREDIT_USD_UNIT,
  AI_MODULE_CREDIT_ESTIMATE,
  aiCreditsDebitForCall,
  aiCreditsFromActualCost,
  aiModuleCreditEstimate,
  inferCreditsFromRow,
  isRadarchatPlatformProvider,
} from '@/types/ai-credits';

describe('ai-credits', () => {
  it('identifica provedores Radar Chat', () => {
    expect(isRadarchatPlatformProvider('radarchat')).toBe(true);
    expect(isRadarchatPlatformProvider('radarchat-basic-triage')).toBe(true);
    expect(isRadarchatPlatformProvider('openai')).toBe(false);
  });

  it('estimativa 1x básica e 2x premium é só projeção de módulo', () => {
    expect(aiModuleCreditEstimate('basic_triage')).toBe(AI_MODULE_CREDIT_ESTIMATE.basic_triage);
    expect(aiModuleCreditEstimate('premium_assistant')).toBe(
      AI_MODULE_CREDIT_ESTIMATE.premium_assistant,
    );
  });

  it('cobrança real é proporcional ao custo USD da chamada', () => {
    const cost = AI_CREDIT_USD_UNIT * 2.5;
    expect(aiCreditsFromActualCost(cost)).toBe(2.5);
    expect(
      aiCreditsDebitForCall({ provider: 'radarchat', estimatedCostUsd: cost }),
    ).toBe(2.5);
  });

  it('chave própria da empresa não consome créditos Radar Chat', () => {
    expect(
      aiCreditsDebitForCall({ provider: 'openai', estimatedCostUsd: 0.05 }),
    ).toBe(0);
  });

  it('respeita creditWeight persistido no registro', () => {
    expect(
      inferCreditsFromRow({
        provider: 'radarchat',
        usageKind: 'premium_assistant',
        creditWeight: 1.42,
        estimatedCost: 0.01,
      }),
    ).toBe(1.42);
  });
});
