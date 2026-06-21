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

  it('em desenvolvimento libera localhost mesmo com allowedDomains restrito', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const allowed = ['meusite.com'];
      expect(isWebChatOriginAllowed(allowed, 'http://localhost:5174', null)).toBe(true);
      expect(isWebChatOriginAllowed(allowed, 'http://127.0.0.1:3001', null)).toBe(true);
      expect(isWebChatOriginAllowed(allowed, 'https://outro.com', null)).toBe(false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
