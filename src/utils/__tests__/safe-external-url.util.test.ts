import { resolveSafeExternalHttpsUrl } from '../safe-external-url.util';

describe('safe-external-url.util', () => {
  it('aceita https público e normaliza', () => {
    expect(resolveSafeExternalHttpsUrl('radarchat.com.br')).toBe('https://radarchat.com.br/');
    expect(resolveSafeExternalHttpsUrl('https://www.radarchat.com.br/path')).toBe(
      'https://www.radarchat.com.br/path',
    );
  });

  it('bloqueia javascript, data e credenciais', () => {
    expect(resolveSafeExternalHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(resolveSafeExternalHttpsUrl('data:text/html,<script>')).toBeNull();
    expect(resolveSafeExternalHttpsUrl('https://user:pass@evil.com')).toBeNull();
  });

  it('bloqueia hosts internos', () => {
    expect(resolveSafeExternalHttpsUrl('http://127.0.0.1')).toBeNull();
    expect(resolveSafeExternalHttpsUrl('https://192.168.0.1')).toBeNull();
    expect(resolveSafeExternalHttpsUrl('https://localhost')).toBeNull();
  });

  it('http só em dev quando allowHttpInDev', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(resolveSafeExternalHttpsUrl('http://example.com', { allowHttpInDev: true })).toBe(
        'http://example.com/',
      );
      expect(resolveSafeExternalHttpsUrl('http://example.com')).toBeNull();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
