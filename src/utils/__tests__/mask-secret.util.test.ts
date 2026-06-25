import {
  isSensitiveKey,
  maskQrPayload,
  maskSecret,
  maskSecretInText,
  maskTicketPublicToken,
  redactSensitiveMeta,
  safeErrorMessage,
  sanitizeLogPayload,
} from '@/utils/mask-secret.util';

describe('mask-secret.util', () => {
  it('maskSecret mascara Stripe key', () => {
    const key = 'sk_test_1234567890abcdef';
    expect(maskSecret(key)).toBe('sk_test_…cdef');
    expect(maskSecret(key)).not.toContain('1234567890');
  });

  it('maskSecret mascara IA API key genérica', () => {
    const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
    expect(maskSecret(key)).toMatch(/…/);
    expect(maskSecret(key).length).toBeLessThan(key.length);
  });

  it('maskSecret mascara widget key wck_', () => {
    expect(maskSecret('wck_1234567890abcdef')).toBe('wck_1234…cdef');
  });

  it('maskSecret mascara lead form key lfm_', () => {
    expect(maskSecret('lfm_1234567890abcdef')).toBe('lfm_1234…cdef');
  });

  it('maskTicketPublicToken nunca expõe valor', () => {
    expect(maskTicketPublicToken('super-secret-ticket-token-abc')).toBe('[redacted-ticket-token]');
  });

  it('redactSensitiveMeta remove Authorization', () => {
    const out = redactSensitiveMeta({
      authorization: 'Bearer sk_test_abc123xyz',
      ok: true,
    });
    expect(out?.authorization).toBe('[redacted-auth]');
    expect(out?.ok).toBe(true);
  });

  it('redactSensitiveMeta remove Cookie', () => {
    const out = redactSensitiveMeta({ cookie: 'session=abc123', userId: 'u1' });
    expect(out?.cookie).toBe('[redacted]');
    expect(out?.userId).toBe('u1');
  });

  it('maskQrPayload não expõe QR', () => {
    expect(maskQrPayload('data:image/png;base64,AAAA')).toBe('[redacted-qr]');
  });

  it('redactSensitiveMeta não persiste token longo em meta', () => {
    const out = redactSensitiveMeta({
      note: 'x',
      raw: 'abcdefghijklmnopqrstuvwxyz1234567890ABCD',
    });
    expect(out?.raw).toBe('[redacted-ticket-token]');
  });

  it('sanitizeLogPayload mascara Stripe em string', () => {
    const s = sanitizeLogPayload('failed key sk_test_1234567890abcdef here');
    expect(String(s)).not.toContain('1234567890abcdef');
  });

  it('isSensitiveKey detecta chaves sensíveis', () => {
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('STRIPE_WEBHOOK_SECRET')).toBe(true);
    expect(isSensitiveKey('ticketRef')).toBe(false);
  });

  it('safeErrorMessage mascara segredo na mensagem', () => {
    expect(safeErrorMessage(new Error('invalid sk_test_1234567890abcdef'))).not.toContain(
      '1234567890abcdef',
    );
  });
});
