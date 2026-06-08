/** Setores públicos (menu WhatsApp) usam rank 0. Internos começam em 2 (2ª instância). */
export const INBOX_INTERNAL_RANK_MIN = 2;

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
