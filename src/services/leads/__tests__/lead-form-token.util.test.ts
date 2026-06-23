import {
  generateLeadFormPublicKey,
  sanitizeLeadText,
  assertLeadFormOrigin,
} from '@/services/leads/lead-form-token.util';
import { isWebChatOriginAllowed } from '@/services/webchat/webchat-token.util';

describe('lead-form-token.util', () => {
  it('generateLeadFormPublicKey usa prefixo lfm_', () => {
    expect(generateLeadFormPublicKey()).toMatch(/^lfm_[a-f0-9]{32}$/);
  });

  it('sanitizeLeadText remove controle e limita tamanho', () => {
    expect(sanitizeLeadText('  João\x00  ', 10)).toBe('João');
    expect(sanitizeLeadText('a'.repeat(20), 5)).toBe('aaaaa');
  });

  it('assertLeadFormOrigin reutiliza allowedDomains do WebChat', () => {
    expect(() =>
      assertLeadFormOrigin(['meusite.com'], 'https://meusite.com', null),
    ).not.toThrow();
    expect(() =>
      assertLeadFormOrigin(['meusite.com'], 'https://outro.com', null),
    ).toThrow(/Origem não autorizada/);
    expect(isWebChatOriginAllowed([], 'https://qualquer.com', null)).toBe(true);
  });
});
