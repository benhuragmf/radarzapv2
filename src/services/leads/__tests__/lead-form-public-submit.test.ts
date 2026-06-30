import mongoose from 'mongoose';
import { LeadFormService } from '../LeadFormService';
import { LeadCapture } from '@/models/LeadCapture';
import { LeadForm } from '@/models/LeadForm';
import { Organization } from '@/models/Organization';

jest.mock('@/models/LeadCapture');
jest.mock('@/models/LeadForm');
jest.mock('@/models/Organization', () => ({
  Organization: {
    findById: jest.fn(),
  },
}));
jest.mock('@/services/integrations/WebhookDispatcherService', () => ({
  WebhookDispatcherService: {
    getInstance: () => ({ emit: jest.fn() }),
  },
}));
jest.mock('@/services/inbox/PanelNotifications', () => ({
  emitPanelEvent: jest.fn(),
  emitPanelSocketOnly: jest.fn(),
}));
jest.mock('@/services/contacts/ContactAutoSegmentService', () => ({
  ContactAutoSegmentService: {
    getInstance: () => ({ tagLeadFromForm: jest.fn() }),
  },
}));
jest.mock('@/services/webchat/webchat-destination-link.util', () => ({
  ensureDestinationForWebChatVisitor: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/services/inbound/inbound-registration-policy.service', () => ({
  loadInboundRegistrationPolicy: jest.fn().mockResolvedValue({
    whatsapp: 'both',
    webchat: 'lead',
    form: 'both',
    returnCustomer: 'return_lead',
  }),
}));
jest.mock('@/models/Destination', () => ({
  Destination: {
    findOne: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    }),
    findById: jest.fn().mockResolvedValue(null),
  },
}));

const clientId = new mongoose.Types.ObjectId();
const formId = new mongoose.Types.ObjectId();
const publicKey = 'lfm_' + 'a'.repeat(32);

function activeForm(overrides: Record<string, unknown> = {}) {
  return {
    _id: formId,
    clientId,
    name: 'Formulário Site',
    publicKey,
    active: true,
    allowedDomains: [],
    appearance: {
      honeypot: true,
      requireConsent: false,
      requireEmail: false,
      requireMessage: false,
      customFields: [],
      successMessage: 'Recebemos seu contato.',
    },
    routing: { initialStatus: 'new', contactMode: 'never' },
    ...overrides,
  };
}

let openLeadForDedupe: unknown = null;

function mockLeadCaptureFindOne(openLead: unknown) {
  openLeadForDedupe = openLead;
  (LeadCapture.findOne as jest.Mock).mockImplementation((filter: Record<string, unknown>) => {
    const isOpenDedupe = Boolean(
      filter.status && (filter.status as { $in?: unknown }).$in,
    );
    if (isOpenDedupe) {
      return {
        sort: jest.fn().mockResolvedValue(openLeadForDedupe),
      };
    }
    return {
      sort: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
      lean: jest.fn().mockResolvedValue(null),
    };
  });
}

describe('LeadFormService.submitPublicLead', () => {
  const svc = LeadFormService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
    (Organization.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({}),
      }),
    });
    (LeadForm.findOne as jest.Mock).mockReturnValue({
      exec: () => Promise.resolve(activeForm()),
    });
    mockLeadCaptureFindOne(null);
  });

  it('token inválido retorna erro seguro', async () => {
    (LeadForm.findOne as jest.Mock).mockReturnValue({
      exec: () => Promise.resolve(null),
    });
    await expect(
      svc.submitPublicLead('lfm_invalid', { name: 'X', phone: '11999998888' }, {}),
    ).rejects.toThrow(/não encontrado ou inativo/);
  });

  it('formulário inativo não aceita submissão', async () => {
    (LeadForm.findOne as jest.Mock).mockReturnValue({
      exec: () => Promise.resolve(null),
    });
    await expect(
      svc.submitPublicLead(publicKey, { name: 'Ana', phone: '11999998888' }, {}),
    ).rejects.toThrow(/não encontrado ou inativo/);
  });

  it('cria lead novo quando não há aberto', async () => {
    mockLeadCaptureFindOne(null);
    const created = { _id: new mongoose.Types.ObjectId(), status: 'new' };
    (LeadCapture.create as jest.Mock).mockResolvedValue(created);

    const result = await svc.submitPublicLead(
      publicKey,
      {
        name: 'Carlos',
        phone: '11988887777',
        utm: { source: 'google', campaign: 'ads' },
        sourceUrl: 'https://site.com/landing',
      },
      { referer: 'https://site.com' },
    );

    expect(LeadCapture.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Carlos',
        origin: 'site',
        utm: expect.objectContaining({ source: 'google', campaign: 'ads' }),
        sourceUrl: 'https://site.com/landing',
      }),
    );
    expect(result).toEqual({
      success: true,
      successMessage: 'Recebemos seu contato.',
    });
    expect(result).not.toHaveProperty('captureId');
  });

  it('atualiza lead aberto em vez de duplicar', async () => {
    const existing: {
      _id: mongoose.Types.ObjectId;
      clientId: mongoose.Types.ObjectId;
      status: string;
      name: string;
      phone: string;
      message?: string;
      history: unknown[];
      save: jest.Mock;
    } = {
      _id: new mongoose.Types.ObjectId(),
      clientId,
      status: 'new',
      name: 'Velho',
      phone: '+5511988887777',
      history: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockLeadCaptureFindOne(existing);

    const result = await svc.submitPublicLead(
      publicKey,
      { name: 'Carlos Atualizado', phone: '11988887777', message: 'Quero orçamento' },
      {},
    );

    expect(LeadCapture.create).not.toHaveBeenCalled();
    expect(existing.save).toHaveBeenCalled();
    expect(existing.name).toBe('Carlos Atualizado');
    expect(existing.message).toBe('Quero orçamento');
    expect(result.success).toBe(true);
  });

  it('consentimento obrigatório não aceito falha', async () => {
    (LeadForm.findOne as jest.Mock).mockReturnValue({
      exec: () =>
        Promise.resolve(
          activeForm({
            appearance: {
              honeypot: true,
              requireConsent: true,
              requireEmail: false,
              requireMessage: false,
              customFields: [],
              successMessage: 'OK',
            },
          }),
        ),
    });
    await expect(
      svc.submitPublicLead(publicKey, { name: 'Ana', phone: '11999998888', consent: false }, {}),
    ).rejects.toThrow(/consentimento/);
  });

  it('honeypot preenchido rejeita', async () => {
    await expect(
      svc.submitPublicLead(
        publicKey,
        { name: 'Bot', phone: '11999998888', honeypot: 'spam' },
        {},
      ),
    ).rejects.toThrow(/rejeitado/);
  });
});

describe('LeadFormService.createForm plan limit', () => {
  const svc = LeadFormService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloqueia criação quando limite do plano free atingido', async () => {
    const { Organization } = await import('@/models/Organization');
    (Organization.findById as jest.Mock).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ plan: 'free' }),
      }),
    });
    (LeadForm.countDocuments as jest.Mock).mockResolvedValue(1);

    await expect(svc.createForm(clientId.toString(), { name: 'Novo form' })).rejects.toThrow(
      /Limite de formulários/,
    );
    expect(LeadForm.create).not.toHaveBeenCalled();
  });

  it('permite criação abaixo do limite', async () => {
    const { Organization } = await import('@/models/Organization');
    (Organization.findById as jest.Mock).mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ plan: 'pro' }),
      }),
    });
    (LeadForm.countDocuments as jest.Mock).mockResolvedValue(2);
    const formDoc = {
      _id: new mongoose.Types.ObjectId(),
      clientId,
      name: 'Novo',
      publicKey: 'lfm_' + 'b'.repeat(32),
      active: true,
      allowedDomains: [],
      appearance: {},
      routing: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (LeadForm.create as jest.Mock).mockResolvedValue(formDoc);

    const result = await svc.createForm(clientId.toString(), { name: 'Novo' });
    expect(result.name).toBe('Novo');
    expect(LeadForm.create).toHaveBeenCalled();
  });
});
