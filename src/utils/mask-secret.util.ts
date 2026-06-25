/**
 * Mascaramento central de segredos e PII em logs/auditoria (TOP 18).
 */

const SENSITIVE_KEY_RE =
  /password|secret|token|authorization|cookie|apikey|api_key|stripe|webhook|qr|credential|session|ciphertext|accesstoken|refreshtoken|bearer|privatekey|encryption/i;

const SECRET_VALUE_RE =
  /\b(sk_(?:test|live)_[A-Za-z0-9]+|rk_(?:test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|wck_[A-Za-z0-9]+|lfm_[A-Za-z0-9]+)\b/g;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

export function maskSecret(
  value: string | undefined | null,
  opts?: { prefix?: number; suffix?: number },
): string {
  if (value == null || typeof value !== 'string') return '[redacted]';
  const v = value.trim();
  if (!v) return '[redacted]';

  const prefix = opts?.prefix ?? 4;
  const suffix = opts?.suffix ?? 4;

  if (v.startsWith('sk_') || v.startsWith('rk_')) {
    return v.length > 12 ? `${v.slice(0, 8)}…${v.slice(-4)}` : '[redacted-stripe-key]';
  }
  if (v.startsWith('whsec_')) return 'whsec_…[redacted]';
  if (v.startsWith('wck_') || v.startsWith('lfm_')) {
    return v.length > 10 ? `${v.slice(0, 8)}…${v.slice(-4)}` : '[redacted-public-key]';
  }
  if (/^Bearer\s+/i.test(v)) return '[redacted-auth]';

  if (v.length <= prefix + suffix + 1) return '[redacted]';
  return `${v.slice(0, prefix)}…${v.slice(-suffix)}`;
}

export function maskTicketPublicToken(_value?: string | null): string {
  return '[redacted-ticket-token]';
}

export function maskQrPayload(_value?: string | null): string {
  return '[redacted-qr]';
}

export function maskSecretInText(text: string): string {
  return text.replace(SECRET_VALUE_RE, (match) => maskSecret(match));
}

export function redactSensitiveMeta(
  meta?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!meta) return meta;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (isSensitiveKey(key)) {
      if (key.toLowerCase().includes('qr')) {
        out[key] = maskQrPayload(typeof value === 'string' ? value : undefined);
      } else if (key.toLowerCase().includes('ticket') && key.toLowerCase().includes('token')) {
        out[key] = maskTicketPublicToken(typeof value === 'string' ? value : undefined);
      } else if (key.toLowerCase().includes('cookie') || key.toLowerCase().includes('session')) {
        out[key] = '[redacted]';
      } else {
        out[key] = typeof value === 'string' ? maskSecret(value) : '[redacted]';
      }
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactSensitiveMeta(value as Record<string, unknown>);
      continue;
    }
    if (typeof value === 'string') {
      if (SECRET_VALUE_RE.test(value)) {
        out[key] = maskSecretInText(value);
      } else if (value.length >= 32 && /^[A-Za-z0-9_-]+$/.test(value)) {
        // Token público longo (ticket) — não persistir em auditoria
        out[key] = maskTicketPublicToken(value);
      } else {
        out[key] = value;
      }
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function sanitizeLogPayload(payload: unknown): unknown {
  if (payload == null) return payload;
  if (typeof payload === 'string') return maskSecretInText(payload);
  if (Array.isArray(payload)) return payload.map(sanitizeLogPayload);
  if (typeof payload === 'object') {
    return redactSensitiveMeta(payload as Record<string, unknown>);
  }
  return payload;
}

export function safeErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return maskSecretInText(msg);
}
