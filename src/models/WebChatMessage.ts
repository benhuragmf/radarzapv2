import mongoose, { Schema, Document } from 'mongoose';
import type { WebChatMessageDirection } from '../types/webchat';

export interface IWebChatMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  direction: WebChatMessageDirection;
  body: string;
  senderUserId?: string;
  senderName?: string;
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
    direction: { type: String, enum: ['inbound', 'outbound', 'system'], required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    senderUserId: { type: String },
    senderName: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true, collection: 'webChatMessages' },
);

WebChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const WebChatMessage = mongoose.model<IWebChatMessage>('WebChatMessage', WebChatMessageSchema);
