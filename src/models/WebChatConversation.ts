import mongoose, { Schema, Document } from 'mongoose';
import type { WebChatConversationStatus, WebChatQueueStatus } from '../types/webchat';

export interface IWebChatConversation extends Document {
  clientId: mongoose.Types.ObjectId;
  widgetId: mongoose.Types.ObjectId;
  visitorTokenHash: string;
  visitorName?: string;
  visitorEmail?: string;
  status: WebChatConversationStatus;
  queueStatus: WebChatQueueStatus;
  departmentId?: mongoose.Types.ObjectId;
  escalatedAt?: Date;
  queueEnteredAt?: Date;
  suggestedUserId?: string;
  suggestedAt?: Date;
  assignedUserId?: string;
  pageUrl?: string;
  userAgent?: string;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  unreadAgentCount: number;
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
    userAgent: { type: String, maxlength: 500 },
    lastMessageAt: { type: Date, index: true },
    lastMessagePreview: { type: String, maxlength: 300 },
    unreadAgentCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'webChatConversations' },
);

WebChatConversationSchema.index({ clientId: 1, status: 1, lastMessageAt: -1 });
WebChatConversationSchema.index({ widgetId: 1, visitorTokenHash: 1 });

export const WebChatConversation = mongoose.model<IWebChatConversation>(
  'WebChatConversation',
  WebChatConversationSchema,
);
