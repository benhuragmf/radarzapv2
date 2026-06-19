import {
  formatVisitorBridgeMessage,
  parseBridgeReplyRouting,
  isWhatsappBridgeActive,
} from '@/utils/webchat-whatsapp-bridge.util';

describe('webchat-whatsapp-bridge.util', () => {
  it('formats visitor message for WhatsApp forward', () => {
    const text = formatVisitorBridgeMessage({
      ticketRef: 'TK-ABC123',
      visitorName: 'Maria',
      body: 'Preciso de ajuda',
    });
    expect(text).toContain('TK-ABC123');
    expect(text).toContain('Maria');
    expect(text).toContain('Preciso de ajuda');
  });

  it('parses prefixed bridge reply', () => {
    expect(parseBridgeReplyRouting('TK-ABC123 Olá, como posso ajudar?')).toEqual({
      ticketRef: 'TK-ABC123',
      body: 'Olá, como posso ajudar?',
    });
    expect(parseBridgeReplyRouting('Resposta simples')).toEqual({
      body: 'Resposta simples',
    });
  });

  it('detects bridge active flag', () => {
    expect(isWhatsappBridgeActive({ whatsappBridgeActive: true })).toBe(true);
    expect(isWhatsappBridgeActive({ whatsappBridgeActive: false })).toBe(false);
  });
});
