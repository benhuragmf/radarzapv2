import mongoose from 'mongoose';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxService } from '@/services/inbox/InboxService';
import { InboxConversationStatus } from '@/types/inbox';
import type { IDestination } from '@/models/Destination';

const loadInboxSettingsMock = jest.fn();
const webhookEmit = jest.fn();
const findOrCreateContact = jest.fn();
const findContactDestinationForInbound = jest.fn();
const shouldDeferToConsentFlow = jest.fn();
const acceptInboundInitiated = jest.fn();

jest.mock('@/constants/inbox-triage', () => {
  const actual = jest.requireActual<typeof import('@/constants/inbox-triage')>(
    '@/constants/inbox-triage',
  );
  return {
    ...actual,
    loadInboxSettings: (...args: unknown[]) => loadInboxSettingsMock(...args),
  };
});

jest.mock('@/models/InboxConversation');

jest.mock('@/services/integrations/WebhookDispatcherService', () => ({
  WebhookDispatcherService: {
    getInstance: () => ({ emit: webhookEmit }),
  },
}));

jest.mock('@/services/consent/ConsentService', () => ({
  ConsentService: {
    getInstance: () => ({
      findOrCreateContactFromInbound: (...args: unknown[]) => findOrCreateContact(...args),
      findContactDestinationForInbound: (...args: unknown[]) =>
        findContactDestinationForInbound(...args),
      shouldDeferToConsentFlow: (...args: unknown[]) => shouldDeferToConsentFlow(...args),
      acceptInboundInitiated: (...args: unknown[]) => acceptInboundInitiated(...args),
    }),
  },
}));

jest.mock('@/services/whatsapp/WhatsAppService', () => ({
  WhatsAppService: {
    getInstance: () => ({
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
    }),
  },
}));

const CLIENT_ID = new mongoose.Types.ObjectId().toString();
const DEST_ID = new mongoose.Types.ObjectId();

/** Acesso a métodos privados do InboxService nos testes de integração. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InboxPrivate = InboxService & Record<string, any>;

function mockDest(): IDestination {
  return {
    _id: DEST_ID,
    identifier: '5511999999999@s.whatsapp.net',
    name: 'Cliente',
  } as IDestination;
}

function freshInboxService(): InboxPrivate {
  (InboxService as unknown as { instance?: InboxService }).instance = undefined;
  return InboxService.getInstance() as InboxPrivate;
}

function mockPendingFindOne(pending: object | null) {
  (InboxConversation.findOne as jest.Mock).mockImplementation((query: Record<string, unknown>) => {
    if (query.csatPending === true) {
      return {
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(pending),
        }),
      };
    }
    if (query.csatScore) {
      return {
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      };
    }
    return {
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };
  });
}

describe('InboxService tryHandleCsatReply (integração)', () => {
  let svc: InboxPrivate;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = freshInboxService();
    jest.spyOn(svc, 'inboxTriageContextActive' as keyof InboxService).mockResolvedValue(false);
    jest.spyOn(svc, 'sendToContact' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'appendSystemMessage' as keyof InboxService).mockResolvedValue(undefined);
    (InboxConversation.exists as jest.Mock).mockResolvedValue(null);
    (InboxConversation.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
    loadInboxSettingsMock.mockResolvedValue({
      csatEnabled: true,
      csatThankYou: 'Obrigado!',
      csatPrompt: 'Nota 1-5?',
    });
  });

  it('registra nota 1-5, agradece e emite webhook', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const pending = {
      _id: new mongoose.Types.ObjectId(),
      csatPending: true,
      status: InboxConversationStatus.CLOSED,
      contactIdentifier: '5511999999999',
      csatAssignedUserId: undefined,
      save,
    };
    mockPendingFindOne(pending);

    const handled = await svc['tryHandleCsatReply'](CLIENT_ID, mockDest(), '4');

    expect(handled).toBe(true);
    expect(pending).toMatchObject({ csatScore: 4, csatPending: false });
    expect(save).toHaveBeenCalled();
    expect(webhookEmit).toHaveBeenCalledWith(
      CLIENT_ID,
      'inbox.csat.rated',
      expect.objectContaining({ score: 4 }),
    );
    expect(svc['sendToContact']).toHaveBeenCalledWith(
      CLIENT_ID,
      '5511999999999@s.whatsapp.net',
      'Obrigado!',
    );
  });

  it('saudação com CSAT pendente limpa pendência e libera inbox', async () => {
    mockPendingFindOne({ _id: new mongoose.Types.ObjectId(), csatPending: true });

    const handled = await svc['tryHandleCsatReply'](CLIENT_ID, mockDest(), 'ola preciso de ajuda');

    expect(handled).toBe(false);
    expect(InboxConversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ csatPending: true }),
      { $set: { csatPending: false } },
    );
    expect(svc['sendToContact']).not.toHaveBeenCalled();
  });

  it('ignora CSAT quando há conversa aberta', async () => {
    (InboxConversation.exists as jest.Mock).mockResolvedValue({ _id: 'open' });

    const handled = await svc['tryHandleCsatReply'](CLIENT_ID, mockDest(), '4');

    expect(handled).toBe(false);
    expect(InboxConversation.findOne).not.toHaveBeenCalled();
  });

  it('texto inválido com CSAT pendente reenvia instrução', async () => {
    mockPendingFindOne({
      _id: new mongoose.Types.ObjectId(),
      csatPending: true,
      status: InboxConversationStatus.RESOLVED,
    });

    const handled = await svc['tryHandleCsatReply'](CLIENT_ID, mockDest(), 'obrigado');

    expect(handled).toBe(true);
    expect(svc['sendToContact']).toHaveBeenCalledWith(
      CLIENT_ID,
      '5511999999999@s.whatsapp.net',
      expect.stringContaining('*1*'),
    );
  });

  it('avaliar sem pendência dispara pesquisa na conversa recente', async () => {
    const recent = { _id: new mongoose.Types.ObjectId(), assignedUserId: undefined };
    (InboxConversation.findOne as jest.Mock).mockImplementation((query: Record<string, unknown>) => {
      if (query.csatPending === true) {
        return { sort: () => ({ exec: async () => null }) };
      }
      if (query.csatScore) {
        return { sort: () => ({ exec: async () => recent }) };
      }
      return { sort: () => ({ exec: async () => null }) };
    });
    jest.spyOn(svc, 'maybeSendCsatSurvey' as keyof InboxService).mockResolvedValue(undefined);

    const handled = await svc['tryHandleCsatReply'](CLIENT_ID, mockDest(), 'avaliar');

    expect(handled).toBe(true);
    expect(svc['maybeSendCsatSurvey']).toHaveBeenCalledWith(
      CLIENT_ID,
      recent,
      expect.objectContaining({ csatEnabled: true }),
      undefined,
    );
  });
});

describe('InboxService handleInboundMessage ordem CSAT', () => {
  let svc: InboxPrivate;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = freshInboxService();
    jest.spyOn(svc, 'inboxTriageContextActive' as keyof InboxService).mockResolvedValue(false);
    jest.spyOn(svc, 'sendToContact' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'appendSystemMessage' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'createConversation' as keyof InboxService).mockRejectedValue(
      new Error('createConversation called'),
    );
    (InboxConversation.exists as jest.Mock).mockResolvedValue(null);
    (InboxConversation.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
    loadInboxSettingsMock.mockResolvedValue({
      csatEnabled: true,
      csatThankYou: 'Obrigado!',
      csatPrompt: 'Nota 1-5?',
    });
    findOrCreateContact.mockResolvedValue(mockDest());
    findContactDestinationForInbound.mockResolvedValue(mockDest());
    shouldDeferToConsentFlow.mockReturnValue(false);
    acceptInboundInitiated.mockResolvedValue(true);

    const save = jest.fn().mockResolvedValue(undefined);
    mockPendingFindOne({
      _id: new mongoose.Types.ObjectId(),
      csatPending: true,
      status: InboxConversationStatus.CLOSED,
      contactIdentifier: '5511999999999',
      save,
    });
  });

  it('nota CSAT encerra antes de abrir nova conversa', async () => {
    await svc.handleInboundMessage(CLIENT_ID, '5511999999999@s.whatsapp.net', '5');

    expect(svc['createConversation']).not.toHaveBeenCalled();
    expect(webhookEmit).toHaveBeenCalledWith(
      CLIENT_ID,
      'inbox.csat.rated',
      expect.objectContaining({ score: 5 }),
    );
  });
});
