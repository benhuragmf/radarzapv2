import mongoose from 'mongoose';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxTicket } from '@/models/InboxTicket';
import { InboxService } from '@/services/inbox/InboxService';
import type { IInboxTicket } from '@/models/InboxTicket';

const recordAttendanceEvent = jest.fn().mockResolvedValue(undefined);
const webhookEmit = jest.fn();

jest.mock('@/services/attendance/attendance-audit.service', () => ({
  recordAttendanceEvent: (...args: unknown[]) => recordAttendanceEvent(...args),
}));

jest.mock('@/services/integrations/WebhookDispatcherService', () => ({
  WebhookDispatcherService: {
    getInstance: () => ({ emit: webhookEmit }),
  },
}));

jest.mock('@/models/InboxConversation');
jest.mock('@/models/InboxMessage', () => ({
  InboxMessage: { create: jest.fn().mockResolvedValue({}) },
}));
jest.mock('@/models/InboxTicket');
jest.mock('@/models/InboxSettings', () => ({
  InboxSettings: {
    getOrCreate: jest.fn().mockResolvedValue({ csatEnabled: true }),
  },
}));

const CLIENT_ID = new mongoose.Types.ObjectId().toString();
const CONV_ID = new mongoose.Types.ObjectId();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InboxPrivate = InboxService & Record<string, any>;

function freshInboxService(): InboxPrivate {
  (InboxService as unknown as { instance?: InboxService }).instance = undefined;
  return InboxService.getInstance() as InboxPrivate;
}

function mockTicket(overrides: Partial<IInboxTicket> = {}): IInboxTicket {
  return {
    ticketRef: 'TK-AUDIT1',
    contactIdentifier: '5511999999999',
    conversationId: CONV_ID,
    clientReplies: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IInboxTicket;
}

describe('InboxService ticket audit log', () => {
  let svc: InboxPrivate;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = freshInboxService();
    (InboxConversation.findById as jest.Mock).mockResolvedValue(null);
    jest.spyOn(svc, 'sendToContact' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'recordInbound' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'appendSystemMessage' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'applyTicketClientReplySla' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'scheduleClientReplyGrace' as keyof InboxService).mockImplementation(() => {});
    jest.spyOn(svc, 'notifyClientRepliedToAssignee' as keyof InboxService).mockResolvedValue(undefined);
    jest.spyOn(svc, 'notifyTicketUpdated' as keyof InboxService).mockImplementation(() => {});
  });

  it('registra ticket.client_replied no audit log (sem corpo)', async () => {
    const ticket = mockTicket();

    await svc['recordTicketClientReply'](CLIENT_ID, '5511999999999', ticket, 'Olá equipe', undefined);

    expect(recordAttendanceEvent).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      kind: 'ticket.client_replied',
      ticketRef: 'TK-AUDIT1',
      conversationId: String(CONV_ID),
      meta: {
        bodyLength: 10,
        media_type: null,
      },
    });
    expect(webhookEmit).toHaveBeenCalledWith(
      CLIENT_ID,
      'ticket.client_replied',
      expect.objectContaining({ body_preview: 'Olá equipe' }),
    );
  });

  it('não registra audit em ack de leitura', async () => {
    const ticket = mockTicket();

    await svc['recordTicketClientReply'](CLIENT_ID, '5511999999999', ticket, 'ok', undefined);

    expect(recordAttendanceEvent).not.toHaveBeenCalled();
    expect(webhookEmit).not.toHaveBeenCalled();
  });

  it('registra ticket.reopened ao reabrir chamado', async () => {
    const ticketId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId().toString();
    const ticket = mockTicket({
      _id: ticketId,
      status: 'closed',
      closedAt: new Date(),
      conversationId: CONV_ID,
    });
    (InboxTicket.findOne as jest.Mock).mockResolvedValue(ticket);
    (InboxConversation.findById as jest.Mock).mockResolvedValue(null);
    jest.spyOn(svc, 'resolveAgentDisplayName' as keyof InboxService).mockResolvedValue('Agente');
    jest
      .spyOn(svc, 'getConversationIfAllowed' as keyof InboxService)
      .mockResolvedValue({ _id: CONV_ID } as never);

    await svc.reopenTicket(CLIENT_ID, userId, 'TK-AUDIT1');

    expect(recordAttendanceEvent).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      kind: 'ticket.reopened',
      ticketRef: 'TK-AUDIT1',
      conversationId: String(CONV_ID),
      actorUserId: userId,
    });
  });
});
