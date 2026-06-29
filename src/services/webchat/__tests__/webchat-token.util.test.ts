import {
  generateWebChatPublicKey,
  generateWebChatVisitorToken,
  hashWebChatVisitorToken,
  isPublicEmbedOpenOriginPolicyEnabled,
  isWebChatOriginAllowed,
} from '../webchat-token.util';

jest.mock('@/config/environment', () => ({
  config: {
    PUBLIC_EMBED: { ALLOW_OPEN_ORIGIN: true },
    DASHBOARD: { FRONTEND_URL: 'https://151-247-210-180.sslip.io' },
    CORS_ORIGIN: 'https://151-247-210-180.sslip.io',
  },
}));

describe('webchat-token.util', () => {
  it('gera chaves com prefixos esperados', () => {
    expect(generateWebChatPublicKey()).toMatch(/^wck_[a-f0-9]{32}$/);
    expect(generateWebChatVisitorToken()).toMatch(/^wcv_[a-f0-9]{48}$/);
  });

  it('hash de visitante é determinístico', () => {
    const token = 'wcv_abc';
    expect(hashWebChatVisitorToken(token)).toBe(hashWebChatVisitorToken(token));
  });

  it('allowedDomains vazio obedece política open origin (dev/test)', () => {
    expect(isPublicEmbedOpenOriginPolicyEnabled()).toBe(true);
    expect(isWebChatOriginAllowed([], 'https://cliente.com', null)).toBe(true);
  });

  it('allowedDomains vazio bloqueia quando política fechada (AH-D01)', () => {
    const { config } = jest.requireMock('@/config/environment') as {
      config: { PUBLIC_EMBED: { ALLOW_OPEN_ORIGIN: boolean } };
    };
    config.PUBLIC_EMBED.ALLOW_OPEN_ORIGIN = false;
    expect(isWebChatOriginAllowed([], 'https://cliente.com', null)).toBe(false);
    config.PUBLIC_EMBED.ALLOW_OPEN_ORIGIN = true;
  });

  it('libera host da própria plataforma (prévia painel / widget.html)', () => {
    const allowed = ['radarchat.com.br'];
    expect(
      isWebChatOriginAllowed(allowed, 'https://151-247-210-180.sslip.io', null),
    ).toBe(true);
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

  it('em desenvolvimento libera quando Origin/Referer ausentes (preview same-origin)', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(isWebChatOriginAllowed(['meusite.com'], null, null)).toBe(true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
