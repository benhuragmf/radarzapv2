import {
  buildWhatsAppInboxFallbackAlertBody,
  inboxConvToFallbackTiming,
  resetInboxQueueFallbackState,
} from '@/services/inbox/inbox-whatsapp-fallback.service';

describe('inbox-whatsapp-fallback', () => {
  it('builds alert body for WhatsApp queue with assumir command', () => {
    const body = buildWhatsAppInboxFallbackAlertBody({
      ticketRef: 'TK-XYZ789',
      contactName: 'Carolina',
      contactPhone: '556684240564',
      departmentName: 'Comercial',
      initialMessage: 'Falar com atendente',
    });
    expect(body).toContain('TK-XYZ789');
    expect(body).toContain('!assumir XYZ789');
    expect(body).toContain('Carolina');
    expect(body).toContain('Comercial');
  });

  it('maps inbox conversation to fallback timing shape', () => {
    const conv = {
      clientId: '507f1f77bcf86cd799439011',
      suggestedUserId: { toString: () => 'user1' },
      suggestedAt: new Date('2026-06-28T10:00:00Z'),
      queueEnteredAt: new Date('2026-06-28T09:55:00Z'),
    } as never;
    const timing = inboxConvToFallbackTiming(conv);
    expect(timing.suggestedUserId).toBe('user1');
    expect(timing.queueEnteredAt).toEqual(new Date('2026-06-28T09:55:00Z'));
  });

  it('clears fallback queue state fields', () => {
    const conv = {
      whatsappFallbackTriedUserIds: ['a'],
      whatsappFallbackWaNotifiedUserId: 'a',
      whatsappFallbackWaNotifiedAt: new Date(),
      whatsappFallbackClientNotifiedAt: new Date(),
      whatsappFallbackAlertSentAt: new Date(),
      whatsappFallbackPriorityStartedAt: new Date(),
    } as import('@/models/InboxConversation').IInboxConversation;
    resetInboxQueueFallbackState(conv);
    expect(conv.whatsappFallbackTriedUserIds).toBeUndefined();
    expect(conv.whatsappFallbackAlertSentAt).toBeUndefined();
  });
});
