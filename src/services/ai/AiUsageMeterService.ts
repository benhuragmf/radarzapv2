import mongoose from 'mongoose';
import { AiUsage } from '@/models/AiUsage';
import { Organization } from '@/models/Organization';
import { AiSettings, IAiSettings } from '@/models/AiSettings';
import { estimateTokenCostUsd } from '@/constants/ai-model-catalog';
import { getAiPlanLimits } from '@/types/ai-assistant';
import {
  aiUsageKindLabel,
  emptyUsageTotalsByKind,
  inferAiUsageKind,
  type AiUsageKind,
  type AiUsageTotalsByKind,
} from '@/types/ai-usage-kind';

export interface AiUsageLimitsSnapshot {
  dailyUsed: number;
  monthlyUsed: number;
  conversationUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
  perConversationLimit: number;
  allowed: boolean;
  reason?: string;
  /** Chamadas LLM hoje por modo (2.11.3+). */
  dailyByKind: Pick<AiUsageTotalsByKind, 'premium_assistant' | 'basic_triage'>;
}

export interface AiUsageRowDto {
  id: string;
  createdAt: string;
  provider: string;
  usageKind: AiUsageKind;
  usageKindLabel: string;
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

  private async countByKindSince(
    clientId: mongoose.Types.ObjectId,
    since: Date,
  ): Promise<Pick<AiUsageTotalsByKind, 'premium_assistant' | 'basic_triage'>> {
    const rows = await AiUsage.find({
      clientId,
      createdAt: { $gte: since },
    })
      .select('provider usageKind totalTokens estimatedCost')
      .lean();

    const out = {
      premium_assistant: { calls: 0, tokens: 0, cost: 0 },
      basic_triage: { calls: 0, tokens: 0, cost: 0 },
    };

    for (const row of rows) {
      const kind = inferAiUsageKind(String(row.provider), row.usageKind as AiUsageKind | undefined);
      if (kind !== 'premium_assistant' && kind !== 'basic_triage') continue;
      out[kind].calls += 1;
      out[kind].tokens += row.totalTokens ?? 0;
      out[kind].cost += row.estimatedCost ?? 0;
    }

    return out;
  }

  async getUsageSnapshot(
    clientId: string,
    conversationId?: string,
    settings?: IAiSettings | null,
  ): Promise<AiUsageLimitsSnapshot> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const cfg =
      settings ??
      (await AiSettings.findOne({ clientId: clientOid })) ??
      (await AiSettings.create({ clientId: clientOid }));

    const limits = await this.resolveLimits(clientId, cfg);
    const convOid = this.conversationOid(conversationId);
    const dayStart = this.startOfDay();
    const [dailyUsed, monthlyUsed, conversationUsed, dailyByKind] = await Promise.all([
      AiUsage.countDocuments({ clientId: clientOid, createdAt: { $gte: dayStart } }),
      AiUsage.countDocuments({ clientId: clientOid, createdAt: { $gte: this.startOfMonth() } }),
      convOid
        ? AiUsage.countDocuments({
            clientId: clientOid,
            conversationId: convOid,
          })
        : Promise.resolve(0),
      this.countByKindSince(clientOid, dayStart),
    ]);

    let allowed = true;
    let reason: string | undefined;
    if (limits.dailyLimit > 0 && dailyUsed >= limits.dailyLimit) {
      allowed = false;
      reason = 'Limite diário de IA atingido';
    } else if (limits.monthlyLimit > 0 && monthlyUsed >= limits.monthlyLimit) {
      allowed = false;
      reason = 'Limite mensal de IA atingido';
    } else if (
      convOid &&
      limits.perConversationLimit > 0 &&
      conversationUsed >= limits.perConversationLimit
    ) {
      allowed = false;
      reason = 'Limite de mensagens IA nesta conversa atingido';
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
      dailyByKind,
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
    await AiUsage.create({
      clientId: new mongoose.Types.ObjectId(params.clientId),
      conversationId: convOid,
      provider: params.provider,
      usageKind,
      llmModel: params.llmModel,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: total,
      estimatedCost:
        params.estimatedCost ?? this.estimateCost(params.llmModel, params.inputTokens, params.outputTokens),
    });
  }

  private estimateCost(model: string, input: number, output: number): number {
    return estimateTokenCostUsd(model, input, output);
  }

  private mapRow(row: {
    _id: mongoose.Types.ObjectId;
    provider: string;
    usageKind?: AiUsageKind;
    llmModel: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    createdAt?: Date;
    conversationId?: mongoose.Types.ObjectId;
  }): AiUsageRowDto {
    const usageKind = inferAiUsageKind(row.provider, row.usageKind);
    return {
      id: String(row._id),
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      provider: row.provider,
      usageKind,
      usageKindLabel: aiUsageKindLabel(usageKind),
      llmModel: row.llmModel,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      estimatedCost: row.estimatedCost,
      conversationId: row.conversationId ? String(row.conversationId) : undefined,
    };
  }

  private mergeKindTotals(
    rows: Array<{ _id: string; calls: number; tokens: number; cost: number }>,
  ): AiUsageTotalsByKind {
    const byKind = emptyUsageTotalsByKind();
    for (const row of rows) {
      const kind = inferAiUsageKind(String(row._id), row._id);
      byKind[kind].calls += row.calls;
      byKind[kind].tokens += row.tokens;
      byKind[kind].cost += row.cost;
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
        },
      },
    ]);

    const totalsBase = agg[0] ?? { calls: 0, tokens: 0, cost: 0 };
    const byKind = this.mergeKindTotals(
      kindAgg.map(k => ({
        _id: String(k._id) as AiUsageKind,
        calls: k.calls as number,
        tokens: k.tokens as number,
        cost: k.cost as number,
      })),
    );

    return {
      rows,
      totals: {
        calls: totalsBase.calls ?? 0,
        tokens: totalsBase.tokens ?? 0,
        cost: totalsBase.cost ?? 0,
        byKind,
      },
    };
  }
}
