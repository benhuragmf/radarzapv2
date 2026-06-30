import type { IOrganization } from '@/models/Organization';

export function isDiscordInboundEnabled(
  org: Pick<IOrganization, 'discordSettings'> | null | undefined,
): boolean {
  return Boolean(org?.discordSettings?.inboundEnabled);
}

export function normalizeDiscordInboundInput(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}
