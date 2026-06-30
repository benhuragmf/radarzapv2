/**
 * E2E local: Core Files, auto-resolve, aprendizado (sem WhatsApp).
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/test-ai-core-e2e.ts
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { AiKnowledgeBaseService } from '@/services/ai/AiKnowledgeBaseService';
import { AiAutoResolveService } from '@/services/ai/AiAutoResolveService';
import { AiPromptBuilderService } from '@/services/ai/AiPromptBuilderService';
import { AiSkillService } from '@/services/ai/AiSkillService';
import { AiMemoryService } from '@/services/ai/AiMemoryService';
import { AiPrompt } from '@/models/AiPrompt';

const CLIENT_ID = process.env.TEST_CLIENT_ID?.trim() || '6a18bdc5ee126fd553a2c56b';
const TEST_QUERY = 'meu rastreador não conecta no aplicativo';

async function main() {
  await mongoose.connect(config.DATABASE.MONGODB_URL);
  console.log('=== E2E IA Core Files — tenant', CLIENT_ID, '===\n');

  const settings = await AiSettingsService.getInstance().getSettingsDoc(CLIENT_ID);
  console.log('1) IA ativa?', settings.enabled, '| modo:', settings.mode, '| modelo:', settings.llmModel);
  if (!settings.enabled) {
    console.warn('   AVISO: IA desativada — ative no painel ou rode seed-ai-gemini-settings.ts');
  }

  await AiPrompt.findOneAndUpdate(
    { clientId: new mongoose.Types.ObjectId(CLIENT_ID) },
    {
      $set: {
        autoResolveEnabled: true,
        learnSkillsEnabled: true,
        learnMemoryEnabled: true,
      },
    },
    { upsert: true },
  );
  const { PlatformAiBlueprintService } = await import('@/services/ai/PlatformAiBlueprintService');
  const blueprint = await PlatformAiBlueprintService.getInstance().getGlobal();
  console.log('2) Blueprint Radar Chat v' + blueprint.version, '— agente:', blueprint.agentName);

  const kbSvc = AiKnowledgeBaseService.getInstance();
  const existing = await kbSvc.list(CLIENT_ID);
  const hasRastreador = existing.some(k =>
    k.title.toLowerCase().includes('rastreador'),
  );
  if (!hasRastreador) {
    await kbSvc.upsert(CLIENT_ID, {
      title: 'Rastreador sem conexão no app',
      content:
        '1) Reinicie o equipamento (desligue 30s). 2) Verifique APN e dados móveis. 3) Reinstale o app com as credenciais do cliente.',
      active: true,
    });
    console.log('3) KB — item rastreador criado');
  } else {
    console.log('3) KB — item rastreador já existe');
  }

  const auto = await AiAutoResolveService.getInstance().tryResolve(CLIENT_ID, TEST_QUERY);
  console.log('\n4) Auto-resolve (sem LLM):');
  console.log('   query:', TEST_QUERY);
  console.log('   hit:', auto.hit);
  console.log('   source:', auto.source);
  console.log('   score:', auto.score);
  if (auto.hit) {
    console.log('   reply (início):', auto.reply?.slice(0, 120) + '…');
  } else {
    console.error('   FALHA: deveria bater na KB');
    process.exitCode = 1;
  }

  const prompt = await AiPromptBuilderService.getInstance().buildSystemPrompt(CLIENT_ID, {
    clientText: TEST_QUERY,
  });
  const checks = ['## IDENTITY', '## SOUL', '## AGENTS', '## TOOLS', '## MEMORY', '## SKILLS', '## KNOWLEDGE'];
  console.log('\n5) Prompt bootstrap:');
  for (const c of checks) {
    console.log('  ', c, prompt.includes(c) ? 'OK' : 'FALTA');
    if (!prompt.includes(c)) process.exitCode = 1;
  }
  console.log('   tamanho prompt:', prompt.length, 'chars');

  const fakeConvId = new mongoose.Types.ObjectId();
  const fakeState = {
    collectedProblem: TEST_QUERY,
    collectedName: 'Cliente Teste',
    summary: 'Teste E2E auto-resolve',
  } as Parameters<typeof AiSkillService.prototype.proposeFromConversation>[2];

  const skill = await AiSkillService.getInstance().proposeFromConversation(
    CLIENT_ID,
    fakeConvId,
    fakeState,
    'Reinicie o equipamento e verifique o app.',
  );
  const memory = await AiMemoryService.getInstance().proposeFromConversation(
    CLIENT_ID,
    fakeConvId,
    fakeState,
    'Reinicie o equipamento e verifique o app.',
  );
  console.log('\n6) Aprendizado ao escalar (simulado):');
  console.log('   skill pendente:', skill ? skill.title : 'não criada');
  console.log('   memória pendente:', memory ? memory.title : 'não criada');

  const payload = await AiSettingsService.getInstance().getFullPayload(CLIENT_ID);
  const pendingSkills = (payload.skills as { status: string }[]).filter(s => s.status === 'pending').length;
  const pendingMem = (payload.memories as { status: string }[]).filter(m => m.status === 'pending').length;
  console.log('\n7) Painel API payload:');
  console.log('   skills pendentes:', pendingSkills);
  console.log('   memórias pendentes:', pendingMem);
  console.log(
    '   blueprint no payload:',
    (payload as { blueprintInfo?: { version: number } }).blueprintInfo?.version,
  );

  console.log('\n=== E2E concluído ===');
  if (!process.exitCode) console.log('RESULTADO: OK — fluxo funcional no tenant de teste.');
  else console.log('RESULTADO: FALHAS acima — revisar.');

  await mongoose.disconnect();
}

main().catch(e => {
  console.error('ERRO:', (e as Error).message);
  process.exit(1);
});
