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
      select: () => ({
        lean: async () => [],
      }),
    }),
  },
}));

jest.mock('@/services/integrations/WebhookDispatcherService', () => ({
  WebhookDispatcherService: {
    getInstance: () => ({ emit: webhookEmit }),
  },
}));

jest.mock('@/services/consent/ConsentService', () => ({
  ConsentService: {
    getInstance: () => ({
      findOrCreateContactFromInbound: (...args: unknown[]) => findOrCreateContact(...args),
      shouldDeferToConsentFlow: (...args: unknown[]) => shouldDeferToConsentFlow(...args),
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
    ticketRef: 'TK-TEST01',
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

function stubNoInboxCompetition() {
  (InboxConversation.findOne as jest.Mock).mockReturnValue({
    select: () => ({
      sort: () => ({
        lean: async () => null,
      }),
    }),
    sort: jest.fn().mockResolvedValue(null),
  });
  (InboxConversation.exists as jest.Mock).mockResolvedValue(null);
}

describe('InboxService handleTicketInboundMessage (integração)', () => {
  let svc: InboxPrivate;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = freshInboxService();
    jest.spyOn(svc, 'startClientReplyGraceMonitor' as keyof InboxService).mockImplementation(() => {});
    findOrCreateContact.mockResolvedValue(mockDest());
    shouldDeferToConsentFlow.mockReturnValue(false);
    loadInboxSettingsMock.mockResolvedValue({
      csatEnabled: true,
      csatThankYou: 'Obrigado!',
      csatPrompt: 'Nota 1-5?',
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
    jest.spyOn(svc, 'sendToContact' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'inboxTriageContextActive' as keyof InboxService).mockResolvedValue(false);
    jest.spyOn(svc, 'contactHasActiveAiTriage' as keyof InboxService).mockResolvedValue(false);
    jest.spyOn(svc, 'getPrimaryOpenConversationStatus' as keyof InboxService).mockResolvedValue(
      undefined,
    );
    jest.spyOn(svc, 'tryHandleCsatReply' as keyof InboxService).mockResolvedValue(false);
  });

  it('novo atendimento libera ticket e retorna false para inbox', async () => {
    const ticket = mockTicket({ status: 'in_progress' });
    mockTicketFindOne(ticket);
    jest.spyOn(svc, 'releaseTicketsForInboxTriage' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'releaseTicketToInbox' as keyof InboxService).mockResolvedValue(undefined);

    const result = await svc.handleTicketInboundMessage(CLIENT_ID, JID, 'novo atendimento');

    expect(result).toBe(false);
    expect(svc['releaseTicketsForInboxTriage']).toHaveBeenCalledWith(CLIENT_ID, DEST_ID);
    expect(svc['releaseTicketToInbox']).toHaveBeenCalledWith(ticket);
  });

  it('complemento na janela 12h grava resposta no ticket', async () => {
    const ticket = mockTicket({
      status: 'closed',
      ticketInboundMode: 'ticket',
      clientReplyExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      lastTeamMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });
    mockTicketFindOne(ticket);
    stubNoInboxCompetition();
    jest.spyOn(svc, 'recordTicketClientReply' as keyof InboxService).mockResolvedValue(undefined);

    const result = await svc.handleTicketInboundMessage(CLIENT_ID, JID, 'segue o comprovante');

    expect(result).toBe(true);
    expect(svc['recordTicketClientReply']).toHaveBeenCalledWith(
      CLIENT_ID,
      JID,
      ticket,
      'segue o comprovante',
      undefined,
    );
  });

  it('ticket fechado antigo com expires inflado libera inbox', async () => {
    const ticket = mockTicket({
      status: 'closed',
      ticketInboundMode: 'ticket',
      clientReplyExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      lastTeamMessageAt: new Date('2026-06-01T10:00:00.000Z'),
    });
    mockTicketFindOne(ticket);
    stubNoInboxCompetition();
    jest.spyOn(svc, 'releaseTicketToInbox' as keyof InboxService).mockResolvedValue(undefined);

    const result = await svc.handleTicketInboundMessage(CLIENT_ID, JID, 'avaliar');

    expect(result).toBe(false);
    expect(svc['releaseTicketToInbox']).toHaveBeenCalledWith(ticket);
  });

  it('inbox na fila compete e bloqueia ticket antigo pausado', async () => {
    const ticket = mockTicket({
      status: 'closed',
      ticketInboundMode: undefined,
      clientReplyPaused: true,
    });
    mockTicketFindOne(ticket);
    (InboxConversation.findOne as jest.Mock).mockReturnValue({
      select: () => ({
        sort: () => ({
          lean: async () => ({ status: InboxConversationStatus.WAITING_QUEUE }),
        }),
      }),
    });
    jest.spyOn(svc, 'recordTicketClientReply' as keyof InboxService).mockResolvedValue(undefined);

    const result = await svc.handleTicketInboundMessage(CLIENT_ID, JID, 'ok');

    expect(result).toBe(false);
    expect(svc['recordTicketClientReply']).not.toHaveBeenCalled();
  });

  it('CSAT tem prioridade sobre roteamento de ticket', async () => {
    jest.spyOn(svc, 'tryHandleCsatReply' as keyof InboxService).mockRestore();
    (InboxConversation.exists as jest.Mock).mockResolvedValue(null);
    (InboxConversation.findOne as jest.Mock).mockImplementation((query: Record<string, unknown>) => {
      if (query.csatPending === true) {
        const save = jest.fn().mockResolvedValue(undefined);
        return {
          sort: () => ({
            exec: async () => ({
              _id: new mongoose.Types.ObjectId(),
              csatPending: true,
              status: InboxConversationStatus.CLOSED,
              contactIdentifier: '5511999999999',
              save,
            }),
          }),
        };
      }
      return { sort: () => ({ exec: async () => null }) };
    });
    (InboxConversation.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(svc, 'appendSystemMessage' as keyof InboxService).mockResolvedValue(undefined);
    mockTicketFindOne(mockTicket());

    const result = await svc.handleTicketInboundMessage(CLIENT_ID, JID, '5');

    expect(result).toBe(true);
    expect(InboxTicket.findOne).not.toHaveBeenCalled();
    expect(webhookEmit).toHaveBeenCalledWith(
      CLIENT_ID,
      'inbox.csat.rated',
      expect.objectContaining({ score: 5 }),
    );
  });
});
