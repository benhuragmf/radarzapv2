import { createHmac, timingSafeEqual } from 'crypto';

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

const DEFAULT_TOLERANCE_SEC = 300;

export function verifyStripeWebhookSignature(
  payload: Buffer,
  signatureHeader: string,
  secret: string,
  toleranceSec = DEFAULT_TOLERANCE_SEC,
): boolean {
  const parts = signatureHeader.split(',').map(p => p.trim());
  let timestamp: number | null = null;
  const v1Signatures: string[] = [];

  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 't') timestamp = Number.parseInt(value, 10);
    else if (key === 'v1') v1Signatures.push(value);
  }

  if (timestamp == null || !Number.isFinite(timestamp) || v1Signatures.length === 0) {
    return false;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > toleranceSec) return false;

  const signedPayload = `${timestamp}.${payload.toString('utf8')}`;
  const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  return v1Signatures.some(sig => {
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  });
}

export function parseStripeWebhookEvent(payload: Buffer): StripeWebhookEvent {
  const doc = JSON.parse(payload.toString('utf8')) as StripeWebhookEvent;
  if (!doc?.type || !doc?.data?.object) {
    throw new Error('Payload Stripe inválido');
  }
  return doc;
}
