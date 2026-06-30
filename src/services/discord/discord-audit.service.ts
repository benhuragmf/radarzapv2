import mongoose from 'mongoose';
import { AttendanceEvent } from '@/models/AttendanceEvent';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('DiscordAudit');

export type DiscordAuditKind =
  | 'discord.rule.created'
  | 'discord.rule.updated'
  | 'discord.rule.deleted'
  | 'discord.rule.toggled'
  | 'discord.monitor.created'
  | 'discord.monitor.deleted'
  | 'discord.monitor.toggled'
  | 'discord.monitor.filters_updated'
  | 'discord.settings.updated';

export async function recordDiscordAudit(input: {
  clientId: string;
  kind: DiscordAuditKind;
  actorUserId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await AttendanceEvent.create({
      clientId: new mongoose.Types.ObjectId(input.clientId),
      kind: input.kind,
      actorUserId: input.actorUserId
        ? new mongoose.Types.ObjectId(input.actorUserId)
        : undefined,
      meta: input.meta,
    });
  } catch (err) {
    logger.warn('Falha ao gravar auditoria Discord', {
      kind: input.kind,
      clientId: input.clientId,
      err: (err as Error).message,
    });
  }
}

export const DISCORD_AUDIT_KINDS: DiscordAuditKind[] = [
  'discord.rule.created',
  'discord.rule.updated',
  'discord.rule.deleted',
  'discord.rule.toggled',
  'discord.monitor.created',
  'discord.monitor.deleted',
  'discord.monitor.toggled',
  'discord.monitor.filters_updated',
  'discord.settings.updated',
];
