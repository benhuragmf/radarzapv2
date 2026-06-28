import mongoose, { Schema, Document } from 'mongoose';
import type { WebChatConversationStatus, WebChatQueueStatus } from '../types/webchat';

export interface IWebChatConversation extends Document {
  clientId: mongoose.Types.ObjectId;
  widgetId: mongoose.Types.ObjectId;
  visitorTokenHash: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  contactReason?: string;
  visitorIntake?: Record<string, string>;
  destinationId?: mongoose.Types.ObjectId;
  status: WebChatConversationStatus;
  queueStatus: WebChatQueueStatus;
  departmentId?: mongoose.Types.ObjectId;
  escalatedAt?: Date;
  queueEnteredAt?: Date;
  suggestedUserId?: string;
  suggestedAt?: Date;
  assignedUserId?: string;
  acceptedAt?: Date;
  pageUrl?: string;
  pageTitle?: string;
  userAgent?: string;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  lastInboundAt?: Date;
  /** Última mensagem do bot/atendente — base do SLA de inatividade na triagem. */
  lastOutboundAt?: Date;
  inactivityWarnedAt?: Date;
  gracefulClosePromptAt?: Date;
  gracefulCloseAckAt?: Date;
  closeGateSource?: 'inactivity' | 'graceful';
  unreadAgentCount: number;
  proactiveGreetingSentAt?: Date;
  /** Referência do chamado vinculado (paridade com Inbox WhatsApp) */
  ticketRef?: string;
  /** Início do prazo de fallback com atendente indicado (não reinicia ao trocar indicado) */
  whatsappFallbackPriorityStartedAt?: Date;
  /** Último ciclo de alerta WA esgotado (cooldown antes de re-tentar) */
  whatsappFallbackAlertSentAt?: Date;
  /** Atendentes já notificados via WA sem !assumir (rotação) */
  whatsappFallbackTriedUserIds?: string[];
  /** Último atendente que recebeu alerta WA nesta conversa */
  whatsappFallbackWaNotifiedUserId?: string;
  /** Quando o alerta WA foi enviado ao atendente atual (base da rotação) */
  whatsappFallbackWaNotifiedAt?: Date;
  /** Visitante já recebeu a mensagem configurada de fallback */
  whatsappFallbackVisitorNotifiedAt?: Date;
  /** Bridge bidirecional site ↔ WhatsApp do atendente (Fase E) */
  whatsappBridgeActive?: boolean;
  whatsappBridgeAgentUserId?: string;
  whatsappBridgeActivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebChatConversationSchema = new Schema<IWebChatConversation>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization', index: true },
    widgetId: { type: Schema.Types.ObjectId, required: true, ref: 'WebChatWidget', index: true },
    visitorTokenHash: { type: String, required: true, index: true },
    visitorName: { type: String, trim: true, maxlength: 120 },
    visitorEmail: { type: String, trim: true, lowercase: true, maxlength: 200 },
    visitorPhone: { type: String, trim: true, maxlength: 40 },
    contactReason: { type: String, trim: true, maxlength: 200 },
    visitorIntake: { type: Schema.Types.Mixed, default: undefined },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', index: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    queueStatus: {
      type: String,
      enum: ['bot', 'waiting_human', 'with_agent'],
      default: 'bot',
      index: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: 'InboxDepartment', index: true },
    escalatedAt: { type: Date },
    queueEnteredAt: { type: Date },
    suggestedUserId: { type: String, index: true },
    suggestedAt: { type: Date },
    assignedUserId: { type: String, index: true },
    acceptedAt: { type: Date },
    pageUrl: { type: String, maxlength: 2000 },
    pageTitle: { type: String, maxlength: 500 },
    userAgent: { type: String, maxlength: 500 },
    lastMessageAt: { type: Date, index: true },
    lastMessagePreview: { type: String, maxlength: 300 },
    lastInboundAt: Date,
    lastOutboundAt: Date,
    inactivityWarnedAt: Date,
    gracefulClosePromptAt: Date,
    gracefulCloseAckAt: Date,
    closeGateSource: { type: String, enum: ['inactivity', 'graceful'] },
    unreadAgentCount: { type: Number, default: 0 },
    proactiveGreetingSentAt: { type: Date },
    ticketRef: { type: String, trim: true, maxlength: 32, index: true },
    whatsappFallbackPriorityStartedAt: { type: Date },
    whatsappFallbackAlertSentAt: { type: Date },
    whatsappFallbackTriedUserIds: { type: [String], default: undefined },
    whatsappFallbackWaNotifiedUserId: { type: String, index: true },
    whatsappFallbackWaNotifiedAt: { type: Date },
    whatsappFallbackVisitorNotifiedAt: { type: Date },
    whatsappBridgeActive: { type: Boolean, default: false, index: true },
    whatsappBridgeAgentUserId: { type: String, index: true },
    whatsappBridgeActivatedAt: { type: Date },
  },
  { timestamps: true, collection: 'webChatConversations' },
);

WebChatConversationSchema.index({ clientId: 1, status: 1, lastMessageAt: -1 });
WebChatConversationSchema.index({ widgetId: 1, visitorTokenHash: 1 });

export const WebChatConversation = mongoose.model<IWebChatConversation>(
  'WebChatConversation',
  WebChatConversationSchema,
);
