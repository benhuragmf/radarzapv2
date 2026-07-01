import {
  assertWebChatPublicSessionAllowed,
  isWebChatHoneypotTriggered,
  resetWebChatPublicAbuseLimits,
  WebChatAbuseBlockedError,
} from '@/services/webchat/webchat-public-abuse.util';

describe('webchat-public-abuse.util', () => {
  beforeEach(() => {
    resetWebChatPublicAbuseLimits();
  });

  it('detecta honeypot preenchido', () => {
    expect(isWebChatHoneypotTriggered({})).toBe(false);
    expect(isWebChatHoneypotTriggered({ _radarchat_hp: '' })).toBe(false);
    expect(isWebChatHoneypotTriggered({ _radarchat_hp: 'spam' })).toBe(true);
    expect(isWebChatHoneypotTriggered({ company_url: 'https://evil.test' })).toBe(true);
  });

  it('limita criação de sessão por IP (fallback memória)', async () => {
    const key = 'pk_test';
    const ip = '203.0.113.10';
    for (let i = 0; i < 12; i += 1) {
      await assertWebChatPublicSessionAllowed(key, ip);
    }
    await expect(assertWebChatPublicSessionAllowed(key, ip)).rejects.toBeInstanceOf(
      WebChatAbuseBlockedError,
    );
  });
});
