import crypto from 'crypto';

export function generateApiKeyRaw(): string {
  return `rz_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function apiKeyPrefix(raw: string): string {
  return raw.slice(0, 12);
}

export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(20).toString('hex')}`;
}
