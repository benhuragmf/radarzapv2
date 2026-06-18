import { resolveTrafficSource } from '../webchat-traffic.util';

describe('resolveTrafficSource', () => {
  it('retorna Direto sem referrer', () => {
    expect(resolveTrafficSource('', 'https://loja.com/p')).toBe('Direto');
  });

  it('detecta Google', () => {
    expect(resolveTrafficSource('https://www.google.com/', 'https://loja.com')).toBe('Google');
  });

  it('detecta mesmo site', () => {
    expect(resolveTrafficSource('https://loja.com/blog', 'https://loja.com/preco')).toBe('Mesmo site');
  });
});
