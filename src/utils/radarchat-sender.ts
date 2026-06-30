import { config } from '@/config/environment';
import type { IOrganization } from '@/models/Organization';
import type { IUser } from '@/models/User';

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Nomes gerados na migração/legado — não usar no rodapé se houver conta real. */
export function isGenericOrganizationName(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (/^empresa\s+[a-f0-9]{4,12}$/i.test(t)) return true;
  if (/^minha\s+empresa$/i.test(t)) return true;
  return false;
}

/** Nome global ou username Discord (API do bot) — nunca apelido de servidor. */
export async function fetchDiscordAccountName(discordUserId: string): Promise<string | undefined> {
  if (!discordUserId || !config.DISCORD.TOKEN) return undefined;

  try {
    const res = await fetch(`https://discord.com/api/v10/users/${discordUserId}`, {
      headers: { Authorization: `Bot ${config.DISCORD.TOKEN}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { global_name?: string | null; username?: string };
    const name = data.global_name?.trim() || data.username?.trim();
    return name || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remetente no rodapé: conta/empresa do painel Radar Chat.
 * Prioridade: org com nome real → displayName (Google/painel) → Discord da conta.
 */
export function resolveTenantSenderLabel(
  org: Pick<IOrganization, 'name'> | null | undefined,
  user: Pick<IUser, 'displayName' | 'email' | 'discordUserId'> | null | undefined,
  discordAccountName?: string | null
): string {
  if (org?.name?.trim() && !isGenericOrganizationName(org.name)) {
    return normalizeLabel(org.name);
  }

  if (user?.displayName?.trim()) {
    return normalizeLabel(user.displayName);
  }

  if (discordAccountName?.trim()) {
    return normalizeLabel(discordAccountName);
  }

  const emailLocal = user?.email?.split('@')[0]?.trim();
  if (emailLocal) return normalizeLabel(emailLocal);

  if (org?.name?.trim()) return normalizeLabel(org.name);

  return 'radarchat';
}

export async function resolveTenantSenderLabelAsync(
  org: IOrganization | null | undefined,
  user: IUser | null | undefined
): Promise<string> {
  const discordName = user?.discordUserId
    ? await fetchDiscordAccountName(user.discordUserId)
    : undefined;
  const label = resolveTenantSenderLabel(org, user, discordName);

  if (
    org &&
    isGenericOrganizationName(org.name) &&
    label !== 'radarchat' &&
    !isGenericOrganizationName(label)
  ) {
    try {
      org.name = label;
      await org.save();
    } catch {
      /* não bloquear envio */
    }
  }

  return label;
}
