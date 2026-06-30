import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  DEFAULT_INBOX_BOT_TEXTS,
  DEFAULT_INBOX_SLA,
  DEFAULT_INBOX_TRIAGE_INACTIVITY,
  DEFAULT_INBOX_WEEKLY_SCHEDULE,
  InboxWeeklySchedule,
} from '@/types/inbox-settings';
import { DEFAULT_INBOX_QUICK_REPLIES, InboxQuickReply } from '@/types/inbox-quick-replies';
import { DEFAULT_CSAT_PROMPT, DEFAULT_CSAT_THANK_YOU } from '@/services/inbox/csat.util';
import {
  DEFAULT_AGENT_PRESENCE_TIMEOUT_SECONDS,
  DEFAULT_PRESENCE_IDLE_TIMEOUT_SECONDS,
  DEFAULT_WHATSAPP_FALLBACK_ACCEPT_TIMEOUT_SECONDS,
  DEFAULT_WHATSAPP_FALLBACK_NO_AGENT_TIMEOUT_SECONDS,
  DEFAULT_WEBCHAT_QUEUE_MAX_WAIT_MINUTES,
  DEFAULT_WEBCHAT_QUEUE_MAX_WAIT_CLOSE_MESSAGE,
  DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE,
  DEFAULT_MAX_CONCURRENT_CHATS_PER_AGENT,
} from '@/types/inbox-settings';
import type { WhatsappBridgeCommandsConfig } from '@/types/whatsapp-bridge-commands';

export interface IInboxSettings extends Document {
  clientId: mongoose.Types.ObjectId;
  welcomeWithCompany: string;
  welcomeGeneric: string;
  menuIntro: string;
  menuFooter: string;
  queueMessage: string;
  waitingMessage: string;
  queuePositionMessage: string;
  queueAllBusyMessage: string;
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
  /** Máximo de atendimentos simultâneos por atendente (Inbox + WebChat + bridge). */
  maxConcurrentChatsPerAgent: number;
  alertSoundEnabled: boolean;
  alertOnNewChat: boolean;
  alertOnNewMessage: boolean;
  inactivityAutoCloseEnabled: boolean;
  inactivityCloseMinutes: number;
  inactivityWarningMinutes: number;
  inactivityCloseGateWaitMinutes: number;
  inactivityWarningMessage: string;
  inactivityCloseMessage: string;
  inactivityWarningQuickCode: string;
  inactivityCloseQuickCode: string;
  gracefulCloseQuickCode: string;
  gracefulCloseAfterPromptMinutes: number;
  gracefulCloseDetectPhrases: boolean;
  inactivityCloseGracefulQuickCode: string;
  closeQuickReplyGateEnabled: boolean;
  gracefulCloseQuickReplyGateEnabled: boolean;
  queueSlaAlertMinutes: number;
  ticketTeamResponseHours: number;
  attendantTriageVisible: boolean;
  triageInactivityEnabled: boolean;
  triageWarningMinutes: number;
  triageCloseAfterWarningMinutes: number;
  triageWarningMessage: string;
  triageCloseMessage: string;
  csatEnabled: boolean;
  csatPrompt: string;
  csatThankYou: string;
  quickReplies: InboxQuickReply[];
  /** Fallback WhatsApp quando chat do site escala sem atendente online */
  whatsappFallbackEnabled: boolean;
  whatsappFallbackAlertPhones: string[];
  whatsappFallbackVisitorMessage: string;
  /** Segundos aguardando aceite quando há atendente indicado online (30–900) */
  whatsappFallbackAcceptTimeoutSeconds: number;
  /** Sem atendente online — segundos antes do alerta WA (0 = imediato) */
  whatsappFallbackNoAgentTimeoutSeconds: number;
  /** Minutos máximos na fila WebChat antes de encerrar (0 = desligado) */
  webchatQueueMaxWaitMinutes: number;
  webchatQueueMaxWaitCloseMessage: string;
  /** Segundos sem heartbeat para considerar atendente offline (30–300) */
  agentPresenceTimeoutSeconds: number;
  /** Segundos de inatividade no painel antes de marcar ausente (60–3600) */
  presenceIdleTimeoutSeconds: number;
  /** Comandos operacionais WhatsApp bridge (!assumir, custom, etc.) */
  whatsappBridgeCommandsConfig?: WhatsappBridgeCommandsConfig;
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
    queuePositionMessage: {
      type: String,
      default: DEFAULT_INBOX_BOT_TEXTS.queuePositionMessage,
      maxlength: 500,
    },
    queueAllBusyMessage: {
      type: String,
      default: DEFAULT_INBOX_BOT_TEXTS.queueAllBusyMessage,
      maxlength: 600,
    },
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
    maxConcurrentChatsPerAgent: {
      type: Number,
      default: DEFAULT_MAX_CONCURRENT_CHATS_PER_AGENT,
      min: 1,
      max: 10,
    },
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
    inactivityCloseGateWaitMinutes: {
      type: Number,
      default: DEFAULT_INBOX_SLA.inactivityCloseGateWaitMinutes,
      min: 0,
      max: 1440,
    },
    inactivityWarningMessage: {
      type: String,
      default: DEFAULT_INBOX_SLA.inactivityWarningMessage,
      maxlength: 500,
    },
    inactivityCloseMessage: {
      type: String,
      default: DEFAULT_INBOX_SLA.inactivityCloseMessage,
      maxlength: 500,
    },
    inactivityWarningQuickCode: {
      type: String,
      default: DEFAULT_INBOX_SLA.inactivityWarningQuickCode,
      maxlength: 32,
    },
    inactivityCloseQuickCode: {
      type: String,
      default: DEFAULT_INBOX_SLA.inactivityCloseQuickCode,
      maxlength: 32,
    },
    gracefulCloseQuickCode: {
      type: String,
      default: DEFAULT_INBOX_SLA.gracefulCloseQuickCode,
      maxlength: 32,
    },
    gracefulCloseAfterPromptMinutes: {
      type: Number,
      default: DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes,
      min: 0,
      max: 1440,
    },
    gracefulCloseDetectPhrases: {
      type: Boolean,
      default: DEFAULT_INBOX_SLA.gracefulCloseDetectPhrases,
    },
    inactivityCloseGracefulQuickCode: {
      type: String,
      default: DEFAULT_INBOX_SLA.inactivityCloseGracefulQuickCode,
      maxlength: 32,
    },
    closeQuickReplyGateEnabled: {
      type: Boolean,
      default: DEFAULT_INBOX_SLA.closeQuickReplyGateEnabled,
    },
    gracefulCloseQuickReplyGateEnabled: {
      type: Boolean,
      default: DEFAULT_INBOX_SLA.gracefulCloseQuickReplyGateEnabled,
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
    attendantTriageVisible: {
      type: Boolean,
      default: DEFAULT_INBOX_TRIAGE_INACTIVITY.attendantTriageVisible,
    },
    triageInactivityEnabled: {
      type: Boolean,
      default: DEFAULT_INBOX_TRIAGE_INACTIVITY.triageInactivityEnabled,
    },
    triageWarningMinutes: {
      type: Number,
      default: DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMinutes,
      min: 0,
      max: 1440,
    },
    triageCloseAfterWarningMinutes: {
      type: Number,
      default: DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseAfterWarningMinutes,
      min: 0,
      max: 1440,
    },
    triageWarningMessage: {
      type: String,
      default: DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMessage,
      maxlength: 500,
    },
    triageCloseMessage: {
      type: String,
      default: DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseMessage,
      maxlength: 500,
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
    whatsappFallbackAcceptTimeoutSeconds: {
      type: Number,
      default: DEFAULT_WHATSAPP_FALLBACK_ACCEPT_TIMEOUT_SECONDS,
      min: 30,
      max: 900,
    },
    whatsappFallbackNoAgentTimeoutSeconds: {
      type: Number,
      default: DEFAULT_WHATSAPP_FALLBACK_NO_AGENT_TIMEOUT_SECONDS,
      min: 0,
      max: 120,
    },
    webchatQueueMaxWaitMinutes: {
      type: Number,
      default: DEFAULT_WEBCHAT_QUEUE_MAX_WAIT_MINUTES,
      min: 0,
      max: 480,
    },
    webchatQueueMaxWaitCloseMessage: {
      type: String,
      default: DEFAULT_WEBCHAT_QUEUE_MAX_WAIT_CLOSE_MESSAGE,
      maxlength: 800,
    },
    agentPresenceTimeoutSeconds: {
      type: Number,
      default: DEFAULT_AGENT_PRESENCE_TIMEOUT_SECONDS,
      min: 30,
      max: 300,
    },
    presenceIdleTimeoutSeconds: {
      type: Number,
      default: DEFAULT_PRESENCE_IDLE_TIMEOUT_SECONDS,
      min: 60,
      max: 3600,
    },
    whatsappBridgeCommandsConfig: {
      type: Schema.Types.Mixed,
      default: undefined,
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
