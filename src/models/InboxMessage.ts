import mongoose, { Schema, Document } from 'mongoose';
import { InboxMessageDirection } from '@/types/inbox';

export interface IInboxMessage extends Document {
  clientId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  direction: InboxMessageDirection;
  body: string;
  authorUserId?: mongoose.Types.ObjectId;
  whatsappMessageId?: string;
  createdAt: Date;
}

const InboxMessageSchema = new Schema<IInboxMessage>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'InboxConversation',
      index: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound', 'system'],
      required: true,
    },
    body: { type: String, required: true, maxlength: 4096 },
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    whatsappMessageId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'inboxMessages' },
);

InboxMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const InboxMessage = mongoose.model<IInboxMessage>('InboxMessage', InboxMessageSchema);
