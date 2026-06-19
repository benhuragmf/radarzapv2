import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  DEFAULT_INBOX_BOT_TEXTS,
  DEFAULT_INBOX_SLA,
  DEFAULT_INBOX_WEEKLY_SCHEDULE,
  InboxWeeklySchedule,
} from '@/types/inbox-settings';
import { DEFAULT_INBOX_QUICK_REPLIES, InboxQuickReply } from '@/types/inbox-quick-replies';
import { DEFAULT_CSAT_PROMPT, DEFAULT_CSAT_THANK_YOU } from '@/services/inbox/csat.util';
import {
  DEFAULT_AGENT_PRESENCE_TIMEOUT_SECONDS,
  DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE,
} from '@/types/inbox-settings';

export interface IInboxSettings extends Document {
  clientId: mongoose.Types.ObjectId;
  welcomeWithCompany: string;
  welcomeGeneric: string;
  menuIntro: string;
  menuFooter: string;
  queueMessage: string;
  waitingMessage: string;
  outsideHoursMessage: string;
  invalidMenuHint: string;
  resolvedMessage: string;
  transferMessage: string;
  businessHoursEnabled: boolean;
  timezone: string;
  schedule: InboxWeeklySchedule;
  roundRobinEnabled: boolean;
  /** Segundos até outro atendente poder puxar a conversa */
  roundRobinPullTimeoutSeconds: number;
  alertSoundEnabled: boolean;
  alertOnNewChat: boolean;
  alertOnNewMessage: boolean;
  inactivityAutoCloseEnabled: boolean;
  inactivityCloseMinutes: number;
  inactivityWarningMinutes: number;
  queueSlaAlertMinutes: number;
  ticketTeamResponseHours: number;
  csatEnabled: boolean;
  csatPrompt: string;
  csatThankYou: string;
  quickReplies: InboxQuickReply[];
  /** Fallback WhatsApp quando chat do site escala sem atendente online */
  whatsappFallbackEnabled: boolean;
  whatsappFallbackAlertPhones: string[];
  whatsappFallbackVisitorMessage: string;
  /** Segundos sem heartbeat para considerar atendente offline (30–300) */
  agentPresenceTimeoutSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const DayScheduleSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' },
  },
  { _id: false },
);

const InboxSettingsSchema = new Schema<IInboxSettings>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    welcomeWithCompany: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.welcomeWithCompany, maxlength: 500 },
    welcomeGeneric: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.welcomeGeneric, maxlength: 500 },
    menuIntro: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.menuIntro, maxlength: 300 },
    menuFooter: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.menuFooter, maxlength: 300 },
    queueMessage: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.queueMessage, maxlength: 600 },
    waitingMessage: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.waitingMessage, maxlength: 500 },
    outsideHoursMessage: {
      type: String,
      default: DEFAULT_INBOX_BOT_TEXTS.outsideHoursMessage,
      maxlength: 800,
    },
    invalidMenuHint: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.invalidMenuHint, maxlength: 300 },
    resolvedMessage: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.resolvedMessage, maxlength: 500 },
    transferMessage: { type: String, default: DEFAULT_INBOX_BOT_TEXTS.transferMessage, maxlength: 500 },
    businessHoursEnabled: { type: Boolean, default: false },
    timezone: { type: String, default: 'America/Sao_Paulo' },
    schedule: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_INBOX_WEEKLY_SCHEDULE }),
    },
    roundRobinEnabled: { type: Boolean, default: false },
    roundRobinPullTimeoutSeconds: { type: Number, default: 120, min: 30, max: 900 },
    alertSoundEnabled: { type: Boolean, default: true },
    alertOnNewChat: { type: Boolean, default: true },
    alertOnNewMessage: { type: Boolean, default: false },
    inactivityAutoCloseEnabled: {
      type: Boolean,
      default: DEFAULT_INBOX_SLA.inactivityAutoCloseEnabled,
    },
    inactivityCloseMinutes: {
      type: Number,
      default: DEFAULT_INBOX_SLA.inactivityCloseMinutes,
      min: 0,
      max: 1440,
    },
    inactivityWarningMinutes: {
      type: Number,
      default: DEFAULT_INBOX_SLA.inactivityWarningMinutes,
      min: 0,
      max: 1440,
    },
    queueSlaAlertMinutes: {
      type: Number,
      default: DEFAULT_INBOX_SLA.queueSlaAlertMinutes,
      min: 0,
      max: 1440,
    },
    ticketTeamResponseHours: {
      type: Number,
      default: DEFAULT_INBOX_SLA.ticketTeamResponseHours,
      min: 0,
      max: 168,
    },
    csatEnabled: { type: Boolean, default: false },
    csatPrompt: { type: String, default: DEFAULT_CSAT_PROMPT, maxlength: 500 },
    csatThankYou: { type: String, default: DEFAULT_CSAT_THANK_YOU, maxlength: 300 },
    quickReplies: {
      type: [
        {
          code: { type: String, required: true, maxlength: 24 },
          label: { type: String, required: true, maxlength: 80 },
          template: { type: String, required: true, maxlength: 2000 },
        },
      ],
      default: () => DEFAULT_INBOX_QUICK_REPLIES.map(q => ({ ...q })),
    },
    whatsappFallbackEnabled: { type: Boolean, default: false },
    whatsappFallbackAlertPhones: { type: [String], default: [] },
    whatsappFallbackVisitorMessage: {
      type: String,
      default: DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE,
      maxlength: 800,
    },
    agentPresenceTimeoutSeconds: {
      type: Number,
      default: DEFAULT_AGENT_PRESENCE_TIMEOUT_SECONDS,
      min: 30,
      max: 300,
    },
  },
  { timestamps: true, collection: 'inboxSettings' },
);

interface IInboxSettingsModel extends Model<IInboxSettings> {
  getOrCreate(clientId: mongoose.Types.ObjectId | string): Promise<IInboxSettings>;
}

InboxSettingsSchema.statics.getOrCreate = async function getOrCreate(
  clientId: mongoose.Types.ObjectId | string,
) {
  const oid = typeof clientId === 'string' ? new mongoose.Types.ObjectId(clientId) : clientId;
  let doc = await this.findOne({ clientId: oid });
  if (!doc) {
    doc = await this.create({ clientId: oid });
  }
  return doc;
};

export const InboxSettings = mongoose.model<IInboxSettings, IInboxSettingsModel>(
  'InboxSettings',
  InboxSettingsSchema,
);
