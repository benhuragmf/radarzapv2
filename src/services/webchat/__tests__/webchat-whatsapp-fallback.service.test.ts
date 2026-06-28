import {
  buildWhatsAppFallbackAlertBody,
  filterFallbackAlertPhones,
  normalizeWhatsAppAlertDestination,
  pickNextFallbackAgent,
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
    expect(body).not.toMatch(/wck_/i);
    expect(body.toLowerCase()).not.toContain('clientid');
  });

  it('filterFallbackAlertPhones skips session-own number', () => {
    const phones = ['5511999887766', '5511888776655', '120363012345678901@g.us'];
    const filtered = filterFallbackAlertPhones(phones, '5511999887766');
    expect(filtered).toEqual(['5511888776655', '120363012345678901@g.us']);
  });

  it('pickNextFallbackAgent rotates through team without repeating', () => {
    const agents = [
      { userId: 'a1', displayName: 'Ana', whatsappPhone: '5511111111111' },
      { userId: 'a2', displayName: 'Bia', whatsappPhone: '5511222222222' },
      { userId: 'a3', displayName: 'Caio', whatsappPhone: '5511333333333' },
    ];
    expect(pickNextFallbackAgent(agents, [], null)?.userId).toBe('a1');
    expect(pickNextFallbackAgent(agents, [], 'a1')?.userId).toBe('a2');
    expect(pickNextFallbackAgent(agents, ['a1'], 'a1')?.userId).toBe('a2');
    expect(pickNextFallbackAgent(agents, ['a1', 'a2'], 'a2')?.userId).toBe('a3');
    expect(pickNextFallbackAgent(agents, ['a1', 'a2', 'a3'], 'a3')).toBeNull();
  });
});
