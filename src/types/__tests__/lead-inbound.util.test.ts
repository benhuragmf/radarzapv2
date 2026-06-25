import {
  shouldCreateLeadFromWebChatSession,
  shouldCreateLeadFromWhatsAppInbound,
} from '@/types/lead-inbound.util';

describe('lead-inbound.util', () => {
  it('WhatsApp genérico não cria lead no primeiro contato', () => {
    expect(
      shouldCreateLeadFromWhatsAppInbound({
        isNewContact: true,
        isNewConversation: true,
        message: 'Oi',
      }),
    ).toBe(false);
  });

  it('WhatsApp comercial cria lead no primeiro contato', () => {
    expect(
      shouldCreateLeadFromWhatsAppInbound({
        isNewContact: true,
        isNewConversation: true,
        message: 'Quero orçamento',
      }),
    ).toBe(true);
  });

  it('WhatsApp retorno (nova conversa) cria lead mesmo sem intenção forte', () => {
    expect(
      shouldCreateLeadFromWhatsAppInbound({
        isNewContact: false,
        isNewConversation: true,
        message: 'Olá',
      }),
    ).toBe(true);
  });

  it('não cria lead em conversa já aberta', () => {
    expect(
      shouldCreateLeadFromWhatsAppInbound({
        isNewContact: false,
        isNewConversation: false,
        message: 'Quero comprar',
      }),
    ).toBe(false);
  });

  it('WebChat genérico sem contato prévio não cria lead', () => {
    expect(
      shouldCreateLeadFromWebChatSession({
        hadExistingContact: false,
        isNewConversation: true,
        message: 'Oi',
      }),
    ).toBe(false);
  });

  it('WebChat com intenção comercial cria lead', () => {
    expect(
      shouldCreateLeadFromWebChatSession({
        hadExistingContact: false,
        isNewConversation: true,
        message: 'Preciso de cotação',
      }),
    ).toBe(true);
  });

  it('WebChat retorno cria lead em nova sessão', () => {
    expect(
      shouldCreateLeadFromWebChatSession({
        hadExistingContact: true,
        isNewConversation: true,
      }),
    ).toBe(true);
  });
});
