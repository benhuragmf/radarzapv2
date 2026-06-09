import {
  stripeSecretKeyStatus,
  stripeModeLabel,
} from '@/config/billing-env';

describe('billing-env', () => {
  const orig = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (orig === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = orig;
  });

  it('aceita sk_test_', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
    expect(stripeSecretKeyStatus()).toBe('test');
    expect(stripeModeLabel()).toBe('test');
  });

  it('aceita rk_test_ (restricted key)', () => {
    process.env.STRIPE_SECRET_KEY = 'rk_test_abc123';
    expect(stripeSecretKeyStatus()).toBe('test');
    expect(stripeModeLabel()).toBe('test');
  });
});
