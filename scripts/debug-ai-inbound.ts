/**
 * Diagnóstico de respostas da IA (mesmo prompt do WhatsApp).
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/debug-ai-inbound.ts
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { AiProviderService } from '@/services/ai/AiProviderService';
import { AiPromptBuilderService } from '@/services/ai/AiPromptBuilderService';

const CLIENT_ID = process.env.TEST_CLIENT_ID?.trim() || '6a18bdc5ee126fd553a2c56b';

async function main() {
  await mongoose.connect(config.DATABASE.MONGODB_URL);
  const settings = await AiSettingsService.getInstance().getSettingsDoc(CLIENT_ID);
  console.log({
    enabled: settings.enabled,
    mode: settings.mode,
    model: settings.llmModel,
    maxTokens: settings.maxTokens,
    temperature: settings.temperature,
  });

  const prompt = await AiPromptBuilderService.getInstance().buildSystemPrompt(CLIENT_ID);
  const provider = AiProviderService.getInstance();

  const samples = process.argv.slice(2);
  const texts = samples.length ? samples : ['oi', 'ola', 'Preciso de ajuda'];

  for (const text of texts) {
    const result = await provider.complete(CLIENT_ID, settings, [
      { role: 'system', content: prompt },
      { role: 'user', content: text },
    ]);
    console.log('\n--- user:', text);
    console.log('reply:', result.structured.reply);
    console.log('parseFailed:', result.structured.parseFailed);
    console.log('unusable:', provider.isUnusableClientReply(result.structured));
    console.log('tokens in/out:', result.inputTokens, result.outputTokens);
  }

  await mongoose.disconnect();
}

main().catch(e => {
  console.error('FAIL:', (e as Error).message);
  process.exit(1);
});
