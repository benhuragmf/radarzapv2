import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  actorUserId?: mongoose.Types.ObjectId;
  actorDiscordId?: string;
  targetUserId?: mongoose.Types.ObjectId;
  targetGuildId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  action: { type: String, required: true, index: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  actorDiscordId: { type: String, index: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  targetGuildId: { type: String, index: true },
  details: { type: Schema.Types.Mixed },
  ip: { type: String },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'auditLogs',
});

AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export async function writeAuditLog(entry: {
  action: string;
  actorUserId?: string;
  actorDiscordId?: string;
  targetUserId?: string;
  targetGuildId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  await AuditLog.create({
    ...entry,
    actorUserId: entry.actorUserId ? new mongoose.Types.ObjectId(entry.actorUserId) : undefined,
    targetUserId: entry.targetUserId ? new mongoose.Types.ObjectId(entry.targetUserId) : undefined,
  });
}
