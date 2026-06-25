import mongoose from 'mongoose';
import {
  lookupTicketByPublicAccess,
  assignInboxTicketPublicAccessToken,
  buildTicketPublicLookupResult,
  requestTicketTokenResendOtp,
  confirmTicketTokenResendOtp,
  TICKET_TOKEN_RESEND_REQUEST_MSG,
  TICKET_TOKEN_RESEND_SUCCESS_MSG,
  TICKET_TOKEN_RESEND_OTP_INVALID_MSG,
} from '@/services/inbox/ticket-public-access.service';
import { InboxTicket } from '@/models/InboxTicket';
import {
  resetTicketLookupRateLimits,
  resetTicketTokenResendLimits,
} from '@/services/inbox/ticket-public-lookup-rate-limit';
import { resetTicketTokenResendOtpStore, storeTicketResendOtp } from '@/services/inbox/ticket-token-resend-otp';
import { hashTicketPublicAccessToken } from '@/utils/ticket-public-access.util';

const sendInternalAlert = jest.fn().mockResolvedValue({ success: true });
const emailSend = jest.fn().mockResolvedValue({ ok: true, transport: 'console' });

jest.mock('@/services/whatsapp/WhatsAppService', () => ({
  WhatsAppService: {
    getInstance: () => ({ sendInternalAlert }),
  },
}));
jest.mock('@/services/email/EmailService', () => ({
  EmailService: {
    getInstance: () => ({ send: emailSend }),
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
jest.mock('@/services/attendance/attendance-audit.service', () => ({
  recordAttendanceEvent: jest.fn().mockResolvedValue(undefined),
}));

import { recordAttendanceEvent } from '@/services/attendance/attendance-audit.service';

describe('ticket-public-access.service lookup', () => {
  const clientId = new mongoose.Types.ObjectId().toString();

  function mockFindOneTicket(ticket: object | null) {
    (InboxTicket.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(ticket),
    });
  }

  beforeEach(() => {
    resetTicketLookupRateLimits();
    resetTicketTokenResendLimits();
    resetTicketTokenResendOtpStore();
    jest.clearAllMocks();
  });

  it('rejects wrong token without revealing ticket existence', async () => {
    const token = 'ABCD-EFGH';
    mockFindOneTicket({
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

    expect(recordAttendanceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'ticket.public_lookup_failed',
        meta: expect.objectContaining({ reason: 'invalid_token' }),
      }),
    );
    const auditMeta = (recordAttendanceEvent as jest.Mock).mock.calls[0][0].meta;
    expect(JSON.stringify(auditMeta)).not.toContain('WRONG-TOK1');

    mockFindOneTicket(null);

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
    mockFindOneTicket({
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

  it('keeps token messages in webchat public lookup when chat is long', async () => {
    const wcId = new mongoose.Types.ObjectId();
    const filler = Array.from({ length: 25 }, (_, i) => ({
      body: `Mensagem ${i}`,
      createdAt: new Date(`2026-06-21T10:${String(i).padStart(2, '0')}:00Z`),
      direction: 'inbound',
    }));
    const tokenMsg = {
      body: 'Seu chamado foi registrado.\n\nToken de consulta: *ABCD-1234*',
      createdAt: new Date('2026-06-21T09:00:00Z'),
      direction: 'system',
    };
    const { WebChatMessage } = await import('@/models/WebChatMessage');
    (WebChatMessage.find as jest.Mock).mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [...filler].reverse().concat(tokenMsg),
        }),
      }),
    });

    const result = await buildTicketPublicLookupResult({
      ticketRef: 'TK-WC001',
      status: 'in_progress',
      channel: 'webchat_site',
      webChatConversationId: wcId,
      clientReplies: [],
      subject: 'Suporte',
      createdAt: new Date('2026-06-21T09:00:00Z'),
      updatedAt: new Date('2026-06-21T17:00:00Z'),
    } as Parameters<typeof buildTicketPublicLookupResult>[0]);

    expect(result.subject).toBe('Suporte');
    expect(result.recentMessages.some(m => m.body.includes('Token de consulta'))).toBe(true);
  });

  it('hides intake and placeholder subject from webchat public lookup', async () => {
    const wcId = new mongoose.Types.ObjectId();
    const { WebChatMessage } = await import('@/models/WebChatMessage');
    (WebChatMessage.find as jest.Mock).mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [
            {
              body: '📋 Dados do visitante\nNome: Benhur',
              createdAt: new Date('2026-06-21T09:00:00Z'),
              direction: 'system',
            },
            {
              body: 'Bridge WhatsApp ativo — mensagens do visitante',
              createdAt: new Date('2026-06-21T09:05:00Z'),
              direction: 'system',
            },
            {
              body: 'Token de consulta: *ABCD-1234*',
              createdAt: new Date('2026-06-21T09:10:00Z'),
              direction: 'system',
            },
          ],
        }),
      }),
    });

    const result = await buildTicketPublicLookupResult({
      ticketRef: 'TK-WC002',
      status: 'in_progress',
      channel: 'webchat_site',
      webChatConversationId: wcId,
      clientReplies: [],
      subject: 'motivo… Ex.: @suporte2, @financeiro',
      createdAt: new Date('2026-06-21T09:00:00Z'),
      updatedAt: new Date('2026-06-21T17:00:00Z'),
    } as Parameters<typeof buildTicketPublicLookupResult>[0]);

    expect(result.subject).toBeUndefined();
    expect(result.recentMessages.some(m => m.body.includes('Dados do visitante'))).toBe(false);
    expect(result.recentMessages.some(m => m.body.includes('Bridge WhatsApp'))).toBe(false);
    expect(result.recentMessages.some(m => m.body.includes('Token de consulta'))).toBe(true);
  });

  it('does not expose internal notes in public lookup', async () => {
    const result = await buildTicketPublicLookupResult({
      ticketRef: 'TK-INT001',
      status: 'in_progress',
      channel: 'whatsapp',
      clientReplies: [{ body: 'Mensagem do cliente', createdAt: new Date() }],
      internalNotesList: [
        {
          body: 'Nota interna confidencial — não deve vazar',
          createdAt: new Date(),
          userId: new mongoose.Types.ObjectId(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Parameters<typeof buildTicketPublicLookupResult>[0]);

    expect(
      result.recentMessages.some(m => m.body.includes('Nota interna confidencial')),
    ).toBe(false);
  });

  it('includes ticket follow-up comments in webchat public lookup', async () => {
    const wcId = new mongoose.Types.ObjectId();
    const { WebChatMessage } = await import('@/models/WebChatMessage');
    (WebChatMessage.find as jest.Mock).mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [
            {
              body: 'Token de consulta: *ABCD-1234*',
              createdAt: new Date('2026-06-21T09:10:00Z'),
              direction: 'system',
            },
          ],
        }),
      }),
    });

    const result = await buildTicketPublicLookupResult({
      ticketRef: 'TK-WC003',
      status: 'in_progress',
      channel: 'webchat_site',
      webChatConversationId: wcId,
      clientReplies: [],
      comments: [
        {
          body: 'Estamos dando andamento no ticket',
          createdAt: new Date('2026-06-21T17:11:26Z'),
        },
      ],
      createdAt: new Date('2026-06-21T09:00:00Z'),
      updatedAt: new Date('2026-06-21T17:11:26Z'),
    } as Parameters<typeof buildTicketPublicLookupResult>[0]);

    expect(
      result.recentMessages.some(m => m.body.includes('Estamos dando andamento no ticket')),
    ).toBe(true);
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

describe('ticket token resend OTP flow', () => {
  const clientId = new mongoose.Types.ObjectId().toString();

  function mockFindOneTicket(ticket: object | null) {
    (InboxTicket.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(ticket),
    });
  }

  beforeEach(() => {
    resetTicketLookupRateLimits();
    resetTicketTokenResendLimits();
    resetTicketTokenResendOtpStore();
    sendInternalAlert.mockClear();
    emailSend.mockClear();
    jest.clearAllMocks();
  });

  it('sends OTP via WhatsApp when phone matches ticket', async () => {
    mockFindOneTicket({
      ticketRef: 'TK-L402V2',
      contactIdentifier: '5566996819456',
      save: jest.fn().mockResolvedValue(undefined),
    });

    const result = await requestTicketTokenResendOtp({
      clientId,
      ticketRef: 'L402V2',
      channel: 'whatsapp',
      phone: '66996819456',
      remoteIp: '127.0.0.1',
    });

    expect(result.message).toBe(TICKET_TOKEN_RESEND_REQUEST_MSG);
    expect(sendInternalAlert).toHaveBeenCalledTimes(1);
    expect(sendInternalAlert.mock.calls[0][2]).toMatch(/Código:/);
    expect(emailSend).not.toHaveBeenCalled();
  });

  it('delivers access token after valid OTP confirm', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    mockFindOneTicket({
      ticketRef: 'TK-L402V2',
      contactIdentifier: '5566996819456',
      save,
    });

    await requestTicketTokenResendOtp({
      clientId,
      ticketRef: 'L402V2',
      channel: 'whatsapp',
      phone: '66996819456',
      remoteIp: '127.0.0.1',
    });

    const otpText = sendInternalAlert.mock.calls[0][2] as string;
    const codeMatch = otpText.match(/Código: \*(\d{6})\*/);
    expect(codeMatch).toBeTruthy();
    const code = codeMatch![1]!;

    sendInternalAlert.mockClear();

    const result = await confirmTicketTokenResendOtp({
      clientId,
      ticketRef: 'L402V2',
      channel: 'whatsapp',
      phone: '66996819456',
      verificationCode: code,
      remoteIp: '127.0.0.1',
    });

    expect(result.ok).toBe(true);
    expect(result.message).toBe(TICKET_TOKEN_RESEND_SUCCESS_MSG);
    expect(sendInternalAlert).toHaveBeenCalledTimes(1);
    expect(sendInternalAlert.mock.calls[0][2]).toMatch(/Token:/);
    expect(save).toHaveBeenCalled();
  });

  it('sends OTP via email when address matches ticket', async () => {
    mockFindOneTicket({
      ticketRef: 'TK-EMAIL1',
      contactIdentifier: 'cliente@example.com',
      contactName: 'Cliente',
      save: jest.fn().mockResolvedValue(undefined),
    });

    const result = await requestTicketTokenResendOtp({
      clientId,
      ticketRef: 'TK-EMAIL1',
      channel: 'email',
      email: 'Cliente@Example.com',
      remoteIp: '127.0.0.1',
    });

    expect(result.message).toBe(TICKET_TOKEN_RESEND_REQUEST_MSG);
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(sendInternalAlert).not.toHaveBeenCalled();
  });

  it('returns generic message without sending when contact mismatches', async () => {
    mockFindOneTicket({
      ticketRef: 'TK-L402V2',
      contactIdentifier: '5566996819456',
      save: jest.fn(),
    });

    const result = await requestTicketTokenResendOtp({
      clientId,
      ticketRef: 'TK-L402V2',
      channel: 'whatsapp',
      phone: '11999998888',
      remoteIp: '127.0.0.1',
    });

    expect(result.message).toBe(TICKET_TOKEN_RESEND_REQUEST_MSG);
    expect(sendInternalAlert).not.toHaveBeenCalled();
    expect(emailSend).not.toHaveBeenCalled();
  });

  it('rejects invalid OTP on confirm', async () => {
    mockFindOneTicket({
      ticketRef: 'TK-L402V2',
      contactIdentifier: '5566996819456',
      save: jest.fn(),
    });

    await storeTicketResendOtp({
      clientId,
      ticketRef: 'TK-L402V2',
      contact: '66996819456',
      channel: 'whatsapp',
      code: '111222',
    });

    const result = await confirmTicketTokenResendOtp({
      clientId,
      ticketRef: 'TK-L402V2',
      channel: 'whatsapp',
      phone: '66996819456',
      verificationCode: '999888',
      remoteIp: '127.0.0.1',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe(TICKET_TOKEN_RESEND_OTP_INVALID_MSG);
    expect(sendInternalAlert).not.toHaveBeenCalled();
  });
});
