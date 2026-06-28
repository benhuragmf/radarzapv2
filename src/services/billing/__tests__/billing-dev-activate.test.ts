import mongoose from 'mongoose';
import { BillingService } from '../BillingService';

describe('BillingService dev billing (AH-B02)', () => {
  const origAllow = process.env.ALLOW_DEV_BILLING;
  const origNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (origAllow === undefined) delete process.env.ALLOW_DEV_BILLING;
    else process.env.ALLOW_DEV_BILLING = origAllow;
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    (BillingService as unknown as { instance?: BillingService }).instance = undefined;
  });

  it('devActivateOrganization bloqueia sem ALLOW_DEV_BILLING=true', async () => {
    delete process.env.ALLOW_DEV_BILLING;
    process.env.NODE_ENV = 'development';

    await expect(
      BillingService.getInstance().devActivateOrganization(
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString(),
        'pro',
      ),
    ).rejects.toMatchObject({ message: 'Billing dev desabilitado', status: 403 });
  });

  it('getPricing.devBillingEnabled exige flag explícita', () => {
    delete process.env.ALLOW_DEV_BILLING;
    process.env.NODE_ENV = 'development';
    expect(BillingService.getInstance().getPricing().devBillingEnabled).toBe(false);

    (BillingService as unknown as { instance?: BillingService }).instance = undefined;
    process.env.ALLOW_DEV_BILLING = 'true';
    expect(BillingService.getInstance().getPricing().devBillingEnabled).toBe(true);
  });
});
