import type { AiProvider } from '@/types/ai-assistant';

/** Preços em USD por 1 milhão de tokens (tier Standard, Google AI / OpenAI). */
export interface AiModelCatalogEntry {
  id: string;
  provider: AiProvider;
  label: string;
  description: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  tier: 'flagship' | 'balanced' | 'economy';
  recommended?: boolean;
  deprecated?: boolean;
  sortOrder: number;
}

/** Tokens médios por turno de atendimento (triagem WhatsApp). */
export const AI_TYPICAL_TURN_INPUT_TOKENS = 800;
export const AI_TYPICAL_TURN_OUTPUT_TOKENS = 200;

export const GEMINI_MODEL_CATALOG: AiModelCatalogEntry[] = [
  {
    id: 'gemini-3.5-flash',
    provider: 'gemini',
    label: 'Gemini 3.5 Flash',
    description: 'Mais inteligente e rápido — ideal quando qualidade é prioridade.',
    inputUsdPer1M: 1.5,
    outputUsdPer1M: 9.0,
    tier: 'flagship',
    sortOrder: 10,
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    label: 'Gemini 2.5 Flash',
    description: 'Equilíbrio entre velocidade, custo e qualidade — recomendado para atendimento.',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    tier: 'balanced',
    recommended: true,
    sortOrder: 20,
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    label: 'Gemini 2.5 Pro',
    description: 'Raciocínio avançado — use para casos complexos ou muita base de conhecimento.',
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10.0,
    tier: 'flagship',
    sortOrder: 30,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    label: 'Gemini 2 Flash',
    description: 'Modelo legado — migre para 2.5 Flash.',
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.4,
    tier: 'balanced',
    deprecated: true,
    sortOrder: 40,
  },
  {
    id: 'gemini-2.5-flash-lite',
    provider: 'gemini',
    label: 'Gemini 2 Flash Lite',
    description: 'Menor custo — alto volume de mensagens simples.',
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.4,
    tier: 'economy',
    sortOrder: 50,
  },
];

export const OPENAI_MODEL_CATALOG: AiModelCatalogEntry[] = [
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o mini',
    description: 'Rápido e econômico — recomendado para triagem.',
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    tier: 'balanced',
    recommended: true,
    sortOrder: 10,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    description: 'Mais capaz — maior custo por mensagem.',
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 10.0,
    tier: 'flagship',
    sortOrder: 20,
  },
];

const ALL_MODELS = [...GEMINI_MODEL_CATALOG, ...OPENAI_MODEL_CATALOG];
const BY_ID = new Map(ALL_MODELS.map(m => [m.id, m]));

export function listModelsForProvider(provider: AiProvider): AiModelCatalogEntry[] {
  return ALL_MODELS
    .filter(m => m.provider === provider && !m.deprecated)
    .concat(ALL_MODELS.filter(m => m.provider === provider && m.deprecated))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getModelCatalogEntry(modelId: string): AiModelCatalogEntry | undefined {
  return BY_ID.get(modelId);
}

export function estimateTokenCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const entry = getModelCatalogEntry(modelId);
  if (entry) {
    return (
      (inputTokens / 1_000_000) * entry.inputUsdPer1M +
      (outputTokens / 1_000_000) * entry.outputUsdPer1M
    );
  }
  if (modelId.includes('gpt-4o') && !modelId.includes('mini')) {
    return inputTokens * 0.0000025 + outputTokens * 0.00001;
  }
  if (modelId.includes('gemini') || modelId.includes('flash')) {
    return inputTokens * 0.0000003 + outputTokens * 0.0000025;
  }
  return inputTokens * 0.00000015 + outputTokens * 0.0000006;
}

export function estimateTypicalTurnCostUsd(modelId: string): number {
  return estimateTokenCostUsd(
    modelId,
    AI_TYPICAL_TURN_INPUT_TOKENS,
    AI_TYPICAL_TURN_OUTPUT_TOKENS,
  );
}

export function defaultModelForProviderCatalog(provider: AiProvider): string {
  const models = listModelsForProvider(provider);
  return models.find(m => m.recommended)?.id ?? models[0]?.id ?? 'gpt-4o-mini';
}

export function geminiFallbackModelIds(primary: string): string[] {
  const ordered = [
    primary,
    ...GEMINI_MODEL_CATALOG.filter(m => !m.deprecated).map(m => m.id),
    'gemini-flash-latest',
  ];
  return [...new Set(ordered)];
}
