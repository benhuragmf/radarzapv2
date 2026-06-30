import mongoose from 'mongoose';
import { DiscordMonitorEvent, type DiscordMonitorEventStatus } from '@/models/DiscordMonitorEvent';
import type { DiscordEventPayload, DiscordMonitorType, DiscordRuleTrigger } from '@/types/discord-monitor';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('DiscordMonitorEventService');

export class DiscordMonitorEventService {
  private static instance: DiscordMonitorEventService;

  static getInstance(): DiscordMonitorEventService {
    if (!DiscordMonitorEventService.instance) {
      DiscordMonitorEventService.instance = new DiscordMonitorEventService();
    }
    return DiscordMonitorEventService.instance;
  }

  async recordCaptured(
    monitor: {
      _id: mongoose.Types.ObjectId;
      monitorType?: DiscordMonitorType;
    },
    payload: Omit<DiscordEventPayload, 'clientId' | 'eventId'>,
    eventId: string,
    clientId: string,
  ): Promise<void> {
    try {
      await DiscordMonitorEvent.create({
        clientId: new mongoose.Types.ObjectId(clientId),
        monitorId: monitor._id,
        guildId: payload.guildId,
        guildName: payload.guildName,
        channelId: payload.channelId,
        channelName: payload.channelName,
        monitorType: monitor.monitorType ?? payload.monitorType ?? 'guild',
        trigger: payload.trigger,
        eventId,
        userId: payload.userId,
        userName: payload.userName,
        userTag: payload.userTag,
        moderatorName: payload.moderatorName,
        reason: payload.reason,
        memberCount: payload.memberCount,
        messagePreview: payload.messagePreview,
        status: 'captured',
        waJobsEnqueued: 0,
      });
    } catch (err) {
      logger.warn('Falha ao gravar histórico Discord', {
        eventId,
        error: (err as Error).message,
      });
    }
  }

  async recordSkippedCooldown(
    monitor: { _id: mongoose.Types.ObjectId; monitorType?: DiscordMonitorType },
    payload: Omit<DiscordEventPayload, 'clientId' | 'eventId'>,
    eventId: string,
    clientId: string,
    cooldownSec: number,
  ): Promise<void> {
    try {
      await DiscordMonitorEvent.create({
        clientId: new mongoose.Types.ObjectId(clientId),
        monitorId: monitor._id,
        guildId: payload.guildId,
        guildName: payload.guildName,
        channelId: payload.channelId,
        channelName: payload.channelName,
        monitorType: monitor.monitorType ?? 'guild',
        trigger: payload.trigger,
        eventId,
        userId: payload.userId,
        userName: payload.userName,
        status: 'skipped_cooldown',
        skipReason: `Cooldown ${cooldownSec}s por usuário`,
        waJobsEnqueued: 0,
      });
    } catch (err) {
      logger.warn('Falha ao gravar skip cooldown', { eventId, error: (err as Error).message });
    }
  }

  async updateOutcome(
    eventId: string,
    status: DiscordMonitorEventStatus,
    opts?: {
      waJobsEnqueued?: number;
      skipReason?: string;
      ruleName?: string;
      captureKind?: string;
    },
  ): Promise<void> {
    try {
      await DiscordMonitorEvent.findOneAndUpdate(
        { eventId },
        {
          $set: {
            status,
            waJobsEnqueued: opts?.waJobsEnqueued ?? 0,
            ...(opts?.skipReason ? { skipReason: opts.skipReason } : {}),
            ...(opts?.ruleName ? { ruleName: opts.ruleName } : {}),
            ...(opts?.captureKind ? { captureKind: opts.captureKind } : {}),
          },
        },
      );
    } catch (err) {
      logger.warn('Falha ao atualizar histórico Discord', {
        eventId,
        error: (err as Error).message,
      });
    }
  }

  async recordMessageCaptured(
    monitor: {
      _id: mongoose.Types.ObjectId;
      monitorType?: DiscordMonitorType;
    },
    extracted: {
      messageId: string;
      guildId: string;
      guildName: string;
      channelId: string;
      channelName: string;
      authorId: string;
      authorName: string;
      authorTag?: string;
      captureKind?: string;
      searchText?: string;
      text?: string;
    },
    clientId: string,
  ): Promise<void> {
    const preview = (extracted.searchText ?? extracted.text ?? '').slice(0, 160);
    try {
      await DiscordMonitorEvent.findOneAndUpdate(
        { eventId: extracted.messageId },
        {
          $setOnInsert: {
            clientId: new mongoose.Types.ObjectId(clientId),
            monitorId: monitor._id,
            guildId: extracted.guildId,
            guildName: extracted.guildName,
            channelId: extracted.channelId,
            channelName: extracted.channelName,
            monitorType: monitor.monitorType ?? 'text',
            trigger: 'message',
            eventId: extracted.messageId,
            userId: extracted.authorId,
            userName: extracted.authorName,
            userTag: extracted.authorTag,
            status: 'captured',
            waJobsEnqueued: 0,
            messagePreview: preview || undefined,
            captureKind: extracted.captureKind,
          },
        },
        { upsert: true },
      );
    } catch (err) {
      logger.warn('Falha ao gravar histórico mensagem', {
        messageId: extracted.messageId,
        error: (err as Error).message,
      });
    }
  }

  async listByMonitor(monitorId: string, limit = 30) {
    return DiscordMonitorEvent.listByMonitor(monitorId, limit);
  }

  async aggregateStats(
    clientIds: mongoose.Types.ObjectId[],
    opts?: { guildId?: string; days?: number },
  ): Promise<{
    total: number;
    messages: number;
    events: number;
    byStatus: Record<string, number>;
    byTrigger: Record<string, number>;
    byMonitorType: Record<string, number>;
    byDay: { date: string; count: number }[];
    cooldownSkips: number;
    waQueued: number;
    dryRun: number;
    noRules: number;
    duplicates: number;
    blocked: number;
  }> {
    const days = opts?.days ?? 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match: Record<string, unknown> = {
      clientId: { $in: clientIds },
      createdAt: { $gte: since },
    };
    if (opts?.guildId) match.guildId = opts.guildId;

    const [statusAgg, triggerAgg, typeAgg, dayAgg] = await Promise.all([
      DiscordMonitorEvent.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DiscordMonitorEvent.aggregate([
        { $match: match },
        { $group: { _id: '$trigger', count: { $sum: 1 } } },
      ]),
      DiscordMonitorEvent.aggregate([
        { $match: match },
        { $group: { _id: '$monitorType', count: { $sum: 1 } } },
      ]),
      DiscordMonitorEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'America/Sao_Paulo' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusAgg) byStatus[row._id as string] = row.count as number;

    const byTrigger: Record<string, number> = {};
    for (const row of triggerAgg) byTrigger[row._id as string] = row.count as number;

    const byMonitorType: Record<string, number> = {};
    for (const row of typeAgg) byMonitorType[row._id as string] = row.count as number;

    const byDay = dayAgg.map(row => ({
      date: row._id as string,
      count: row.count as number,
    }));

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const messages = byTrigger.message ?? 0;
    const events = total - messages;

    return {
      total,
      messages,
      events,
      byStatus,
      byTrigger,
      byMonitorType,
      byDay,
      cooldownSkips: byStatus.skipped_cooldown ?? 0,
      waQueued: byStatus.wa_queued ?? 0,
      dryRun: byStatus.dry_run ?? 0,
      noRules: byStatus.no_rules ?? 0,
      duplicates: byStatus.skipped_duplicate ?? 0,
      blocked: byStatus.blocked ?? 0,
    };
  }
}
