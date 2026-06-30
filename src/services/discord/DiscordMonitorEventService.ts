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
    opts?: { waJobsEnqueued?: number; skipReason?: string },
  ): Promise<void> {
    try {
      await DiscordMonitorEvent.findOneAndUpdate(
        { eventId },
        {
          $set: {
            status,
            waJobsEnqueued: opts?.waJobsEnqueued ?? 0,
            ...(opts?.skipReason ? { skipReason: opts.skipReason } : {}),
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

  async listByMonitor(monitorId: string, limit = 30) {
    return DiscordMonitorEvent.listByMonitor(monitorId, limit);
  }
}
