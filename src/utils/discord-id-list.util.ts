/** Lista de snowflakes Discord (cargos, usuários, bots). */
export function parseDiscordIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(
      raw
        .map((id) => String(id).trim())
        .filter((id) => /^\d{17,19}$/.test(id)),
    )];
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [...new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^\d{17,19}$/.test(id)),
    )];
  }
  return [];
}

export function memberHasAnyRole(
  userRoleIds: string[] | undefined,
  requiredRoleIds: string[],
): boolean {
  if (!requiredRoleIds.length) return true;
  if (!userRoleIds?.length) return false;
  return requiredRoleIds.some((id) => userRoleIds.includes(id));
}
