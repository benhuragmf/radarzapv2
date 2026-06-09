import {
  buildWebhookSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
} from '@/utils/webhook-signature';

describe('webhook signature', () => {
  const secret = 'whsec_test_secret_key';
  const body = JSON.stringify({ event: 'campaign.sent', data: { id: '1' } });
  const now = 1_700_000_000_000;

  it('gera header t= e v1=', () => {
    const header = buildWebhookSignatureHeader(secret, body, now);
    expect(header).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
  });

  it('signWebhookPayload é determinístico', () => {
    const a = signWebhookPayload(secret, 1700000000, body);
    const b = signWebhookPayload(secret, 1700000000, body);
    expect(a).toBe(b);
  });

  it('verifyWebhookSignature aceita assinatura válida', () => {
    const t = Math.floor(Date.now() / 1000);
    const v1 = signWebhookPayload(secret, t, body);
    const header = `t=${t},v1=${v1}`;
    expect(verifyWebhookSignature(secret, body, header, 300)).toBe(true);
  });

  it('verifyWebhookSignature rejeita body alterado', () => {
    const header = buildWebhookSignatureHeader(secret, body, now);
    expect(verifyWebhookSignature(secret, body + 'x', header, 300)).toBe(false);
  });
});
