import mongoose, { Schema, Document } from 'mongoose';

export type AttendanceEventKind =
  | 'ticket.created'
  | 'ticket.client_replied'
  | 'ticket.closed'
  | 'ticket.reopened'
  | 'ticket.assigned'
  | 'ticket.public_lookup_failed'
  | 'bridge.started'
  | 'bridge.closed'
  | 'bridge.agent_reply'
  | 'bridge.message_forwarded'
  | 'bridge.loop_prevented'
  | 'triage.classified'
  | 'ai.premium.requested'
  | 'ai.premium.answered'
  | 'ai.premium.escalated'
  | 'ai.premium.blocked'
  | 'ai.premium.provider_error'
  | 'ai.credits.checked'
  | 'ai.credits.consumed'
  | 'ai.credits.blocked'
  | 'ai.credits.low_balance'
  | 'ai.credits.exhausted'
  | 'ai.credits.adjusted'
  | 'ai.credits.monthly_reset'
  | 'inbox.queued'
  | 'inbox.assigned'
  | 'inbox.transferred'
  | 'inbox.reassigned'
  | 'form.blocked'
  | 'billing.checkout.completed'
  | 'billing.invoice.failed'
  | 'billing.ai_credit_pack.purchased'
  | 'billing.limit.blocked'
  | 'lgpd.export_requested'
  | 'lgpd.delete_requested'
  | 'lgpd.anonymized'
  | 'discord.rule.created'
  | 'discord.rule.updated'
  | 'discord.rule.deleted'
  | 'discord.rule.toggled'
  | 'discord.monitor.created'
  | 'discord.monitor.deleted'
  | 'discord.monitor.toggled'
  | 'discord.monitor.filters_updated'
  | 'discord.settings.updated';

export interface IAttendanceEvent extends Document {
  clientId: mongoose.Types.ObjectId;
  kind: AttendanceEventKind;
  ticketRef?: string;
  conversationId?: mongoose.Types.ObjectId;
  actorUserId?: mongoose.Types.ObjectId;
  /** Metadados seguros — sem corpo de mensagem nem tokens. */
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const AttendanceEventSchema = new Schema<IAttendanceEvent>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, required: true, index: true },
    ticketRef: { type: String, maxlength: 32, index: true },
    conversationId: { type: Schema.Types.ObjectId, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    meta: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'attendanceEvents',
  },
);

AttendanceEventSchema.index({ clientId: 1, createdAt: -1 });
AttendanceEventSchema.index({ clientId: 1, kind: 1, createdAt: -1 });
/** Feed admin segurança — query global por kind + janela temporal. */
AttendanceEventSchema.index({ kind: 1, createdAt: -1 });

/** TTL automático — retenção 90 dias (AH-D02). */
const ATTENDANCE_EVENT_RETENTION_SEC = 90 * 24 * 60 * 60;
AttendanceEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: ATTENDANCE_EVENT_RETENTION_SEC });

export const AttendanceEvent = mongoose.model<IAttendanceEvent>(
  'AttendanceEvent',
  AttendanceEventSchema,
);
