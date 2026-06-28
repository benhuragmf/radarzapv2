import mongoose from 'mongoose';
import { InboxConversation } from '@/models/InboxConversation';
import { WebChatConversation } from '@/models/WebChatConversation';
import { countAgentActiveChats } from '@/services/inbox/inbox-queue-priority';
import { InboxConversationStatus } from '@/types/inbox';

jest.mock('@/models/InboxConversation', () => ({
  InboxConversation: { countDocuments: jest.fn() },
}));

jest.mock('@/models/WebChatConversation', () => ({
  WebChatConversation: { countDocuments: jest.fn() },
}));

describe('countAgentActiveChats', () => {
  const clientId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    (InboxConversation.countDocuments as jest.Mock).mockResolvedValue(0);
  });

  it('counts webchat with_agent and bridge as one query without double max()', async () => {
    (WebChatConversation.countDocuments as jest.Mock).mockResolvedValue(1);

    const count = await countAgentActiveChats(clientId, userId);

    expect(count).toBe(1);
    expect(WebChatConversation.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: expect.any(mongoose.Types.ObjectId),
        status: 'open',
        $or: [
          { assignedUserId: userId, queueStatus: 'with_agent' },
          { whatsappBridgeActive: true, whatsappBridgeAgentUserId: userId },
        ],
      }),
    );
  });

  it('excludes current webchat conversation when assuming', async () => {
    const wcId = new mongoose.Types.ObjectId().toString();
    (WebChatConversation.countDocuments as jest.Mock).mockResolvedValue(0);

    await countAgentActiveChats(clientId, userId, { webChatConversationId: wcId });

    expect(WebChatConversation.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: new mongoose.Types.ObjectId(wcId) },
      }),
    );
  });

  it('sums inbox in_progress with webchat active', async () => {
    (InboxConversation.countDocuments as jest.Mock).mockResolvedValue(1);
    (WebChatConversation.countDocuments as jest.Mock).mockResolvedValue(1);

    const count = await countAgentActiveChats(clientId, userId);
    expect(count).toBe(2);
    expect(InboxConversation.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        status: InboxConversationStatus.IN_PROGRESS,
      }),
    );
  });
});
