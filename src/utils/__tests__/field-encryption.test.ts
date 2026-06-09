import { decryptField, encryptField, isEncryptedField } from '@/utils/field-encryption';

describe('field-encryption', () => {
  const originalKey = process.env.SESSION_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.SESSION_ENCRYPTION_KEY = 'test-field-encryption-key-32chars!!';
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.SESSION_ENCRYPTION_KEY;
    else process.env.SESSION_ENCRYPTION_KEY = originalKey;
  });

  it('round-trip criptografa e descriptografa', () => {
    const plain = 'whsec_super_secret_value';
    const enc = encryptField(plain);
    expect(isEncryptedField(enc)).toBe(true);
    expect(decryptField(enc)).toBe(plain);
  });

  it('decryptField devolve texto legado sem prefixo', () => {
    expect(decryptField('plain-legacy-secret')).toBe('plain-legacy-secret');
  });

  it('encryptField é idempotente para valor já criptografado', () => {
    const once = encryptField('abc');
    expect(encryptField(once)).toBe(once);
  });
});
