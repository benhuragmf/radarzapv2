import mongoose from 'mongoose';
import { AiUsage } from '@/models/AiUsage';
import { Organization } from '@/models/Organization';
import { AiSettings, IAiSettings } from '@/models/AiSettings';
import { estimateTokenCostUsd } from '@/constants/ai-model-catalog';
import { getAiPlanLimits } from '@/types/ai-assistant';
import {
  AI_CREDIT_USD_UNIT,
  AI_MODULE_CREDIT_ESTIMATE,
  aiCreditsDebitForCall,
  inferCreditsFromRow,
  isRadarzapPlatformProvider,
} from '@/types/ai-credits';
import {
  aiUsageKindLabel,
  emptyUsageTotalsByKind,
  inferAiUsageKind,
  type AiUsageKind,
  type AiUsageTotalsByKind,
} from '@/types/ai-usage-kind';
import { AiWalletService } from './AiWalletService';
import type { AiWalletSnapshot } from '@/types/ai-wallet';
import { buildAiUsageMetadata, recordAiCreditAttendanceEvent } from '@/types/ai-wallet';

export interface AiUsageLimitsSnapshot {
  /** Chamadas LLM RadarZap hoje (1 chamada = 1 unidade no limite do plano). */
  dailyUsed: number;
  monthlyUsed: number;
  conversationUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
  perConversationLimit: number;
  allowed: boolean;
  reason?: string;
  /** Créditos gastos (custo real proporcional) — cobrança por cliente. */
  dailyCreditsSpent: number;
  monthlyCreditsSpent: number;
  dailyByKind: Pick<AiUsageTotalsByKind, 'premium_assistant' | 'basic_triage'>;
  dailyCreditsByKind: Pick<AiUsageTotalsByKind, 'premium_assistant' | 'basic_triage'>;
  companyCallsToday: number;
  /** Expectativa por módulo — só planejamento na UI (não multiplica cobrança). */
  moduleCreditEstimates: typeof AI_MODULE_CREDIT_ESTIMATE;
  meteringMode: 'radarzap_calls' | 'company_calls';
  wallet: AiWalletSnapshot;
}

export interface AiUsageRowDto {
  id: string;
  createdAt: string;
  provider: string;
  usageKind: AiUsageKind;
  usageKindLabel: string;
  creditWeight: number;
  llmModel: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  conversationId?: string;
}

export interface AiUsageListResult {
  rows: AiUsageRowDto[];
  totals: {
    calls: number;
    tokens: number;
    cost: number;
    credits: number;
    byKind: AiUsageTotalsByKind;
  };
}

export class AiUsageMeterService {
  private static instance: AiUsageMeterService;

  static getInstance(): AiUsageMeterService {
    if (!this.instance) this.instance = new AiUsageMeterService();
    return this.instance;
  }

  private startOfDay(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async resolveLimits(clientId: string, settings: IAiSettings): Promise<{
    dailyLimit: number;
    monthlyLimit: number;
    perConversationLimit: number;
  }> {
    if (settings.mode === 'company') {
      return {
        dailyLimit: settings.dailyLimit,
        monthlyLimit: settings.monthlyLimit,
        perConversationLimit: settings.perConversationLimit,
      };
    }
    const org = await Organization.findById(clientId).select('plan').lean();
    const planLimits = getAiPlanLimits(org?.plan ?? 'free');
    return {
      dailyLimit: Math.min(settings.dailyLimit || planLimits.dailyLimit, planLimits.dailyLimit),
      monthlyLimit: Math.min(settings.monthlyLimit || planLimits.monthlyLimit, planLimits.monthlyLimit),
      perConversationLimit: Math.min(
        settings.perConversationLimit || planLimits.perConversationLimit,
        planLimits.perConversationLimit,
      ),
    };
  }

  private conversationOid(id?: string): mongoose.Types.ObjectId | undefined {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return undefined;
    return new mongoose.Types.ObjectId(id);
  }

  private meteringModeFor(settings: IAiSettings): 'radarzap_calls' | 'company_calls' {
    if (settings.mode === 'company') return 'company_calls';
    return 'radarzap_calls';
  }

  private async aggregateSince(
    clientId: mongoose.Types.ObjectId,
    since: Date,
  ): Promise<{
    radarzapCalls: number;
    creditsSpent: number;
    companyCalls: number;
    byKind: Pick<AiUsageTotalsByKind, 'premium_assistant' | 'basic_triage'>;
  }> {
    const rows = await AiUsage.find({
      clientId,
      createdAt: { $gte: since },
    })
      .select('provider usageKind creditWeight totalTokens estimatedCost')
      .lean();

    const byKind = {
      premium_assistant: { calls: 0, tokens: 0, cost: 0, credits: 0 },
      basic_triage: { calls: 0, tokens: 0, cost: 0, credits: 0 },
    };

    let radarzapCalls = 0;
    let creditsSpent = 0;
    let companyCalls = 0;

    for (const row of rows) {
      const provider = String(row.provider);
      const kind = inferAiUsageKind(provider, row.usageKind as AiUsageKind | undefined);
      const credits = inferCreditsFromRow({
        provider,
        usageKind: kind,
        creditWeight: row.creditWeight,
        estimatedCost: row.estimatedCost,
      });

      if (isRadarzapPlatformProvider(provider)) {
        radarzapCalls += 1;
        creditsSpent += credits;
      } else {
        companyCalls += 1;
      }

      if (kind === 'premium_assistant' || kind === 'basic_triage') {
        byKind[kind].calls += 1;
        byKind[kind].tokens += row.totalTokens ?? 0;
        byKind[kind].cost += row.estimatedCost ?? 0;
        byKind[kind].credits += credits;
      }
    }

    return { radarzapCalls, creditsSpent, companyCalls, byKind };
  }

  async getUsageSnapshot(
    clientId: string,
    conversationId?: string,
    settings?: IAiSettings | null,
    opts?: {
      pendingCalls?: number;
      pendingCredits?: number;
      meteringOverride?: 'radarzap_calls' | 'company_calls';
    },
  ): Promise<AiUsageLimitsSnapshot> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const cfg =
      settings ??
      (await AiSettings.findOne({ clientId: clientOid })) ??
      (await AiSettings.create({ clientId: clientOid }));

    const limits = await this.resolveLimits(clientId, cfg);
    const convOid = this.conversationOid(conversationId);
    const dayStart = this.startOfDay();
    const pending = Math.max(0, opts?.pendingCalls ?? 0);
    const pendingCredits = Math.max(0, opts?.pendingCredits ?? 0);

    const [dailyAgg, monthlyAgg, conversationUsed] = await Promise.all([
      this.aggregateSince(clientOid, dayStart),
      this.aggregateSince(clientOid, this.startOfMonth()),
      convOid
        ? AiUsage.countDocuments({
            clientId: clientOid,
            conversationId: convOid,
          })
        : Promise.resolve(0),
    ]);

    const meteringMode = opts?.meteringOverride ?? this.meteringModeFor(cfg);
    const dailyUsed =
      meteringMode === 'company_calls' ? dailyAgg.companyCalls : dailyAgg.radarzapCalls;
    const monthlyUsed =
      meteringMode === 'company_calls' ? monthlyAgg.companyCalls : monthlyAgg.radarzapCalls;

    let allowed = true;
    let reason: string | undefined;
    if (limits.dailyLimit > 0 && dailyUsed + pending > limits.dailyLimit) {
      allowed = false;
      reason =
        meteringMode === 'company_calls'
          ? 'Limite diário de chamadas IA (chave própria) atingido'
          : 'Limite diário de chamadas IA RadarZap atingido';
    } else if (limits.monthlyLimit > 0 && monthlyUsed + pending > limits.monthlyLimit) {
      allowed = false;
      reason =
        meteringMode === 'company_calls'
          ? 'Limite mensal de chamadas IA (chave própria) atingido'
          : 'Limite mensal de chamadas IA RadarZap atingido';
    } else if (
      convOid &&
      limits.perConversationLimit > 0 &&
      conversationUsed >= limits.perConversationLimit
    ) {
      allowed = false;
      reason = 'Limite de mensagens IA nesta conversa atingido';
    }

    const walletSnapshot = await AiWalletService.getInstance().getSnapshot(
      clientId,
      monthlyAgg.creditsSpent,
    );

    const usesRadarzapWallet =
      meteringMode === 'radarzap_calls' || opts?.meteringOverride === 'radarzap_calls';
    if (allowed && usesRadarzapWallet) {
      const walletCheck = AiWalletService.getInstance().canSpendLlmCredits(
        walletSnapshot,
        pendingCredits > 0 ? pendingCredits : 0.01,
      );
      if (!walletCheck.allowed) {
        allowed = false;
        reason = walletCheck.reason;
      }
    }

    return {
      dailyUsed,
      monthlyUsed,
      conversationUsed,
      dailyLimit: limits.dailyLimit,
      monthlyLimit: limits.monthlyLimit,
      perConversationLimit: limits.perConversationLimit,
      allowed,
      reason,
      dailyCreditsSpent: dailyAgg.creditsSpent,
      monthlyCreditsSpent: monthlyAgg.creditsSpent,
      dailyByKind: dailyAgg.byKind,
      dailyCreditsByKind: dailyAgg.byKind,
      companyCallsToday: dailyAgg.companyCalls,
      moduleCreditEstimates: AI_MODULE_CREDIT_ESTIMATE,
      meteringMode,
      wallet: walletSnapshot,
    };
  }

  async recordUsage(params: {
    clientId: string;
    conversationId?: string;
    provider: string;
    llmModel: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost?: number;
    usageKind?: AiUsageKind;
  }): Promise<void> {
    const total = params.inputTokens + params.outputTokens;
    const convOid = this.conversationOid(params.conversationId);
    const usageKind = params.usageKind ?? inferAiUsageKind(params.provider);
    const estimatedCost =
      params.estimatedCost ?? this.estimateCost(params.llmModel, params.inputTokens, params.outputTokens);
    const creditWeight = aiCreditsDebitForCall({
      provider: params.provider,
      estimatedCostUsd: estimatedCost,
    });
    await AiUsage.create({
      clientId: new mongoose.Types.ObjectId(params.clientId),
      conversationId: convOid,
      provider: params.provider,
      usageKind,
      creditWeight,
      llmModel: params.llmModel,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: total,
      estimatedCost,
    });
    if (isRadarzapPlatformProvider(params.provider) && creditWeight > 0) {
      void recordAiCreditAttendanceEvent({
        clientId: params.clientId,
        kind: 'ai.credits.consumed',
        conversationId: params.conversationId,
        meta: buildAiUsageMetadata({
          channel: 'unknown',
          provider: params.provider,
          usageKind,
        }),
      });
    }
  }

  private estimateCost(model: string, input: number, output: number): number {
    return estimateTokenCostUsd(model, input, output);
  }

  private mapRow(row: {
    _id: mongoose.Types.ObjectId;
    provider: string;
    usageKind?: AiUsageKind;
    creditWeight?: number;
    llmModel: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    createdAt?: Date;
    conversationId?: mongoose.Types.ObjectId;
  }): AiUsageRowDto {
    const usageKind = inferAiUsageKind(row.provider, row.usageKind);
    const creditWeight = inferCreditsFromRow({
      provider: row.provider,
      usageKind,
      creditWeight: row.creditWeight,
      estimatedCost: row.estimatedCost,
    });
    return {
      id: String(row._id),
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      provider: row.provider,
      usageKind,
      usageKindLabel: aiUsageKindLabel(usageKind),
      creditWeight,
      llmModel: row.llmModel,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      estimatedCost: row.estimatedCost,
      conversationId: row.conversationId ? String(row.conversationId) : undefined,
    };
  }

  private mergeKindTotals(
    rows: Array<{ _id: string; calls: number; tokens: number; cost: number; credits?: number }>,
  ): AiUsageTotalsByKind {
    const byKind = emptyUsageTotalsByKind();
    for (const row of rows) {
      const kind = inferAiUsageKind(String(row._id), row._id);
      byKind[kind].calls += row.calls;
      byKind[kind].tokens += row.tokens;
      byKind[kind].cost += row.cost;
      byKind[kind].credits += row.credits ?? 0;
    }
    return byKind;
  }

  async listUsage(
    clientId: string,
    opts?: { from?: Date; to?: Date; limit?: number },
  ): Promise<AiUsageListResult> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const filter: Record<string, unknown> = { clientId: clientOid };
    if (opts?.from || opts?.to) {
      filter.createdAt = {};
      if (opts.from) (filter.createdAt as Record<string, Date>).$gte = opts.from;
      if (opts.to) (filter.createdAt as Record<string, Date>).$lte = opts.to;
    }
    const limit = Math.min(opts?.limit ?? 100, 500);
    const rawRows = await AiUsage.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const rows = rawRows.map(r =>
      this.mapRow({
        _id: r._id as mongoose.Types.ObjectId,
        provider: String(r.provider),
        usageKind: r.usageKind as AiUsageKind | undefined,
        creditWeight: r.creditWeight,
        llmModel: r.llmModel,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        totalTokens: r.totalTokens,
        estimatedCost: r.estimatedCost,
        createdAt: r.createdAt,
        conversationId: r.conversationId as mongoose.Types.ObjectId | undefined,
      }),
    );

    const agg = await AiUsage.aggregate([
      { $match: filter },
      {
        $addFields: {
          resolvedKind: {
            $ifNull: [
              '$usageKind',
              {
                $cond: [
                  { $eq: ['$provider', 'radarzap-basic-triage'] },
                  'basic_triage',
                  'premium_assistant',
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          calls: { $sum: 1 },
          tokens: { $sum: '$totalTokens' },
          cost: { $sum: '$estimatedCost' },
          credits: {
            $sum: {
              $cond: [
                {
                  $in: ['$provider', ['radarzap', 'radarzap-basic-triage']],
                },
                {
                  $ifNull: [
                    '$creditWeight',
                    {
                      $round: [
                        { $divide: ['$estimatedCost', AI_CREDIT_USD_UNIT] },
                        2,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]);

    const kindAgg = await AiUsage.aggregate([
      { $match: filter },
      {
        $addFields: {
          resolvedKind: {
            $ifNull: [
              '$usageKind',
              {
                $cond: [
                  { $eq: ['$provider', 'radarzap-basic-triage'] },
                  'basic_triage',
                  'premium_assistant',
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: '$resolvedKind',
          calls: { $sum: 1 },
          tokens: { $sum: '$totalTokens' },
          cost: { $sum: '$estimatedCost' },
          credits: {
            $sum: {
              $cond: [
                {
                  $in: ['$provider', ['radarzap', 'radarzap-basic-triage']],
                },
                {
                  $ifNull: [
                    '$creditWeight',
                    {
                      $round: [
                        { $divide: ['$estimatedCost', AI_CREDIT_USD_UNIT] },
                        2,
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalsBase = agg[0] ?? { calls: 0, tokens: 0, cost: 0, credits: 0 };
    const byKind = this.mergeKindTotals(
      kindAgg.map(k => ({
        _id: String(k._id) as AiUsageKind,
        calls: k.calls as number,
        tokens: k.tokens as number,
        cost: k.cost as number,
        credits: k.credits as number,
      })),
    );

    return {
      rows,
      totals: {
        calls: totalsBase.calls ?? 0,
        tokens: totalsBase.tokens ?? 0,
        cost: totalsBase.cost ?? 0,
        credits: totalsBase.credits ?? 0,
        byKind,
      },
    };
  }
}
