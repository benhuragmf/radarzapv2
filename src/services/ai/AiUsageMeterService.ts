import mongoose from 'mongoose';
import { AiUsage } from '@/models/AiUsage';
import { Organization } from '@/models/Organization';
import { AiSettings, IAiSettings } from '@/models/AiSettings';
import { estimateTokenCostUsd } from '@/constants/ai-model-catalog';
import { getAiPlanLimits } from '@/types/ai-assistant';

export interface AiUsageLimitsSnapshot {
  dailyUsed: number;
  monthlyUsed: number;
  conversationUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
  perConversationLimit: number;
  allowed: boolean;
  reason?: string;
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
    const [dailyUsed, monthlyUsed, conversationUsed] = await Promise.all([
      AiUsage.countDocuments({ clientId: clientOid, createdAt: { $gte: this.startOfDay() } }),
      AiUsage.countDocuments({ clientId: clientOid, createdAt: { $gte: this.startOfMonth() } }),
      conversationId
        ? AiUsage.countDocuments({
            clientId: clientOid,
            conversationId: new mongoose.Types.ObjectId(conversationId),
          })
        : Promise.resolve(0),
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
      conversationId &&
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
  }): Promise<void> {
    const total = params.inputTokens + params.outputTokens;
    await AiUsage.create({
      clientId: new mongoose.Types.ObjectId(params.clientId),
      conversationId: params.conversationId
        ? new mongoose.Types.ObjectId(params.conversationId)
        : undefined,
      provider: params.provider,
      llmModel: params.llmModel,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: total,
      estimatedCost: params.estimatedCost ?? this.estimateCost(params.llmModel, params.inputTokens, params.outputTokens),
    });
  }

  private estimateCost(model: string, input: number, output: number): number {
    return estimateTokenCostUsd(model, input, output);
  }

  async listUsage(
    clientId: string,
    opts?: { from?: Date; to?: Date; limit?: number },
  ): Promise<{ rows: unknown[]; totals: { calls: number; tokens: number; cost: number } }> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const filter: Record<string, unknown> = { clientId: clientOid };
    if (opts?.from || opts?.to) {
      filter.createdAt = {};
      if (opts.from) (filter.createdAt as Record<string, Date>).$gte = opts.from;
      if (opts.to) (filter.createdAt as Record<string, Date>).$lte = opts.to;
    }
    const limit = Math.min(opts?.limit ?? 100, 500);
    const rows = await AiUsage.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const agg = await AiUsage.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          calls: { $sum: 1 },
          tokens: { $sum: '$totalTokens' },
          cost: { $sum: '$estimatedCost' },
        },
      },
    ]);
    const totals = agg[0] ?? { calls: 0, tokens: 0, cost: 0 };
    return { rows, totals };
  }
}
