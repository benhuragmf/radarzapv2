/** Diagnóstico Stripe — espelho do padrão radargamev4. */

export type StripeSecretKeyStatus =
  | 'missing'
  | 'empty'
  | 'placeholder'
  | 'invalid'
  | 'test'
  | 'live';

export function stripeSecretKeyStatus(): StripeSecretKeyStatus {
  const raw = process.env.STRIPE_SECRET_KEY;
  if (raw === undefined) return 'missing';
  const key = raw.trim();
  if (!key) return 'empty';
  if (/\.{2,}|your_|changeme|xxx/i.test(key) || key === 'sk_test_' || key === 'sk_live_') {
    return 'placeholder';
  }
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  return 'invalid';
}

export function stripeSecretKey(): string | null {
  const status = stripeSecretKeyStatus();
  if (status === 'test' || status === 'live') {
    return process.env.STRIPE_SECRET_KEY!.trim();
  }
  return null;
}

export function stripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret || null;
}

export function stripeModeLabel(): 'off' | 'test' | 'live' {
  const key = stripeSecretKey();
  if (!key) return 'off';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  return 'off';
}

export function logBillingEnvOnBoot(): void {
  const mode = stripeModeLabel();
  const webhook = stripeWebhookSecret() ? 'yes' : 'no';
  console.log(`[billing] STRIPE=${mode} webhook=${webhook}`);
  if (mode === 'off') {
    console.log('[billing] Defina STRIPE_SECRET_KEY=sk_test_... ou rk_test_... para checkout Stripe');
  }
}
