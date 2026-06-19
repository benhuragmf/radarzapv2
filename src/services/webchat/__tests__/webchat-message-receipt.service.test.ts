import mongoose from 'mongoose';
import { WebChatMessage } from '@/models/WebChatMessage';
import {
  markInboundReadByAgent,
  markInboundReadOnTeamReply,
  markOutboundDelivered,
  markOutboundReadThrough,
} from '../webchat-message-receipt.service';
import {
  emitWebChatMessageReceiptToTenant,
  emitWebChatMessageReceiptToVisitor,
} from '../WebChatRealtime';

jest.mock('@/models/WebChatMessage', () => ({
  WebChatMessage: {
    updateMany: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock('../WebChatRealtime', () => ({
  emitWebChatMessageReceiptToTenant: jest.fn(),
  emitWebChatMessageReceiptToVisitor: jest.fn(),
}));

const clientId = new mongoose.Types.ObjectId().toString();
const conversationId = new mongoose.Types.ObjectId().toString();
const messageId = new mongoose.Types.ObjectId().toString();

describe('webchat-message-receipt.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('markOutboundDelivered updates and emits', async () => {
    (WebChatMessage.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

    await markOutboundDelivered(clientId, conversationId, [messageId]);

    expect(WebChatMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'outbound',
        deliveredAt: { $exists: false },
      }),
      expect.objectContaining({ $set: expect.objectContaining({ deliveredAt: expect.any(Date) }) }),
    );
    expect(emitWebChatMessageReceiptToTenant).toHaveBeenCalled();
    expect(emitWebChatMessageReceiptToVisitor).toHaveBeenCalled();
  });

  it('markOutboundReadThrough uses anchor createdAt', async () => {
    const anchorDate = new Date('2026-06-19T12:00:00Z');
    const leanMock = jest.fn().mockResolvedValue({ createdAt: anchorDate });
    (WebChatMessage.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: leanMock }),
    });
    (WebChatMessage.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 2 });

    await markOutboundReadThrough(clientId, conversationId, messageId);

    expect(WebChatMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'outbound',
        createdAt: { $lte: anchorDate },
      }),
      expect.any(Object),
    );
    expect(emitWebChatMessageReceiptToTenant).toHaveBeenCalledWith(
      clientId,
      conversationId,
      [messageId],
      expect.objectContaining({ readThrough: true }),
    );
  });

  it('markInboundReadOnTeamReply emits inboundBatch when modified', async () => {
    (WebChatMessage.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 3 });
    const replyAt = new Date();

    await markInboundReadOnTeamReply(clientId, conversationId, replyAt);

    expect(WebChatMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'inbound',
        createdAt: { $lte: replyAt },
      }),
      { $set: { readAt: expect.any(Date) } },
    );
    expect(emitWebChatMessageReceiptToVisitor).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({ inboundBatch: true }),
    );
  });

  it('markInboundReadByAgent skips emit when nothing modified', async () => {
    (WebChatMessage.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 0 });

    await markInboundReadByAgent(clientId, conversationId);

    expect(emitWebChatMessageReceiptToTenant).not.toHaveBeenCalled();
    expect(emitWebChatMessageReceiptToVisitor).not.toHaveBeenCalled();
  });
});
