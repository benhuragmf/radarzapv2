/**
 * Ativa IA própria (Gemini) para o tenant local.
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/seed-ai-gemini-settings.ts
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { AiSettingsService } from '@/services/ai/AiSettingsService';

const CLIENT_ID = process.env.TEST_CLIENT_ID?.trim() || '6a18bdc5ee126fd553a2c56b';
const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();

async function main() {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY ausente no .env');
  await mongoose.connect(config.DATABASE.MONGODB_URL);
  const svc = AiSettingsService.getInstance();
  await svc.upsertSettings(CLIENT_ID, {
    settings: {
      enabled: true,
      mode: 'company',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      maxTokens: 600,
      apiKey: GEMINI_KEY,
    },
  });
  const { AiProviderService } = await import('@/services/ai/AiProviderService');
  const settings = await svc.getSettingsDoc(CLIENT_ID);
  const test = await AiProviderService.getInstance().testConnection(CLIENT_ID, settings);
  console.log('IA configurada para tenant', CLIENT_ID);
  console.log('testConnection:', test);
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
