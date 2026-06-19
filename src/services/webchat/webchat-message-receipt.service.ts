import mongoose from 'mongoose';
import { WebChatMessage } from '@/models/WebChatMessage';
import { emitWebChatMessageReceiptToTenant, emitWebChatMessageReceiptToVisitor } from './WebChatRealtime';

export async function markOutboundDelivered(
  clientId: string,
  conversationId: string,
  messageIds: string[],
): Promise<void> {
  const ids = messageIds
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));
  if (!ids.length) return;

  const now = new Date();
  await WebChatMessage.updateMany(
    {
      _id: { $in: ids },
      clientId: new mongoose.Types.ObjectId(clientId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      direction: 'outbound',
      deliveredAt: { $exists: false },
    },
    { $set: { deliveredAt: now } },
  );

  emitWebChatMessageReceiptToTenant(clientId, conversationId, messageIds, { deliveredAt: now });
  emitWebChatMessageReceiptToVisitor(conversationId, { messageIds, deliveredAt: now });
}

export async function markOutboundReadThrough(
  clientId: string,
  conversationId: string,
  readThroughId: string,
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(readThroughId)) return;

  const anchor = await WebChatMessage.findOne({
    _id: new mongoose.Types.ObjectId(readThroughId),
    clientId: new mongoose.Types.ObjectId(clientId),
    conversationId: new mongoose.Types.ObjectId(conversationId),
    direction: 'outbound',
  })
    .select('createdAt')
    .lean();
  if (!anchor?.createdAt) return;

  const now = new Date();
  await WebChatMessage.updateMany(
    {
      clientId: new mongoose.Types.ObjectId(clientId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      direction: 'outbound',
      createdAt: { $lte: anchor.createdAt },
      readAt: { $exists: false },
    },
    { $set: { readAt: now, deliveredAt: now } },
  );

  await WebChatMessage.updateMany(
    {
      clientId: new mongoose.Types.ObjectId(clientId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      direction: 'outbound',
      createdAt: { $lte: anchor.createdAt },
      deliveredAt: { $exists: false },
    },
    { $set: { deliveredAt: now } },
  );

  emitWebChatMessageReceiptToTenant(clientId, conversationId, [readThroughId], {
    deliveredAt: now,
    readAt: now,
    readThrough: true,
  });
  emitWebChatMessageReceiptToVisitor(conversationId, {
    messageIds: [readThroughId],
    deliveredAt: now,
    readAt: now,
    readThrough: true,
  });
}

/** Marca mensagens do visitante como lidas quando equipe/bot responde. */
export async function markInboundReadOnTeamReply(
  clientId: string,
  conversationId: string,
  replyCreatedAt: Date,
): Promise<void> {
  const now = new Date();
  const result = await WebChatMessage.updateMany(
    {
      clientId: new mongoose.Types.ObjectId(clientId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      direction: 'inbound',
      createdAt: { $lte: replyCreatedAt },
      readAt: { $exists: false },
    },
    { $set: { readAt: now } },
  );

  if (result.modifiedCount > 0) {
    emitWebChatMessageReceiptToTenant(clientId, conversationId, [], { readAt: now, inboundBatch: true });
    emitWebChatMessageReceiptToVisitor(conversationId, { readAt: now, inboundBatch: true });
  }
}

/** Marca mensagens do visitante como lidas pelo atendente (Inbox aberto). */
export async function markInboundReadByAgent(
  clientId: string,
  conversationId: string,
): Promise<void> {
  const now = new Date();
  const result = await WebChatMessage.updateMany(
    {
      clientId: new mongoose.Types.ObjectId(clientId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      direction: 'inbound',
      readAt: { $exists: false },
    },
    { $set: { readAt: now } },
  );

  if (result.modifiedCount > 0) {
    emitWebChatMessageReceiptToTenant(clientId, conversationId, [], { readAt: now, inboundBatch: true });
    emitWebChatMessageReceiptToVisitor(conversationId, { readAt: now, inboundBatch: true });
  }
}
