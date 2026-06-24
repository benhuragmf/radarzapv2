import mongoose from 'mongoose';
import { LeadFormService } from '../LeadFormService';
import { LeadCapture } from '@/models/LeadCapture';

jest.mock('@/models/LeadCapture');
jest.mock('@/services/integrations/WebhookDispatcherService', () => ({
  WebhookDispatcherService: {
    getInstance: () => ({ emit: jest.fn() }),
  },
}));

const clientId = new mongoose.Types.ObjectId().toString();
const convId = new mongoose.Types.ObjectId().toString();

describe('LeadFormService.syncCaptureAfterConversationClosed', () => {
  const svc = LeadFormService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('promove lead in_progress para qualified ao encerrar Inbox', async () => {
    const capture = {
      _id: new mongoose.Types.ObjectId(),
      status: 'in_progress',
      history: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    (LeadCapture.findOne as jest.Mock).mockResolvedValue(capture);

    await svc.syncCaptureAfterConversationClosed(clientId, {
      inboxConversationId: convId,
      closedByUserId: 'user-1',
    });

    expect(LeadCapture.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: expect.any(mongoose.Types.ObjectId),
        status: 'in_progress',
        inboxConversationId: expect.any(mongoose.Types.ObjectId),
      }),
    );
    expect(capture.status).toBe('qualified');
    expect(capture.save).toHaveBeenCalled();
    expect(capture.history?.some((h: { message: string }) => h.message.includes('qualificado'))).toBe(true);
  });

  it('busca por webchatConversationId em metadata', async () => {
    const wcId = new mongoose.Types.ObjectId().toString();
    const capture = {
      _id: new mongoose.Types.ObjectId(),
      status: 'in_progress',
      history: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    (LeadCapture.findOne as jest.Mock).mockResolvedValue(capture);

    await svc.syncCaptureAfterConversationClosed(clientId, {
      webchatConversationId: wcId,
    });

    expect(LeadCapture.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        'metadata.webchatConversationId': wcId,
      }),
    );
    expect(capture.status).toBe('qualified');
  });

  it('ignora se não há lead em atendimento vinculado', async () => {
    (LeadCapture.findOne as jest.Mock).mockResolvedValue(null);

    await svc.syncCaptureAfterConversationClosed(clientId, { inboxConversationId: convId });

    expect(LeadCapture.findOne).toHaveBeenCalled();
  });

  it('não faz nada sem id de conversa', async () => {
    await svc.syncCaptureAfterConversationClosed(clientId, {});

    expect(LeadCapture.findOne).not.toHaveBeenCalled();
  });
});
