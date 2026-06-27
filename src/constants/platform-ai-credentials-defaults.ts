import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '@/types/ai-assistant';
import type { AiProvider } from '@/types/ai-assistant';

export const PLATFORM_AI_CREDENTIALS_DEFAULTS = {
  provider: 'openai' as AiProvider,
  llmModel: DEFAULT_OPENAI_MODEL,
};

export const PLATFORM_AI_ENV_KEYS = {
  openai: ['RADARZAP_AI_OPENAI_KEY', 'OPENAI_API_KEY'] as const,
  gemini: ['RADARZAP_AI_GEMINI_KEY', 'GEMINI_API_KEY'] as const,
};

export function defaultModelForPlatformProvider(provider: AiProvider): string {
  return provider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL;
}
