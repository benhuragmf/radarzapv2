import {
  generateWebChatPublicKey,
  generateWebChatVisitorToken,
  hashWebChatVisitorToken,
  isWebChatOriginAllowed,
} from '../webchat-token.util';

describe('webchat-token.util', () => {
  it('gera chaves com prefixos esperados', () => {
    expect(generateWebChatPublicKey()).toMatch(/^wck_[a-f0-9]{32}$/);
    expect(generateWebChatVisitorToken()).toMatch(/^wcv_[a-f0-9]{48}$/);
  });

  it('hash de visitante é determinístico', () => {
    const token = 'wcv_abc';
    expect(hashWebChatVisitorToken(token)).toBe(hashWebChatVisitorToken(token));
  });

  it('allowedDomains vazio libera qualquer origem', () => {
    expect(isWebChatOriginAllowed([], 'https://cliente.com', null)).toBe(true);
  });

  it('valida domínio exato e wildcard', () => {
    const allowed = ['meusite.com', '*.loja.com'];
    expect(isWebChatOriginAllowed(allowed, 'https://meusite.com', null)).toBe(true);
    expect(isWebChatOriginAllowed(allowed, 'https://app.loja.com', null)).toBe(true);
    expect(isWebChatOriginAllowed(allowed, 'https://outro.com', null)).toBe(false);
  });
});
