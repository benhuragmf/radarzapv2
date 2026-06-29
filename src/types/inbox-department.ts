/** Setores públicos (menu WhatsApp) usam rank 0. Internos começam em 2 (2ª instância). */
export const INBOX_INTERNAL_RANK_MIN = 2;

/** Como o atendente recebe alertas de bridge WhatsApp (!assumir) neste setor. */
export type InboxDepartmentBridgeHoursMode = 'always' | 'business_hours' | 'never';

export interface InboxDepartmentMemberConfig {
  userId: string;
  whatsappBridgeEnabled: boolean;
  bridgeHoursMode: InboxDepartmentBridgeHoursMode;
}

export const DEFAULT_DEPARTMENT_MEMBER_BRIDGE: Omit<
  InboxDepartmentMemberConfig,
  'userId'
> = {
  whatsappBridgeEnabled: true,
  bridgeHoursMode: 'always',
};

export function normalizeDepartmentMemberConfigs(
  memberUserIds: string[],
  raw?: Array<Partial<InboxDepartmentMemberConfig> & { userId?: string }> | null,
): InboxDepartmentMemberConfig[] {
  const allowed = new Set(memberUserIds.map(String));
  const byUser = new Map<string, InboxDepartmentMemberConfig>();

  for (const row of raw ?? []) {
    const userId = row.userId?.trim();
    if (!userId || !allowed.has(userId)) continue;
    byUser.set(userId, {
      userId,
      whatsappBridgeEnabled: row.whatsappBridgeEnabled !== false,
      bridgeHoursMode:
        row.bridgeHoursMode === 'never' ||
        row.bridgeHoursMode === 'business_hours' ||
        row.bridgeHoursMode === 'always'
          ? row.bridgeHoursMode
          : DEFAULT_DEPARTMENT_MEMBER_BRIDGE.bridgeHoursMode,
    });
  }

  return memberUserIds.map(userId => {
    const existing = byUser.get(userId);
    if (existing) return existing;
    return { userId, ...DEFAULT_DEPARTMENT_MEMBER_BRIDGE };
  });
}

export function departmentInternalRank(dept: {
  clientVisible?: boolean;
  internalRank?: number;
}): number {
  if (dept.clientVisible !== false) return 0;
  const raw = dept.internalRank ?? INBOX_INTERNAL_RANK_MIN;
  return Math.max(INBOX_INTERNAL_RANK_MIN, raw);
}

export function formatInternalRankLabel(rank: number): string {
  if (rank <= 0) return 'Público';
  return `${rank}ª instância`;
}

/** Opções de ranking para setores internos no painel */
export const INBOX_INTERNAL_RANK_OPTIONS = [2, 3, 4, 5] as const;
