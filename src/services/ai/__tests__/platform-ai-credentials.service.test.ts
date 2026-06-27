import { PlatformAiCredentialsService } from '@/services/ai/PlatformAiCredentialsService';
import { AiCredentialVaultService } from '@/services/ai/AiCredentialVaultService';

describe('PlatformAiCredentialsService.resolveKeyFromDoc', () => {
  const svc = PlatformAiCredentialsService.getInstance();
  const vault = AiCredentialVaultService.getInstance();
  const prevOpenAi = process.env.RADARZAP_AI_OPENAI_KEY;
  const prevGemini = process.env.RADARZAP_AI_GEMINI_KEY;

  afterEach(() => {
    if (prevOpenAi === undefined) delete process.env.RADARZAP_AI_OPENAI_KEY;
    else process.env.RADARZAP_AI_OPENAI_KEY = prevOpenAi;
    if (prevGemini === undefined) delete process.env.RADARZAP_AI_GEMINI_KEY;
    else process.env.RADARZAP_AI_GEMINI_KEY = prevGemini;
  });

  it('prefere chave do banco sobre env', () => {
    process.env.RADARZAP_AI_OPENAI_KEY = 'env-key';
    const encrypted = vault.encryptApiKey('db-key');
    const resolved = svc.resolveKeyFromDoc({
      provider: 'openai',
      encryptedOpenAiKey: encrypted,
      encryptedGeminiKey: undefined,
    });
    expect(resolved.apiKey).toBe('db-key');
    expect(resolved.keySource).toBe('database');
  });

  it('usa env quando banco vazio', () => {
    delete process.env.RADARZAP_AI_OPENAI_KEY;
    process.env.OPENAI_API_KEY = 'fallback-env';
    const resolved = svc.resolveKeyFromDoc({
      provider: 'openai',
      encryptedOpenAiKey: undefined,
      encryptedGeminiKey: undefined,
    });
    expect(resolved.apiKey).toBe('fallback-env');
    expect(resolved.keySource).toBe('env');
  });

  it('retorna none sem chave', () => {
    delete process.env.RADARZAP_AI_OPENAI_KEY;
    delete process.env.OPENAI_API_KEY;
    const resolved = svc.resolveKeyFromDoc({
      provider: 'openai',
      encryptedOpenAiKey: undefined,
      encryptedGeminiKey: undefined,
    });
    expect(resolved.apiKey).toBeNull();
    expect(resolved.keySource).toBe('none');
  });
});
