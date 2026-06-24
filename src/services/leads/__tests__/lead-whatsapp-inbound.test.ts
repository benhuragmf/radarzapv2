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
const destId = new mongoose.Types.ObjectId().toString();
const convId = new mongoose.Types.ObjectId().toString();

describe('LeadFormService.maybeCaptureWhatsAppInbound', () => {
  const svc = LeadFormService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não cria lead se contato já existia', async () => {
    const result = await svc.maybeCaptureWhatsAppInbound(clientId, {
      destinationId: destId,
      conversationId: convId,
      phone: '+5511999999999',
      name: 'João',
      message: 'Olá',
      isNewContact: false,
    });
    expect(result).toBeNull();
    expect(LeadCapture.create).not.toHaveBeenCalled();
  });

  it('cria lead para primeiro contato WhatsApp', async () => {
    (LeadCapture.findOne as jest.Mock).mockResolvedValue(null);
    const formId = new mongoose.Types.ObjectId();
    (LeadForm.findOne as jest.Mock).mockResolvedValue({ _id: formId, name: 'Entrada WhatsApp (sistema)' });
    const created = { _id: new mongoose.Types.ObjectId(), status: 'new' };
    (LeadCapture.create as jest.Mock).mockResolvedValue(created);

    const result = await svc.maybeCaptureWhatsAppInbound(clientId, {
      destinationId: destId,
      conversationId: convId,
      phone: '+5511999999999',
      name: 'Maria',
      message: 'Quero orçamento',
      isNewContact: true,
    });

    expect(result).toBe(created);
    expect(LeadCapture.create).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'whatsapp',
        status: 'new',
        phone: '+5511999999999',
        name: 'Maria',
        message: 'Quero orçamento',
      }),
    );
  });

  it('reutiliza lead aberto existente e vincula conversa', async () => {
    const existing = {
      _id: new mongoose.Types.ObjectId(),
      inboxConversationId: undefined,
      destinationId: undefined,
      save: jest.fn().mockResolvedValue(undefined),
    };
    (LeadCapture.findOne as jest.Mock).mockResolvedValue(existing);

    const result = await svc.maybeCaptureWhatsAppInbound(clientId, {
      destinationId: destId,
      conversationId: convId,
      phone: '+5511888888888',
      name: 'Pedro',
      isNewContact: true,
    });

    expect(result).toBe(existing);
    expect(existing.save).toHaveBeenCalled();
    expect(LeadCapture.create).not.toHaveBeenCalled();
  });
});
