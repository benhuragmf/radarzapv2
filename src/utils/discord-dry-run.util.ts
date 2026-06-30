import type { IOrganization } from '@/models/Organization';

export type DiscordSettingsSnapshot = {
  dryRun?: boolean;
  multiRulePerMessage?: boolean;
};

/** Máximo de regras aplicadas quando multi-regra está ativo. */
export const DISCORD_MULTI_RULE_MAX = 5;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function normalizeDiscordBooleanInput(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

/** @deprecated use normalizeDiscordBooleanInput */
export const normalizeDiscordDryRunInput = normalizeDiscordBooleanInput;

/** Modo simulação: captura + regras, sem enfileirar WhatsApp. */
export function isDiscordDryRunEnabled(
  org: Pick<IOrganization, 'discordSettings'> | null | undefined,
): boolean {
  return Boolean(org?.discordSettings?.dryRun);
}

/** Várias regras por captura (ordenadas por prioridade, até DISCORD_MULTI_RULE_MAX). */
export function isDiscordMultiRuleEnabled(
  org: Pick<IOrganization, 'discordSettings'> | null | undefined,
): boolean {
  return Boolean(org?.discordSettings?.multiRulePerMessage);
}

export function selectDiscordRuleMatches<T extends { priority: string }>(
  matches: T[],
  org: Pick<IOrganization, 'discordSettings'> | null | undefined,
): T[] {
  const sorted = [...matches].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
  );
  if (!sorted.length) return [];
  if (!isDiscordMultiRuleEnabled(org)) return [sorted[0]];
  return sorted.slice(0, DISCORD_MULTI_RULE_MAX);
}

/** Chave dedup WA — inclui ruleId quando multi-regra para permitir destinos repetidos com templates distintos. */
export function buildDiscordWaDedupSeed(input: {
  clientId: string;
  destinationId: string;
  eventId: string;
  ruleId?: string;
  multiRule: boolean;
}): string {
  const base = `${input.clientId}:${input.destinationId}:${input.eventId}`;
  return input.multiRule && input.ruleId ? `${base}:${input.ruleId}` : base;
}
