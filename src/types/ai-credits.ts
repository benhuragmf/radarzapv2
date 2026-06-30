import type { AiUsageKind } from './ai-usage-kind';
import { inferAiUsageKind } from './ai-usage-kind';

/**
 * Expectativa de consumo por módulo — só para projeção na UI ao escolher o modo.
 * Não multiplica cobrança: Premium não é "mais caro" por chamada.
 */
export const AI_MODULE_CREDIT_ESTIMATE = {
  basic_triage: 1,
  premium_assistant: 2,
} as const;

/** @deprecated use AI_MODULE_CREDIT_ESTIMATE — alias legado */
export const AI_CREDIT_WEIGHT = AI_MODULE_CREDIT_ESTIMATE;

export type AiBillableKind = keyof typeof AI_MODULE_CREDIT_ESTIMATE;

/** 1 crédito Radar Chat ≈ este custo estimado (USD) de LLM na chave da plataforma. */
export const AI_CREDIT_USD_UNIT = 0.01;

export function isRadarchatPlatformProvider(provider: string): boolean {
  const normalized = provider.replace(/^radarzap/i, 'radarchat');
  return normalized === 'radarchat' || normalized === 'radarchat-basic-triage';
}

/** Créditos debitados com base no custo real da chamada (cobrança proporcional). */
export function aiCreditsFromActualCost(estimatedCostUsd: number): number {
  if (estimatedCostUsd <= 0) return 0;
  return Math.round((estimatedCostUsd / AI_CREDIT_USD_UNIT) * 100) / 100;
}

/** Expectativa típica por módulo — apenas UI/planejamento. */
export function aiModuleCreditEstimate(kind: AiBillableKind): number {
  return AI_MODULE_CREDIT_ESTIMATE[kind];
}

/** Créditos reais debitados — 0 quando a empresa usa chave própria. */
export function aiCreditsDebitForCall(params: {
  provider: string;
  estimatedCostUsd: number;
  storedCredits?: number | null;
}): number {
  if (typeof params.storedCredits === 'number' && params.storedCredits >= 0) {
    return params.storedCredits;
  }
  if (!isRadarchatPlatformProvider(params.provider)) return 0;
  return aiCreditsFromActualCost(params.estimatedCostUsd);
}

export function inferCreditsFromRow(row: {
  provider: string;
  usageKind?: AiUsageKind | null;
  creditWeight?: number | null;
  estimatedCost?: number | null;
}): number {
  inferAiUsageKind(row.provider, row.usageKind);
  return aiCreditsDebitForCall({
    provider: row.provider,
    estimatedCostUsd: row.estimatedCost ?? 0,
    storedCredits: row.creditWeight,
  });
}

/** @deprecated use aiCreditsDebitForCall */
export function aiCreditWeightFor(
  usageKind: AiUsageKind,
  provider: string,
  storedWeight?: number | null,
  estimatedCostUsd = 0,
): number {
  void usageKind;
  return aiCreditsDebitForCall({
    provider,
    estimatedCostUsd,
    storedCredits: storedWeight,
  });
}

/** @deprecated use inferCreditsFromRow */
export function inferCreditWeightFromRow(row: {
  provider: string;
  usageKind?: AiUsageKind | null;
  creditWeight?: number | null;
  estimatedCost?: number | null;
}): number {
  return inferCreditsFromRow(row);
}

export function aiCreditWeightLabel(credits: number): string {
  if (credits <= 0) return 'Sem crédito Radar Chat';
  if (credits < 0.1) return `${credits.toFixed(2)} crédito`;
  if (credits === 1) return '1 crédito';
  return `${credits.toFixed(2)} créditos`;
}

export function aiCreditKindShortLabel(kind: AiBillableKind): string {
  return kind === 'basic_triage' ? 'IA Básica' : 'IA Premium';
}

export function aiModuleEstimateLabel(kind: AiBillableKind): string {
  const n = AI_MODULE_CREDIT_ESTIMATE[kind];
  return `~${n} crédito${n > 1 ? 's' : ''}/atendimento típico`;
}
