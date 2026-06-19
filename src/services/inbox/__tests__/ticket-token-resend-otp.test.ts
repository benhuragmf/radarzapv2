import {
  generateTicketResendOtpCode,
  resetTicketTokenResendOtpStore,
  storeTicketResendOtp,
  verifyTicketResendOtp,
} from '@/services/inbox/ticket-token-resend-otp';

describe('ticket-token-resend-otp', () => {
  beforeEach(() => {
    resetTicketTokenResendOtpStore();
  });

  it('generates 6-digit codes', () => {
    const code = generateTicketResendOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifies valid OTP and consumes entry', async () => {
    const clientId = 'client1';
    const ticketRef = 'TK-TEST';
    const contact = '66996819456';
    const code = '482910';

    await storeTicketResendOtp({
      clientId,
      ticketRef,
      contact,
      channel: 'whatsapp',
      code,
    });

    expect(
      await verifyTicketResendOtp({
        clientId,
        ticketRef,
        contact,
        code,
        channel: 'whatsapp',
      }),
    ).toBe(true);

    expect(
      await verifyTicketResendOtp({
        clientId,
        ticketRef,
        contact,
        code,
        channel: 'whatsapp',
      }),
    ).toBe(false);
  });

  it('rejects wrong channel', async () => {
    await storeTicketResendOtp({
      clientId: 'c1',
      ticketRef: 'TK-A',
      contact: 'a@b.com',
      channel: 'email',
      code: '123456',
    });

    expect(
      await verifyTicketResendOtp({
        clientId: 'c1',
        ticketRef: 'TK-A',
        contact: 'a@b.com',
        code: '123456',
        channel: 'whatsapp',
      }),
    ).toBe(false);
  });
});
