/**
 * Teste local do AiProviderService (Gemini).
 * Uso: GEMINI_API_KEY=AQ... npx ts-node -r tsconfig-paths/register scripts/test-ai-gemini-provider.ts
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { AiProviderService } from '@/services/ai/AiProviderService';
import type { IAiSettings } from '@/models/AiSettings';

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error('Defina GEMINI_API_KEY no ambiente');
  process.exit(1);
}

const settings = {
  enabled: true,
  mode: 'company',
  provider: 'gemini',
  llmModel: 'gemini-2.5-flash',
  temperature: 0.4,
  maxTokens: 64,
} as IAiSettings;

async function main() {
  await mongoose.connect(config.DATABASE.MONGODB_URL);
  const svc = AiProviderService.getInstance();
  const ping = await svc.testConnection('6a18bdc5ee126fd553a2c56b', settings, apiKey);
  console.log('testConnection:', ping);

  const clientId = process.env.TEST_CLIENT_ID?.trim() || '6a18bdc5ee126fd553a2c56b';
  const completion = await svc.complete(
    clientId,
    settings,
    [
      { role: 'system', content: 'Responda em JSON: {"reply":"ok"}' },
      { role: 'user', content: 'diga oi' },
    ],
  );
  console.log('complete.reply:', completion.structured.reply.slice(0, 120));
  console.log('tokens:', completion.inputTokens + completion.outputTokens);
  await mongoose.disconnect();
}

main().catch(e => {
  console.error('FAIL:', (e as Error).message);
  process.exit(1);
});
