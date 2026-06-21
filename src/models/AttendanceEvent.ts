import mongoose, { Schema, Document } from 'mongoose';

export type AttendanceEventKind =
  | 'ticket.created'
  | 'ticket.client_replied'
  | 'ticket.closed'
  | 'bridge.started'
  | 'bridge.closed'
  | 'bridge.agent_reply';

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

export const AttendanceEvent = mongoose.model<IAttendanceEvent>(
  'AttendanceEvent',
  AttendanceEventSchema,
);
