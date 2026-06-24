/** Classificação de chamada LLM para custos/logs por modo de atendimento. */
export type AiUsageKind = 'premium_assistant' | 'basic_triage' | 'unknown';

export const AI_USAGE_KIND_VALUES: readonly AiUsageKind[] = [
  'premium_assistant',
  'basic_triage',
  'unknown',
] as const;

export function isValidAiUsageKind(value: unknown): value is AiUsageKind {
  return typeof value === 'string' && (AI_USAGE_KIND_VALUES as readonly string[]).includes(value);
}

/** Infere kind a partir do provider legado (registros pré-2.11.3). */
export function inferAiUsageKind(provider: string, storedKind?: string | null): AiUsageKind {
  if (isValidAiUsageKind(storedKind)) return storedKind;
  if (provider === 'radarzap-basic-triage') return 'basic_triage';
  if (provider === 'radarzap' || provider === 'openai' || provider === 'gemini' || provider === 'company') {
    return 'premium_assistant';
  }
  return 'unknown';
}

export function aiUsageKindLabel(kind: AiUsageKind): string {
  switch (kind) {
    case 'premium_assistant':
      return 'IA Premium';
    case 'basic_triage':
      return 'IA Básica (fallback LLM)';
    default:
      return 'Outro';
  }
}

export function aiUsageKindFromProviderLabel(providerLabel: string): AiUsageKind {
  if (providerLabel === 'radarzap-basic-triage') return 'basic_triage';
  return 'premium_assistant';
}

export interface AiUsageKindTotals {
  calls: number;
  tokens: number;
  cost: number;
  /** Créditos RadarZap (ponderados). */
  credits: number;
}

export type AiUsageTotalsByKind = Record<AiUsageKind, AiUsageKindTotals>;

export function emptyUsageTotalsByKind(): AiUsageTotalsByKind {
  return {
    premium_assistant: { calls: 0, tokens: 0, cost: 0, credits: 0 },
    basic_triage: { calls: 0, tokens: 0, cost: 0, credits: 0 },
    unknown: { calls: 0, tokens: 0, cost: 0, credits: 0 },
  };
}
