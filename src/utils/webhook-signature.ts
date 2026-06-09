import crypto from 'crypto';

/** Assinatura HMAC-SHA256 — header `X-RadarZap-Signature: t={ts},v1={hex}` */
export function signWebhookPayload(secret: string, timestampSec: number, rawBody: string): string {
  const signed = `${timestampSec}.${rawBody}`;
  return crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
}

export function buildWebhookSignatureHeader(secret: string, rawBody: string, nowMs = Date.now()): string {
  const t = Math.floor(nowMs / 1000);
  const v1 = signWebhookPayload(secret, t, rawBody);
  return `t=${t},v1=${v1}`;
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  header: string,
  toleranceSec = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(',').map(p => {
      const [k, v] = p.trim().split('=');
      return [k, v];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return false;
  const expected = signWebhookPayload(secret, t, rawBody);
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
