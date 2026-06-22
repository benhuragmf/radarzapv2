import mongoose from 'mongoose';
import {
  activateWhatsappBridge,
  deactivateWhatsappBridge,
} from '@/services/webchat/webchat-whatsapp-bridge.service';

const webhookEmit = jest.fn();
const appendBridgeSystemMessage = jest.fn().mockResolvedValue(undefined);
const recordAttendanceEvent = jest.fn().mockResolvedValue(undefined);

jest.mock('@/services/integrations/WebhookDispatcherService', () => ({
  WebhookDispatcherService: {
    getInstance: () => ({ emit: webhookEmit }),
  },
}));

jest.mock('@/services/attendance/attendance-audit.service', () => ({
  recordAttendanceEvent: (...args: unknown[]) => recordAttendanceEvent(...args),
}));

jest.mock('@/services/webchat/WebChatService', () => ({
  WebChatService: {
    getInstance: () => ({ appendBridgeSystemMessage }),
  },
}));

jest.mock('@/models/WebChatConversation', () => ({
  WebChatConversation: {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    findById: jest.fn(),
  },
}));

const { WebChatConversation } = jest.requireMock('@/models/WebChatConversation');

const CLIENT_ID = new mongoose.Types.ObjectId().toString();
const CONV_ID = new mongoose.Types.ObjectId().toString();
const AGENT_ID = new mongoose.Types.ObjectId().toString();

describe('webchat bridge webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    WebChatConversation.findById.mockResolvedValue({
      _id: CONV_ID,
      clientId: CLIENT_ID,
      ticketRef: 'TK-BRIDGE1',
      visitorName: 'Visitante',
    });
  });

  it('emite webchat.bridge.started ao ativar bridge', async () => {
    await activateWhatsappBridge(CLIENT_ID, CONV_ID, AGENT_ID);

    expect(webhookEmit).toHaveBeenCalledWith(
      CLIENT_ID,
      'webchat.bridge.started',
      expect.objectContaining({
        conversation_id: CONV_ID,
        ticket_ref: 'TK-BRIDGE1',
        agent_user_id: AGENT_ID,
      }),
    );
    expect(recordAttendanceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'bridge.started' }),
    );
  });

  it('emite webchat.bridge.closed ao desativar bridge', async () => {
    await deactivateWhatsappBridge(CLIENT_ID, CONV_ID);

    expect(webhookEmit).toHaveBeenCalledWith(CLIENT_ID, 'webchat.bridge.closed', {
      conversation_id: CONV_ID,
    });
    expect(recordAttendanceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'bridge.closed' }),
    );
  });
});
