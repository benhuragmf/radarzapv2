import mongoose, { Schema, Document, Model } from 'mongoose';
import type { DiscordMonitorType, DiscordRuleTrigger } from '@/types/discord-monitor';

export type DiscordMonitorEventStatus =
  | 'captured'
  | 'wa_queued'
  | 'no_rules'
  | 'skipped_cooldown'
  | 'skipped_duplicate'
  | 'blocked'
  | 'wa_disconnected'
  | 'wa_failed'
  | 'dry_run';

export interface IDiscordMonitorEvent extends Document {
  clientId: mongoose.Types.ObjectId;
  monitorId?: mongoose.Types.ObjectId;
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  monitorType: DiscordMonitorType;
  trigger: DiscordRuleTrigger;
  eventId: string;
  userId?: string;
  userName?: string;
  userTag?: string;
  moderatorName?: string;
  reason?: string;
  memberCount?: number;
  status: DiscordMonitorEventStatus;
  waJobsEnqueued: number;
  skipReason?: string;
  /** Prévia do texto (mensagens) */
  messagePreview?: string;
  captureKind?: string;
  ruleName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DiscordMonitorEventSchema = new Schema<IDiscordMonitorEvent>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    monitorId: { type: Schema.Types.ObjectId, ref: 'DiscordChannel', index: true },
    guildId: { type: String, required: true, index: true },
    guildName: { type: String, default: '' },
    channelId: { type: String, required: true, index: true },
    channelName: { type: String, default: '' },
    monitorType: { type: String, enum: ['text', 'voice', 'guild'], default: 'text' },
    trigger: { type: String, required: true, index: true },
    eventId: { type: String, required: true, unique: true },
    userId: { type: String, index: true },
    userName: { type: String },
    userTag: { type: String },
    moderatorName: { type: String },
    reason: { type: String },
    memberCount: { type: Number },
    status: {
      type: String,
      enum: [
        'captured',
        'wa_queued',
        'no_rules',
        'skipped_cooldown',
        'skipped_duplicate',
        'blocked',
        'wa_disconnected',
        'wa_failed',
        'dry_run',
      ],
      default: 'captured',
      index: true,
    },
    waJobsEnqueued: { type: Number, default: 0 },
    skipReason: { type: String },
    messagePreview: { type: String },
    captureKind: { type: String },
    ruleName: { type: String },
  },
  { timestamps: true, collection: 'discordMonitorEvents' },
);

DiscordMonitorEventSchema.index({ clientId: 1, monitorId: 1, createdAt: -1 });
DiscordMonitorEventSchema.index({ clientId: 1, guildId: 1, createdAt: -1 });
DiscordMonitorEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

interface IDiscordMonitorEventModel extends Model<IDiscordMonitorEvent> {
  listByMonitor(
    monitorId: string,
    limit?: number,
  ): Promise<IDiscordMonitorEvent[]>;
}

DiscordMonitorEventSchema.statics.listByMonitor = function (monitorId: string, limit = 50) {
  return this.find({ monitorId: new mongoose.Types.ObjectId(monitorId) })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();
};

export const DiscordMonitorEvent = mongoose.model<IDiscordMonitorEvent, IDiscordMonitorEventModel>(
  'DiscordMonitorEvent',
  DiscordMonitorEventSchema,
);
