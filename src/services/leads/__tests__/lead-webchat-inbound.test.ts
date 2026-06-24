import mongoose from 'mongoose';
import { LeadFormService } from '../LeadFormService';
import { LeadCapture } from '@/models/LeadCapture';
import { LeadForm } from '@/models/LeadForm';

jest.mock('@/models/LeadCapture');
jest.mock('@/models/LeadForm');
jest.mock('@/services/integrations/WebhookDispatcherService', () => ({
  WebhookDispatcherService: {
    getInstance: () => ({ emit: jest.fn() }),
  },
}));
jest.mock('@/services/inbox/PanelNotifications', () => ({
  emitPanelEvent: jest.fn(),
}));

const clientId = new mongoose.Types.ObjectId().toString();

describe('LeadFormService.maybeCaptureWebChatSession', () => {
  const svc = LeadFormService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não cria lead se contato já existia', async () => {
    const result = await svc.maybeCaptureWebChatSession(clientId, {
      webchatConversationId: new mongoose.Types.ObjectId().toString(),
      phone: '+5511999999999',
      name: 'Visitante',
      hadExistingContact: true,
    });
    expect(result).toBeNull();
    expect(LeadCapture.create).not.toHaveBeenCalled();
  });

  it('cria lead para nova sessão WebChat com telefone novo', async () => {
    (LeadCapture.findOne as jest.Mock).mockResolvedValue(null);
    const formId = new mongoose.Types.ObjectId();
    (LeadForm.findOne as jest.Mock).mockResolvedValue({ _id: formId, name: 'Entrada WebChat (sistema)' });
    const created = { _id: new mongoose.Types.ObjectId(), status: 'new' };
    (LeadCapture.create as jest.Mock).mockResolvedValue(created);

    const wcId = new mongoose.Types.ObjectId().toString();
    const result = await svc.maybeCaptureWebChatSession(clientId, {
      webchatConversationId: wcId,
      phone: '+5511888777666',
      name: 'Maria Web',
      message: 'Quero orçamento',
      pageTitle: 'Landing',
      hadExistingContact: false,
    });

    expect(result).toBe(created);
    expect(LeadCapture.create).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'webchat',
        metadata: { webchatConversationId: wcId },
      }),
    );
  });
});
