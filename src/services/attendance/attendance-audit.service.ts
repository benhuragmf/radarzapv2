import mongoose from 'mongoose';
import {
  AttendanceEvent,
  AttendanceEventKind,
} from '@/models/AttendanceEvent';
import { redactSensitiveMeta } from '@/utils/mask-secret.util';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('AttendanceAudit');

export async function recordAttendanceEvent(input: {
  clientId: string;
  kind: AttendanceEventKind;
  ticketRef?: string;
  conversationId?: string;
  actorUserId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const safeMeta = input.meta ? redactSensitiveMeta(input.meta) : undefined;
    await AttendanceEvent.create({
      clientId: new mongoose.Types.ObjectId(input.clientId),
      kind: input.kind,
      ticketRef: input.ticketRef?.trim().toUpperCase(),
      conversationId: input.conversationId
        ? new mongoose.Types.ObjectId(input.conversationId)
        : undefined,
      actorUserId: input.actorUserId
        ? new mongoose.Types.ObjectId(input.actorUserId)
        : undefined,
      meta: safeMeta,
    });
  } catch (err) {
    logger.warn('Failed to record attendance event', {
      kind: input.kind,
      clientId: input.clientId,
      err: (err as Error).message,
    });
  }
}
