import { sanitizeWebChatActionLinks, sanitizeWebChatActionUrl } from '@/utils/webchat-safe-url.util';

describe('webchat-safe-url.util', () => {
  it('allows https URLs', () => {
    expect(sanitizeWebChatActionUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('blocks javascript URLs', () => {
    expect(sanitizeWebChatActionUrl('javascript:alert(1)')).toBeNull();
  });

  it('blocks data URLs', () => {
    expect(sanitizeWebChatActionUrl('data:text/html,hello')).toBeNull();
  });

  it('sanitizes link list', () => {
    const links = sanitizeWebChatActionLinks([
      { label: 'Ok', url: 'https://loja.com/rastreio', openInNewTab: true },
      { label: 'Bad', url: 'javascript:void(0)' },
      { label: '', url: 'https://x.com' },
    ]);
    expect(links).toHaveLength(1);
    expect(links[0]?.label).toBe('Ok');
  });
});
