import mongoose from 'mongoose';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxTicket } from '@/models/InboxTicket';
import { InboxService } from '@/services/inbox/InboxService';
import { InboxConversationStatus } from '@/types/inbox';
import type { IDestination } from '@/models/Destination';
import type { IInboxTicket } from '@/models/InboxTicket';

const loadInboxSettingsMock = jest.fn();
const webhookEmit = jest.fn();
const findOrCreateContact = jest.fn();
const shouldDeferToConsentFlow = jest.fn();
const acceptInboundInitiated = jest.fn();
const consentHandleInbound = jest.fn();

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
jest.mock('@/models/InboxTicket');
jest.mock('@/models/InboxDepartment', () => ({
  InboxDepartment: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { menuKey: '1', name: 'Comercial', isActive: true, clientVisible: true, sortOrder: 1 },
      ]),
    }),
    insertMany: jest.fn(),
  },
}));
jest.mock('@/models/InboxSettings', () => ({
  InboxSettings: {
    getOrCreate: jest.fn().mockResolvedValue({ csatEnabled: true }),
    find: jest.fn().mockReturnValue({
      select: () => ({ lean: async () => [] }),
    }),
  },
}));

jest.mock('@/services/integrations/WebhookDispatcherService', () => ({
  WebhookDispatcherService: {
    getInstance: () => ({ emit: webhookEmit }),
  },
}));

jest.mock('@/services/attendance/attendance-audit.service', () => ({
  recordAttendanceEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/consent/ConsentService', () => ({
  ConsentService: {
    getInstance: () => ({
      findOrCreateContactFromInbound: (...args: unknown[]) => findOrCreateContact(...args),
      shouldDeferToConsentFlow: (...args: unknown[]) => shouldDeferToConsentFlow(...args),
      acceptInboundInitiated: (...args: unknown[]) => acceptInboundInitiated(...args),
      handleInboundMessage: (...args: unknown[]) => consentHandleInbound(...args),
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
const JID = '5511999999999@s.whatsapp.net';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InboxPrivate = InboxService & Record<string, any>;

function mockDest(): IDestination {
  return {
    _id: DEST_ID,
    identifier: JID,
    name: 'Cliente',
  } as IDestination;
}

function freshInboxService(): InboxPrivate {
  (InboxService as unknown as { instance?: InboxService }).instance = undefined;
  return InboxService.getInstance() as InboxPrivate;
}

function mockTicket(overrides: Partial<IInboxTicket> = {}): IInboxTicket {
  return {
    ticketRef: 'TK-ORDER1',
    status: 'closed',
    ticketInboundMode: 'ticket',
    clientReplyPaused: false,
    clientReplyExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    lastTeamMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    teamHasMessagedClient: true,
    clientReplies: [],
    conversationId: new mongoose.Types.ObjectId(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IInboxTicket;
}

function mockTicketFindOne(ticket: IInboxTicket | null) {
  (InboxTicket.findOne as jest.Mock).mockReturnValue({
    sort: jest.fn().mockResolvedValue(ticket),
  });
}

function mockPendingCsatFindOne() {
  const save = jest.fn().mockResolvedValue(undefined);
  (InboxConversation.findOne as jest.Mock).mockImplementation((query: Record<string, unknown>) => {
    if (query.csatPending === true) {
      return {
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: new mongoose.Types.ObjectId(),
            csatPending: true,
            status: InboxConversationStatus.CLOSED,
            contactIdentifier: '5511999999999',
            save,
          }),
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
  return save;
}

function stubNoInboxCompetition() {
  (InboxConversation.findOne as jest.Mock).mockImplementation((query: Record<string, unknown>) => {
    if (query.csatPending === true) {
      return {
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      };
    }
    return {
      select: () => ({
        sort: () => ({
          lean: async () => null,
        }),
      }),
      sort: jest.fn().mockResolvedValue(null),
    };
  });
  (InboxConversation.exists as jest.Mock).mockResolvedValue(null);
}

/** Espelha WhatsAppService: ticket → consent → inbox. */
async function routeLikeWhatsApp(
  svc: InboxPrivate,
  text: string,
): Promise<{ ticketHandled: boolean; consentHandled: boolean; inboxCalled: boolean }> {
  const ticketHandled = await svc.handleTicketInboundMessage(CLIENT_ID, JID, text);
  if (ticketHandled) {
    return { ticketHandled: true, consentHandled: false, inboxCalled: false };
  }

  const consentHandled = await consentHandleInbound(CLIENT_ID, JID, text);
  if (consentHandled) {
    return { ticketHandled: false, consentHandled: true, inboxCalled: false };
  }

  await svc.handleInboundMessage(CLIENT_ID, JID, text);
  return { ticketHandled: false, consentHandled: false, inboxCalled: true };
}

describe('InboxService ordem inbound (espelho WhatsAppService)', () => {
  let svc: InboxPrivate;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = freshInboxService();
    findOrCreateContact.mockResolvedValue(mockDest());
    shouldDeferToConsentFlow.mockReturnValue(false);
    acceptInboundInitiated.mockResolvedValue(true);
    consentHandleInbound.mockResolvedValue(false);
    loadInboxSettingsMock.mockResolvedValue({
      csatEnabled: true,
      csatThankYou: 'Obrigado!',
      csatPrompt: 'Nota 1-5?',
      businessHoursEnabled: false,
    });
    (InboxTicket.find as jest.Mock).mockReturnValue({
      select: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
      limit: () => ({
        lean: async () => [],
      }),
    });
    (InboxConversation.exists as jest.Mock).mockResolvedValue(null);
    (InboxConversation.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(svc, 'startClientReplyGraceMonitor' as keyof InboxService).mockImplementation(() => {});
    jest.spyOn(svc, 'sendToContact' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'appendSystemMessage' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'inboxTriageContextActive' as keyof InboxService).mockResolvedValue(false);
    jest.spyOn(svc, 'contactHasActiveAiTriage' as keyof InboxService).mockResolvedValue(false);
    jest.spyOn(svc, 'getPrimaryOpenConversationStatus' as keyof InboxService).mockResolvedValue(
      undefined,
    );
    jest.spyOn(svc, 'createConversation' as keyof InboxService).mockRejectedValue(
      new Error('createConversation called'),
    );
  });

  it('CSAT no ticket path encerra cadeia antes de consent/inbox', async () => {
    mockPendingCsatFindOne();

    const result = await routeLikeWhatsApp(svc, '5');

    expect(result).toEqual({
      ticketHandled: true,
      consentHandled: false,
      inboxCalled: false,
    });
    expect(consentHandleInbound).not.toHaveBeenCalled();
    expect(svc['createConversation']).not.toHaveBeenCalled();
    expect(InboxTicket.findOne).not.toHaveBeenCalled();
    expect(webhookEmit).toHaveBeenCalledWith(
      CLIENT_ID,
      'inbox.csat.rated',
      expect.objectContaining({ score: 5 }),
    );
  });

  it('complemento ticket captura antes de abrir inbox', async () => {
    const ticket = mockTicket();
    mockTicketFindOne(ticket);
    stubNoInboxCompetition();
    jest.spyOn(svc, 'recordTicketClientReply' as keyof InboxService).mockResolvedValue(undefined);

    const result = await routeLikeWhatsApp(svc, 'segue o comprovante');

    expect(result.ticketHandled).toBe(true);
    expect(result.inboxCalled).toBe(false);
    expect(consentHandleInbound).not.toHaveBeenCalled();
    expect(svc['recordTicketClientReply']).toHaveBeenCalled();
    expect(svc['createConversation']).not.toHaveBeenCalled();
  });

  it('consent tratado bloqueia inbox quando ticket não captura', async () => {
    mockTicketFindOne(null);
    consentHandleInbound.mockResolvedValue(true);

    const result = await routeLikeWhatsApp(svc, 'sim aceito');

    expect(result).toEqual({
      ticketHandled: false,
      consentHandled: true,
      inboxCalled: false,
    });
    expect(svc['createConversation']).not.toHaveBeenCalled();
  });

  it('mensagem livre sem ticket segue até inbox', async () => {
    mockTicketFindOne(null);
    jest.spyOn(svc, 'tryHandleCsatReply' as keyof InboxService).mockResolvedValue(false);
    const inboundSpy = jest
      .spyOn(svc, 'handleInboundMessage' as keyof InboxService)
      .mockResolvedValue(undefined);

    const result = await routeLikeWhatsApp(svc, 'preciso de suporte');

    expect(result.inboxCalled).toBe(true);
    expect(consentHandleInbound).toHaveBeenCalled();
    expect(inboundSpy).toHaveBeenCalled();
    expect(consentHandleInbound.mock.invocationCallOrder[0]).toBeLessThan(
      inboundSpy.mock.invocationCallOrder[0],
    );
  });

  it('novo atendimento libera ticket e permite inbox', async () => {
    const ticket = mockTicket({ status: 'in_progress' });
    mockTicketFindOne(ticket);
    jest.spyOn(svc, 'releaseTicketsForInboxTriage' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'releaseTicketToInbox' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'tryHandleCsatReply' as keyof InboxService).mockResolvedValue(false);
    const inboundSpy = jest
      .spyOn(svc, 'handleInboundMessage' as keyof InboxService)
      .mockResolvedValue(undefined);

    const result = await routeLikeWhatsApp(svc, 'novo atendimento');

    expect(result.ticketHandled).toBe(false);
    expect(result.inboxCalled).toBe(true);
    expect(svc['releaseTicketToInbox']).toHaveBeenCalledWith(ticket);
    expect(inboundSpy).toHaveBeenCalled();
  });
});
