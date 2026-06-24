import { PlanConfigService } from '@/services/billing/plan-config';

/** Saldo mensal de créditos IA e cota de aprendizagem por plano. */
export interface AiWalletPlanLimits {
  /** Créditos IA incluídos no plano (renovam todo mês). */
  monthlyCreditsIncluded: number;
  /** Operações de aprendizagem (skill/memória) incluídas no mês. */
  monthlyLearningOps: number;
}

export function getAiWalletPlanLimits(plan: string): AiWalletPlanLimits {
  const commercial = PlanConfigService.getInstance().getCommercialLimits(plan);
  if (commercial) {
    return {
      monthlyCreditsIncluded: commercial.aiCreditsMonthly,
      monthlyLearningOps: commercial.monthlyLearningOps,
    };
  }
  return { monthlyCreditsIncluded: 0, monthlyLearningOps: 0 };
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
