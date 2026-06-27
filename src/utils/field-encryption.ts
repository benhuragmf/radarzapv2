import crypto from 'crypto';
import { config } from '@/config/environment';

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-cbc';
const IV_LEN = 16;

function resolveKey(): Buffer {
  const raw = process.env.SESSION_ENCRYPTION_KEY?.trim() || '';
  if (raw.length >= 32) {
    const key = Buffer.from(raw.slice(0, 32), 'utf8');
    if (key.length === 32) return key;
  }
  if (config.NODE_ENV === 'production') {
    throw new Error('SESSION_ENCRYPTION_KEY is required for field encryption in production');
  }
  return crypto.createHash('sha256').update('radarzap-dev-field-encryption-v1').digest();
}

/** Criptografa texto sensível para persistência (webhook secret, backup). */
export function encryptField(plain: string): string {
  if (!plain) return plain;
  if (plain.startsWith(PREFIX)) return plain;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, resolveKey(), iv);
  let encrypted = cipher.update(plain, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${PREFIX}${iv.toString('hex')}:${encrypted}`;
}

/** Descriptografa ou devolve texto legado em plain text. */
export function decryptField(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored;
  const body = stored.slice(PREFIX.length);
  const [ivHex, encryptedHex] = body.split(':');
  if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted field format');
  const decipher = crypto.createDecipheriv(ALGO, resolveKey(), Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function isEncryptedField(value: string): boolean {
  return value.startsWith(PREFIX);
}
