import mongoose from 'mongoose';
import {
  lookupTicketByPublicAccess,
  assignInboxTicketPublicAccessToken,
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

    storeTicketResendOtp({
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
