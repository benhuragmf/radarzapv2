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
jest.mock('@/services/billing/plan-limit-enforcement', () => ({
  assertCanCaptureLead: jest.fn().mockResolvedValue(undefined),
}));

const clientId = new mongoose.Types.ObjectId().toString();
const destId = new mongoose.Types.ObjectId().toString();
const convId = new mongoose.Types.ObjectId().toString();

describe('LeadFormService.maybeCaptureWhatsAppCommercialIntent', () => {
  const svc = LeadFormService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignora mensagem sem intenção comercial', async () => {
    const result = await svc.maybeCaptureWhatsAppCommercialIntent(clientId, {
      destinationId: destId,
      conversationId: convId,
      phone: '+5511999999999',
      name: 'João',
      message: 'obrigado',
    });
    expect(result).toBeNull();
    expect(LeadCapture.create).not.toHaveBeenCalled();
  });

  it('cria lead quando há intenção comercial e sem lead aberto', async () => {
    (LeadCapture.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const formId = new mongoose.Types.ObjectId();
    (LeadForm.findOne as jest.Mock).mockResolvedValue({ _id: formId, name: 'Entrada WhatsApp (sistema)' });
    const created = { _id: new mongoose.Types.ObjectId(), status: 'new' };
    (LeadCapture.create as jest.Mock).mockResolvedValue(created);

    const result = await svc.maybeCaptureWhatsAppCommercialIntent(clientId, {
      destinationId: destId,
      conversationId: convId,
      phone: '+5511999999999',
      name: 'João',
      message: 'Quero orçamento do plano',
    });

    expect(result).toBe(created);
    expect(LeadCapture.create).toHaveBeenCalled();
  });

  it('não duplica se já existe lead aberto para o telefone', async () => {
    (LeadCapture.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), status: 'new' });

    const result = await svc.maybeCaptureWhatsAppCommercialIntent(clientId, {
      destinationId: destId,
      conversationId: convId,
      phone: '+5511999999999',
      name: 'João',
      message: 'Preciso de cotação',
    });

    expect(result).toBeNull();
    expect(LeadCapture.create).not.toHaveBeenCalled();
  });
});
