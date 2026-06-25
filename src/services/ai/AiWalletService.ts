import mongoose from 'mongoose';
import { Organization } from '@/models/Organization';
import {
  buildLearningDepletedReason,
  getAiWalletPlanLimits,
  canConsumeAiCredits,
  recordAiCreditAttendanceEvent,
  type AiWalletSnapshot,
} from '@/types/ai-wallet';

export class AiWalletService {
  private static instance: AiWalletService;

  static getInstance(): AiWalletService {
    if (!this.instance) this.instance = new AiWalletService();
    return this.instance;
  }

  private startOfMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Zera contadores de aprendizagem se o ciclo mensal virou. */
  async ensureMonthlyPeriod(clientId: string): Promise<void> {
    const monthStart = this.startOfMonth();
    const org = await Organization.findById(clientId).select('aiWallet').lean();
    const periodStart = org?.aiWallet?.periodStart
      ? new Date(org.aiWallet.periodStart)
      : monthStart;
    if (periodStart >= monthStart) return;

    await Organization.updateOne(
      { _id: new mongoose.Types.ObjectId(clientId) },
      {
        $set: {
          'aiWallet.periodStart': monthStart,
          'aiWallet.learningOpsUsed': 0,
        },
      },
    );
    void recordAiCreditAttendanceEvent({
      clientId,
      kind: 'ai.credits.monthly_reset',
      meta: { periodStart: monthStart.toISOString() },
    });
  }

  async getSnapshot(clientId: string, creditsUsedThisMonth: number): Promise<AiWalletSnapshot> {
    await this.ensureMonthlyPeriod(clientId);
    const org = await Organization.findById(clientId).select('plan aiWallet').lean();
    const plan = org?.plan ?? 'free';
    const limits = getAiWalletPlanLimits(plan);
    const purchased = org?.aiWallet?.purchasedCredits ?? 0;
    const learningUsed = org?.aiWallet?.learningOpsUsed ?? 0;
    const totalAllowance = limits.monthlyCreditsIncluded + purchased;
    const balance = Math.max(0, Math.round((totalAllowance - creditsUsedThisMonth) * 100) / 100);
    const learningBalance = Math.max(0, limits.monthlyLearningOps - learningUsed);
    const depleted = totalAllowance > 0 ? balance <= 0 : creditsUsedThisMonth > 0;
    const learningDepleted = limits.monthlyLearningOps > 0 && learningBalance <= 0;

    return {
      monthlyIncluded: limits.monthlyCreditsIncluded,
      purchased,
      totalAllowance,
      usedThisMonth: creditsUsedThisMonth,
      balance,
      learningUsed,
      learningLimit: limits.monthlyLearningOps,
      learningBalance,
      periodStart: (org?.aiWallet?.periodStart ?? this.startOfMonth()).toISOString(),
      depleted,
      learningDepleted,
      actionHint: depleted ? 'recharge' : null,
    };
  }

  canSpendLlmCredits(
    wallet: AiWalletSnapshot,
    pendingCredits: number,
  ): { allowed: boolean; reason?: string } {
    return canConsumeAiCredits(wallet, pendingCredits > 0 ? pendingCredits : 0.01);
  }

  canRunLearning(wallet: AiWalletSnapshot): { allowed: boolean; reason?: string } {
    if (wallet.learningLimit <= 0) {
      return {
        allowed: false,
        reason: 'Aprendizagem automática não incluída no plano atual.',
      };
    }
    if (wallet.learningDepleted) {
      return { allowed: false, reason: buildLearningDepletedReason() };
    }
    return { allowed: true };
  }

  async recordLearningOp(clientId: string, kind: 'skill' | 'memory'): Promise<void> {
    void kind;
    await this.ensureMonthlyPeriod(clientId);
    await Organization.updateOne(
      { _id: new mongoose.Types.ObjectId(clientId) },
      { $inc: { 'aiWallet.learningOpsUsed': 1 } },
    );
  }

  async addPurchasedCredits(clientId: string, amount: number): Promise<number> {
    if (amount <= 0) throw new Error('Quantidade inválida');
    await this.ensureMonthlyPeriod(clientId);
    const org = await Organization.findByIdAndUpdate(
      new mongoose.Types.ObjectId(clientId),
      { $inc: { 'aiWallet.purchasedCredits': amount } },
      { new: true },
    ).select('aiWallet.purchasedCredits');
    const total = org?.aiWallet?.purchasedCredits ?? amount;
    void recordAiCreditAttendanceEvent({
      clientId,
      kind: 'ai.credits.adjusted',
      meta: { delta: amount, purchasedTotal: total, source: 'manual_or_pack' },
    });
    return total;
  }
}
