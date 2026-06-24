/** Saldo mensal de créditos IA e cota de aprendizagem por plano. */
export interface AiWalletPlanLimits {
  /** Créditos IA incluídos no plano (renovam todo mês). */
  monthlyCreditsIncluded: number;
  /** Operações de aprendizagem (skill/memória) incluídas no mês. */
  monthlyLearningOps: number;
}

export function getAiWalletPlanLimits(plan: string): AiWalletPlanLimits {
  switch (plan) {
    case 'starter':
      return { monthlyCreditsIncluded: 400, monthlyLearningOps: 30 };
    case 'pro':
      return { monthlyCreditsIncluded: 2500, monthlyLearningOps: 120 };
    case 'enterprise':
      return { monthlyCreditsIncluded: 12000, monthlyLearningOps: 500 };
    default:
      return { monthlyCreditsIncluded: 0, monthlyLearningOps: 0 };
  }
}

export interface AiWalletSnapshot {
  monthlyIncluded: number;
  purchased: number;
  totalAllowance: number;
  usedThisMonth: number;
  balance: number;
  learningUsed: number;
  learningLimit: number;
  learningBalance: number;
  periodStart: string;
  depleted: boolean;
  learningDepleted: boolean;
  /** Ação sugerida quando saldo IA esgotado na chave RadarZap. */
  actionHint: 'recharge' | 'own_api' | null;
}

export function buildWalletDepletedReason(snapshot: Pick<AiWalletSnapshot, 'balance' | 'actionHint'>): string {
  if (snapshot.balance > 0) return '';
  return (
    'Saldo mensal de créditos IA esgotado. Recarregue em Planos e cobrança, compre créditos extras ' +
    'ou configure API própria em IA Atendimento → Provedor.'
  );
}

export function buildLearningDepletedReason(): string {
  return (
    'Cota mensal de aprendizagem (skills/memória) esgotada. Aguarde a renovação do ciclo ou faça upgrade do plano.'
  );
}
