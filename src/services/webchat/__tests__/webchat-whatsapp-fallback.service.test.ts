import {
  buildWhatsAppFallbackAlertBody,
  normalizeWhatsAppAlertDestination,
} from '@/services/webchat/webchat-whatsapp-fallback.service';

describe('webchat-whatsapp-fallback', () => {
  it('normalizes phone and group destinations', () => {
    expect(normalizeWhatsAppAlertDestination('5511999887766')).toBe('5511999887766');
    expect(normalizeWhatsAppAlertDestination('120363012345678901@g.us')).toBe(
      '120363012345678901@g.us',
    );
    expect(normalizeWhatsAppAlertDestination('abc')).toBeNull();
  });

  it('builds alert body with ticket and commands', () => {
    const body = buildWhatsAppFallbackAlertBody({
      ticketRef: 'TK-ABC123',
      visitorName: 'Maria',
      visitorPhone: '5511999887766',
      pageUrl: 'https://loja.com/produto',
      initialMessage: 'Preciso de ajuda',
    });
    expect(body).toContain('TK-ABC123');
    expect(body).toContain('!assumir ABC123');
    expect(body).toContain('Maria');
  });
});
