import mongoose from 'mongoose';
import {
  lookupTicketByPublicAccess,
  assignInboxTicketPublicAccessToken,
  resendTicketPublicAccessTokenViaWhatsApp,
  TICKET_TOKEN_RESEND_SUCCESS_MSG,
} from '@/services/inbox/ticket-public-access.service';
import { InboxTicket } from '@/models/InboxTicket';
import {
  resetTicketLookupRateLimits,
  resetTicketTokenResendLimits,
} from '@/services/inbox/ticket-public-lookup-rate-limit';
import { hashTicketPublicAccessToken } from '@/utils/ticket-public-access.util';

const sendInternalAlert = jest.fn().mockResolvedValue({ success: true });

jest.mock('@/services/whatsapp/WhatsAppService', () => ({
  WhatsAppService: {
    getInstance: () => ({ sendInternalAlert }),
  },
}));
jest.mock('@/models/InboxTicket');
jest.mock('@/models/InboxDepartment', () => ({
  InboxDepartment: { findById: jest.fn().mockReturnValue({ select: () => ({ lean: async () => null }) }) },
}));
jest.mock('@/models/Destination', () => ({
  Destination: { findById: jest.fn().mockReturnValue({ select: () => ({ lean: async () => null }) }) },
}));
jest.mock('@/models/WebChatConversation', () => ({
  WebChatConversation: { findById: jest.fn().mockReturnValue({ select: () => ({ lean: async () => null }) }) },
}));
jest.mock('@/models/WebChatMessage', () => ({
  WebChatMessage: { find: jest.fn().mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) },
}));

describe('ticket-public-access.service lookup', () => {
  const clientId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    resetTicketLookupRateLimits();
    resetTicketTokenResendLimits();
    jest.clearAllMocks();
  });

  it('rejects wrong token without revealing ticket existence', async () => {
    const token = 'ABCD-EFGH';
    (InboxTicket.findOne as jest.Mock).mockResolvedValue({
      ticketRef: 'TK-TEST01',
      status: 'open',
      channel: 'whatsapp',
      clientReplies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      publicAccessTokenHash: hashTicketPublicAccessToken(token),
    });

    await expect(
      lookupTicketByPublicAccess({
        clientId,
        ticketRef: 'TK-TEST01',
        accessToken: 'WRONG-TOK1',
        remoteIp: '1.2.3.4',
      }),
    ).rejects.toThrow(/Não encontramos/);

    (InboxTicket.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      lookupTicketByPublicAccess({
        clientId,
        ticketRef: 'TK-MISSING',
        accessToken: token,
        remoteIp: '1.2.3.4',
      }),
    ).rejects.toThrow(/Não encontramos/);
  });

  it('returns ticket on valid ref and token', async () => {
    const token = 'WXYZ-2345';
    (InboxTicket.findOne as jest.Mock).mockResolvedValue({
      ticketRef: 'TK-VALID1',
      status: 'in_progress',
      channel: 'whatsapp',
      clientReplies: [{ body: 'Oi', createdAt: new Date() }],
      createdAt: new Date('2026-06-01T10:00:00Z'),
      updatedAt: new Date('2026-06-18T14:35:00Z'),
      publicAccessTokenHash: hashTicketPublicAccessToken(token),
    });

    const result = await lookupTicketByPublicAccess({
      clientId,
      ticketRef: 'TK-VALID1',
      accessToken: token,
      remoteIp: '10.0.0.1',
    });

    expect(result.ticketRef).toBe('TK-VALID1');
    expect(result.statusLabel).toBe('Em andamento');
    expect(result.recentMessages.length).toBe(1);
  });
});

describe('assignInboxTicketPublicAccessToken', () => {
  it('persists hash and hint', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const ticket = {
      publicAccessTokenHash: undefined,
      save,
    } as unknown as Parameters<typeof assignInboxTicketPublicAccessToken>[0];

    const token = await assignInboxTicketPublicAccessToken(ticket);
    expect(token).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(ticket.publicAccessTokenHint).toHaveLength(4);
    expect(ticket.publicAccessTokenHash).toHaveLength(64);
    expect(save).toHaveBeenCalled();
  });
});

describe('resendTicketPublicAccessTokenViaWhatsApp', () => {
  const clientId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    resetTicketLookupRateLimits();
    resetTicketTokenResendLimits();
    sendInternalAlert.mockClear();
    jest.clearAllMocks();
  });

  it('sends new token when phone matches ticket', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    (InboxTicket.findOne as jest.Mock).mockResolvedValue({
      ticketRef: 'TK-L402V2',
      contactIdentifier: '5566996819456',
      save,
    });

    const result = await resendTicketPublicAccessTokenViaWhatsApp({
      clientId,
      ticketRef: 'L402V2',
      phone: '66996819456',
      remoteIp: '127.0.0.1',
    });

    expect(result.message).toBe(TICKET_TOKEN_RESEND_SUCCESS_MSG);
    expect(sendInternalAlert).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalled();
  });

  it('returns generic message without sending when phone mismatches', async () => {
    (InboxTicket.findOne as jest.Mock).mockResolvedValue({
      ticketRef: 'TK-L402V2',
      contactIdentifier: '5566996819456',
      save: jest.fn(),
    });

    const result = await resendTicketPublicAccessTokenViaWhatsApp({
      clientId,
      ticketRef: 'TK-L402V2',
      phone: '11999998888',
      remoteIp: '127.0.0.1',
    });

    expect(result.message).toBe(TICKET_TOKEN_RESEND_SUCCESS_MSG);
    expect(sendInternalAlert).not.toHaveBeenCalled();
  });
});
