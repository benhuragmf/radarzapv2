/**
 * Simula turno "Benhur" após saudação inicial.
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { AiProviderService } from '@/services/ai/AiProviderService';
import { AiPromptBuilderService } from '@/services/ai/AiPromptBuilderService';
import { AiPromptBuilderService as PB } from '@/services/ai/AiPromptBuilderService';
import { AiEscalationService } from '@/services/ai/AiEscalationService';
import { AiConversationStatus } from '@/types/ai-assistant';
import type { IAiConversationState } from '@/models/AiConversationState';

const CLIENT_ID = process.env.TEST_CLIENT_ID?.trim() || '6a18bdc5ee126fd553a2c56b';

async function main() {
  await mongoose.connect(config.DATABASE.MONGODB_URL);
  const settings = await AiSettingsService.getInstance().getSettingsDoc(CLIENT_ID);
  const prompt = await AiPromptBuilderService.getInstance().buildSystemPrompt(CLIENT_ID);
  const promptDoc = await PB.getInstance().getOrCreatePrompt(CLIENT_ID);
  const provider = AiProviderService.getInstance();

  const history = [
    { role: 'assistant' as const, content: 'Olá! Seja bem-vindo. Me informe seu nome e como posso ajudar.' },
    { role: 'user' as const, content: 'Benhur' },
  ];

  const result = await provider.complete(CLIENT_ID, settings, [
    { role: 'system', content: prompt },
    ...history,
    { role: 'user', content: 'Benhur' },
  ]);

  const structured = result.structured;
  console.log('structured:', JSON.stringify(structured, null, 2));

  const state = {
    status: AiConversationStatus.AI_COLLECTING,
    aiTurnCount: 1,
    repeatedQuestionCount: 0,
    collectedName: 'Benhur',
  } as IAiConversationState;

  const decision = AiEscalationService.getInstance().check({
    clientText: 'Benhur',
    hasUninterpretableMedia: false,
    structured,
    state,
    prompt: promptDoc,
    rules: settings.transferRules,
  });
  console.log('escalation after turn increment would be aiTurnCount=2');
  state.aiTurnCount = 2;
  const decision2 = AiEscalationService.getInstance().check({
    clientText: 'Benhur',
    hasUninterpretableMedia: false,
    structured,
    state,
    prompt: promptDoc,
    rules: settings.transferRules,
  });
  console.log('decision (turn 1):', decision);
  console.log('decision (turn 2):', decision2);
  console.log('hasMinData:', AiEscalationService.getInstance().hasMinData(state, promptDoc, structured));

  await mongoose.disconnect();
}

main().catch(e => {
  console.error('FAIL:', (e as Error).message);
  process.exit(1);
});
