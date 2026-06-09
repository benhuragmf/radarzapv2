import { AiEscalationService } from '../AiEscalationService';
import { DEFAULT_AI_TRANSFER_RULES } from '@/types/ai-assistant';
import type { IAiConversationState } from '@/models/AiConversationState';
import type { IAiPrompt } from '@/models/AiPrompt';
import { AiConversationStatus } from '@/types/ai-assistant';

const baseState = {
  status: AiConversationStatus.AI_COLLECTING,
  confidence: 0.8,
  repeatedQuestionCount: 0,
} as IAiConversationState;

const basePrompt = {
  collectName: true,
  collectEmail: true,
  collectProblem: true,
} as IAiPrompt;

describe('AiEscalationService', () => {
  const svc = AiEscalationService.getInstance();

  it('escalona quando cliente pede humano', () => {
    const r = svc.check({
      clientText: 'quero falar com um atendente',
      hasUninterpretableMedia: false,
      state: baseState,
      prompt: basePrompt,
      rules: DEFAULT_AI_TRANSFER_RULES,
    });
    expect(r.shouldEscalate).toBe(true);
  });

  it('detecta dados mínimos coletados', () => {
    const state = {
      ...baseState,
      collectedName: 'Maria',
      collectedEmail: 'maria@test.com',
      collectedProblem: 'Pedido atrasado',
    } as IAiConversationState;
    expect(svc.hasMinData(state, basePrompt)).toBe(true);
  });
});
