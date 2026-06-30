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
  /** Ação sugerida quando saldo IA esgotado na chave Radar Chat. */
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

/** Mensagem segura ao cliente quando IA externa está bloqueada por créditos. */
export const AI_CREDITS_CLIENT_FALLBACK_MESSAGE =
  'Vou encaminhar você para um atendente continuar o atendimento.';

/** Motivo interno (painel/logs) — não enviar ao visitante/contato. */
export const AI_CREDITS_INTERNAL_BLOCKED_REASON =
  'IA pausada por falta de créditos. O atendimento foi encaminhado para a equipe.';

export function resolveAiWalletBalance(
  snapshot: Pick<AiWalletSnapshot, 'balance' | 'totalAllowance' | 'usedThisMonth'>,
): number {
  return Math.max(0, Math.round(snapshot.balance * 100) / 100);
}

export function canConsumeAiCredits(
  wallet: Pick<AiWalletSnapshot, 'balance' | 'totalAllowance' | 'usedThisMonth' | 'depleted'>,
  cost: number,
): { allowed: boolean; reason?: string } {
  const pending = Math.max(0, cost);
  if (wallet.totalAllowance <= 0 && wallet.usedThisMonth <= 0) {
    return {
      allowed: false,
      reason:
        'Créditos IA não disponíveis no plano Free. Faça upgrade, compre créditos ou use API própria.',
    };
  }
  if (wallet.depleted || resolveAiWalletBalance(wallet) < pending) {
    return { allowed: false, reason: AI_CREDITS_INTERNAL_BLOCKED_REASON };
  }
  return { allowed: true };
}

export interface AiUsageMetadataInput {
  channel: 'webchat' | 'whatsapp' | 'panel' | 'unknown';
  attendanceMode?: string;
  provider?: string;
  usageKind?: string;
  blocked?: boolean;
}

export function buildAiUsageMetadata(input: AiUsageMetadataInput): Record<string, unknown> {
  const meta: Record<string, unknown> = { channel: input.channel };
  if (input.attendanceMode) meta.attendanceMode = input.attendanceMode;
  if (input.provider) meta.provider = input.provider;
  if (input.usageKind) meta.usageKind = input.usageKind;
  if (input.blocked) meta.blocked = true;
  return meta;
}

export type AiCreditAuditKind =
  | 'ai.credits.checked'
  | 'ai.credits.consumed'
  | 'ai.credits.blocked'
  | 'ai.credits.low_balance'
  | 'ai.credits.exhausted'
  | 'ai.credits.adjusted'
  | 'ai.credits.monthly_reset';

export async function recordAiCreditAttendanceEvent(input: {
  clientId: string;
  kind: AiCreditAuditKind;
  conversationId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const { recordAttendanceEvent } = await import(
    '@/services/attendance/attendance-audit.service'
  );
  await recordAttendanceEvent({
    clientId: input.clientId,
    kind: input.kind,
    conversationId: input.conversationId,
    meta: input.meta,
  });
}
