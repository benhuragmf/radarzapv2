import mongoose, { Schema, Document } from 'mongoose';
import { redactSensitiveMeta } from '@/utils/mask-secret.util';

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

/** TTL automático — retenção 180 dias (AH-D02). */
const AUDIT_LOG_RETENTION_SEC = 180 * 24 * 60 * 60;
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_LOG_RETENTION_SEC });

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
    details: entry.details ? redactSensitiveMeta(entry.details) : undefined,
  });
}
