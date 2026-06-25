import type { AiWalletSnapshot } from './ai-wallet';

export type AiCreditUsageLevel = 'ok' | 'warning_80' | 'warning_90' | 'exhausted';

export interface AiCreditUsageSnapshot {
  used: number;
  allowance: number;
  ratio: number;
  level: AiCreditUsageLevel;
  depleted: boolean;
}

/** Percentual de uso da franquia mensal (0–1). */
export function resolveAiCreditUsageLevel(
  wallet: Pick<AiWalletSnapshot, 'usedThisMonth' | 'totalAllowance' | 'depleted'>,
): AiCreditUsageSnapshot {
  const allowance = Math.max(0, wallet.totalAllowance);
  const used = Math.max(0, wallet.usedThisMonth);
  const ratio = allowance > 0 ? used / allowance : used > 0 ? 1 : 0;
  const depleted = wallet.depleted || (allowance > 0 && used >= allowance);

  let level: AiCreditUsageLevel = 'ok';
  if (depleted || ratio >= 1) {
    level = 'exhausted';
  } else if (ratio >= 0.9) {
    level = 'warning_90';
  } else if (ratio >= 0.8) {
    level = 'warning_80';
  }

  return { used, allowance, ratio, level, depleted };
}

/** Evita spam de alertas — só emite quando o nível sobe. */
export function shouldEmitAiCreditAlert(
  previous: AiCreditUsageLevel | null | undefined,
  current: AiCreditUsageLevel,
): boolean {
  const rank: Record<AiCreditUsageLevel, number> = {
    ok: 0,
    warning_80: 1,
    warning_90: 2,
    exhausted: 3,
  };
  if (current === 'ok') return false;
  if (!previous || previous === 'ok') return true;
  return rank[current] > rank[previous];
}

export function buildAiCreditAlertMessage(
  level: AiCreditUsageLevel,
  snapshot: AiCreditUsageSnapshot,
): { title: string; body: string } {
  const usedLabel = Math.round(snapshot.used * 100) / 100;
  const allowanceLabel = snapshot.allowance;

  if (level === 'exhausted') {
    return {
      title: 'Saldo de IA esgotado',
      body:
        'IA pausada por falta de créditos. O atendimento foi encaminhado para a equipe. Recarregue em Planos ou configure API própria.',
    };
  }
  if (level === 'warning_90') {
    return {
      title: 'Saldo de IA crítico',
      body: `${usedLabel}/${allowanceLabel} créditos usados este mês (≥90%). Considere recarga ou upgrade.`,
    };
  }
  return {
    title: 'Saldo de IA baixo',
    body: `${usedLabel}/${allowanceLabel} créditos usados este mês (≥80%).`,
  };
}
