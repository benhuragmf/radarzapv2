/**
 * Cria produtos/preços Radar Chat (Starter R$99, Pro R$299) na conta Stripe test/live.
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/create-stripe-radarchat-prices.ts
 */
import { stripeSecretKey } from '../src/config/billing-env';

async function stripePost(path: string, body: URLSearchParams, key: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }
  return json;
}

async function main() {
  const key = stripeSecretKey();
  if (!key) {
    console.error('Defina STRIPE_SECRET_KEY no .env');
    process.exit(1);
  }

  const plans = [
    { id: 'starter', name: 'Radar Chat Starter', amount: 9900 },
    { id: 'pro', name: 'Radar Chat Pro', amount: 29900 },
  ] as const;

  console.log('Criando produtos/preços Radar Chat (BRL/mês)...\n');

  for (const plan of plans) {
    const product = await stripePost(
      'products',
      new URLSearchParams({ name: plan.name, 'metadata[radarchat_plan]': plan.id }),
      key,
    );
    const productId = String(product.id);

    const price = await stripePost(
      'prices',
      new URLSearchParams({
        product: productId,
        currency: 'brl',
        'recurring[interval]': 'month',
        unit_amount: String(plan.amount),
      }),
      key,
    );

    const envKey = plan.id === 'starter' ? 'STRIPE_PRICE_ID_STARTER' : 'STRIPE_PRICE_ID_PRO';
    console.log(`${plan.name} (R$ ${(plan.amount / 100).toFixed(2)}/mês)`);
    console.log(`  ${envKey}=${String(price.id)}\n`);
  }

  console.log('Copie as linhas acima para o .env');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
