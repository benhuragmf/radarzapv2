import mongoose, { Schema, Document } from 'mongoose';
import { InboxMessageDirection, InboxMessageMediaType } from '@/types/inbox';

export interface IInboxMessage extends Document {
  clientId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  direction: InboxMessageDirection;
  body: string;
  mediaType?: InboxMessageMediaType;
  /** Caminho relativo em data/inbox-media/ */
  mediaUrl?: string;
  mediaMime?: string;
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
      enum: ['inbound', 'outbound', 'system', 'internal'],
      required: true,
    },
    body: { type: String, required: true, maxlength: 4096 },
    mediaType: {
      type: String,
      enum: ['image', 'audio', 'video', 'document', 'sticker'],
    },
    mediaUrl: String,
    mediaMime: String,
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    whatsappMessageId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'inboxMessages' },
);

InboxMessageSchema.index({ conversationId: 1, createdAt: 1 });
InboxMessageSchema.index(
  { clientId: 1, whatsappMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      whatsappMessageId: { $type: 'string', $gt: '' },
    },
  },
);

export const InboxMessage = mongoose.model<IInboxMessage>('InboxMessage', InboxMessageSchema);

/** Troca índice legado (unique sem partial) que colidia em whatsappMessageId null. */
export async function syncInboxMessageIndexes(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  const col = InboxMessage.collection;
  try {
    await col.dropIndex('clientId_1_whatsappMessageId_1');
  } catch {
    // índice antigo pode não existir
  }
  await InboxMessage.syncIndexes();
}
