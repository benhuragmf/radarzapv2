import mongoose, { Schema, Document } from 'mongoose';
import type {
  WebChatActionLink,
  WebChatMessageDirection,
  WebChatMessageMediaType,
} from '../types/webchat';

export interface IWebChatMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  direction: WebChatMessageDirection;
  body: string;
  mediaType?: WebChatMessageMediaType;
  mediaUrl?: string;
  mediaMime?: string;
  mediaFileName?: string;
  senderUserId?: string;
  senderName?: string;
  actionLinks?: WebChatActionLink[];
  createdAt: Date;
  updatedAt: Date;
}

const WebChatMessageSchema = new Schema<IWebChatMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'WebChatConversation',
      index: true,
    },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization', index: true },
    direction: { type: String, enum: ['inbound', 'outbound', 'system', 'internal'], required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    mediaType: { type: String, enum: ['image', 'document'] },
    mediaUrl: { type: String, maxlength: 500 },
    mediaMime: { type: String, maxlength: 120 },
    mediaFileName: { type: String, maxlength: 200 },
    senderUserId: { type: String },
    senderName: { type: String, trim: true, maxlength: 120 },
    actionLinks: {
      type: [
        {
          label: { type: String, maxlength: 80 },
          url: { type: String, maxlength: 500 },
          openInNewTab: { type: Boolean, default: true },
        },
      ],
      default: undefined,
    },
  },
  { timestamps: true, collection: 'webChatMessages' },
);

WebChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const WebChatMessage = mongoose.model<IWebChatMessage>('WebChatMessage', WebChatMessageSchema);
