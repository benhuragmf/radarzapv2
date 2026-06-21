import mongoose from 'mongoose';
import {
  AttendanceEvent,
  AttendanceEventKind,
} from '@/models/AttendanceEvent';
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
      meta: input.meta,
    });
  } catch (err) {
    logger.warn('Failed to record attendance event', {
      kind: input.kind,
      clientId: input.clientId,
      err: (err as Error).message,
    });
  }
}
