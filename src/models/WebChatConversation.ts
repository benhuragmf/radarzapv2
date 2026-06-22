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
  pageUrl?: string;
  pageTitle?: string;
  userAgent?: string;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  unreadAgentCount: number;
  proactiveGreetingSentAt?: Date;
  /** Referência do chamado vinculado (paridade com Inbox WhatsApp) */
  ticketRef?: string;
  /** Último alerta WhatsApp enviado por fallback offline */
  whatsappFallbackAlertSentAt?: Date;
  /** Atendentes já notificados via WA sem !assumir (rotação) */
  whatsappFallbackTriedUserIds?: string[];
  /** Último atendente que recebeu alerta WA nesta conversa */
  whatsappFallbackWaNotifiedUserId?: string;
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
    pageUrl: { type: String, maxlength: 2000 },
    pageTitle: { type: String, maxlength: 500 },
    userAgent: { type: String, maxlength: 500 },
    lastMessageAt: { type: Date, index: true },
    lastMessagePreview: { type: String, maxlength: 300 },
    unreadAgentCount: { type: Number, default: 0 },
    proactiveGreetingSentAt: { type: Date },
    ticketRef: { type: String, trim: true, maxlength: 32, index: true },
    whatsappFallbackAlertSentAt: { type: Date },
    whatsappFallbackTriedUserIds: { type: [String], default: undefined },
    whatsappFallbackWaNotifiedUserId: { type: String, index: true },
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
