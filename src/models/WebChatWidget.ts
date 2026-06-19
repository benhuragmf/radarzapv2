import mongoose, { Schema, Document } from 'mongoose';
import type { WebChatAiEscalationPolicy, WebChatWidgetAppearance } from '../types/webchat';
import {
  DEFAULT_WEBCHAT_AI_ESCALATION_POLICY,
  DEFAULT_WEBCHAT_APPEARANCE,
  DEFAULT_WEBCHAT_AUTO_REPLY_MESSAGE,
  DEFAULT_WEBCHAT_CONTACT_REASON_OPTIONS,
  DEFAULT_WEBCHAT_OUTSIDE_HOURS_MESSAGE,
  DEFAULT_WEBCHAT_PROACTIVE_GREETING_DELAY_SECONDS,
  DEFAULT_WEBCHAT_PROACTIVE_GREETING_MESSAGE,
} from '../types/webchat';
import {
  DEFAULT_INBOX_WEEKLY_SCHEDULE,
  type InboxWeeklySchedule,
} from '../types/inbox-settings';

export interface IWebChatWidget extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  publicKey: string;
  active: boolean;
  allowedDomains: string[];
  appearance: WebChatWidgetAppearance;
  autoReplyEnabled: boolean;
  autoReplyMessage: string;
  autoReplySenderName: string;
  autoReplyUseAi: boolean;
  aiEscalationPolicy: WebChatAiEscalationPolicy;
  proactiveGreetingEnabled: boolean;
  proactiveGreetingMessage: string;
  proactiveGreetingDelaySeconds: number;
  defaultDepartmentId?: mongoose.Types.ObjectId;
  useInboxBusinessHours: boolean;
  businessHoursEnabled: boolean;
  timezone: string;
  schedule: InboxWeeklySchedule;
  outsideHoursMessage: string;
  /** Permite consulta de chamado por número + token no widget. */
  ticketLookupEnabled: boolean;
  /** FAQ/base de conhecimento no chat (antes de IA/humano). */
  faqInChatEnabled: boolean;
  /** Exibir sugestões rápidas da base no widget. */
  faqShowQuickReplies: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AppearanceSchema = new Schema<WebChatWidgetAppearance>(
  {
    primaryColor: { type: String, default: DEFAULT_WEBCHAT_APPEARANCE.primaryColor },
    position: { type: String, enum: ['left', 'right'], default: DEFAULT_WEBCHAT_APPEARANCE.position },
    title: { type: String, default: DEFAULT_WEBCHAT_APPEARANCE.title, maxlength: 80 },
    subtitle: { type: String, default: DEFAULT_WEBCHAT_APPEARANCE.subtitle, maxlength: 120 },
    greeting: { type: String, default: DEFAULT_WEBCHAT_APPEARANCE.greeting, maxlength: 500 },
    askName: { type: Boolean, default: DEFAULT_WEBCHAT_APPEARANCE.askName },
    askPhone: { type: Boolean, default: DEFAULT_WEBCHAT_APPEARANCE.askPhone },
    askContactReason: { type: Boolean, default: DEFAULT_WEBCHAT_APPEARANCE.askContactReason },
    contactReasonOptions: {
      type: [String],
      default: () => [...DEFAULT_WEBCHAT_CONTACT_REASON_OPTIONS],
    },
    askEmail: { type: Boolean, default: DEFAULT_WEBCHAT_APPEARANCE.askEmail },
    prechatFields: { type: Schema.Types.Mixed, default: undefined },
    prechatMode: { type: String, enum: ['steps', 'form'], default: 'steps' },
    theme: { type: String, enum: ['light', 'dark'], default: DEFAULT_WEBCHAT_APPEARANCE.theme },
    chatLayout: { type: String, enum: ['classic', 'copilot'], default: 'classic' },
    previewTemplateId: { type: String, maxlength: 32 },
  },
  { _id: false },
);

const WebChatWidgetSchema = new Schema<IWebChatWidget>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization', index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    publicKey: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true, index: true },
    allowedDomains: { type: [String], default: [] },
    appearance: { type: AppearanceSchema, default: () => ({ ...DEFAULT_WEBCHAT_APPEARANCE }) },
    autoReplyEnabled: { type: Boolean, default: true },
    autoReplyMessage: { type: String, default: DEFAULT_WEBCHAT_AUTO_REPLY_MESSAGE, maxlength: 500 },
    autoReplySenderName: { type: String, default: 'Assistente virtual', maxlength: 80 },
    autoReplyUseAi: { type: Boolean, default: false },
    aiEscalationPolicy: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_WEBCHAT_AI_ESCALATION_POLICY }),
    },
    proactiveGreetingEnabled: { type: Boolean, default: false },
    proactiveGreetingMessage: {
      type: String,
      default: DEFAULT_WEBCHAT_PROACTIVE_GREETING_MESSAGE,
      maxlength: 300,
    },
    proactiveGreetingDelaySeconds: {
      type: Number,
      default: DEFAULT_WEBCHAT_PROACTIVE_GREETING_DELAY_SECONDS,
      min: 5,
      max: 300,
    },
    defaultDepartmentId: { type: Schema.Types.ObjectId, ref: 'InboxDepartment' },
    useInboxBusinessHours: { type: Boolean, default: true },
    businessHoursEnabled: { type: Boolean, default: false },
    timezone: { type: String, default: 'America/Sao_Paulo' },
    schedule: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_INBOX_WEEKLY_SCHEDULE }),
    },
    outsideHoursMessage: {
      type: String,
      default: DEFAULT_WEBCHAT_OUTSIDE_HOURS_MESSAGE,
      maxlength: 800,
    },
    ticketLookupEnabled: { type: Boolean, default: true },
    faqInChatEnabled: { type: Boolean, default: true },
    faqShowQuickReplies: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'webChatWidgets' },
);

WebChatWidgetSchema.index({ clientId: 1, active: 1 });

export const WebChatWidget = mongoose.model<IWebChatWidget>('WebChatWidget', WebChatWidgetSchema);
