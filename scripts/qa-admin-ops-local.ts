#!/usr/bin/env ts-node
/**
 * Gate QA local Admin Ops (Etapa 7) — valida respostas reais contra Mongo
 * sem expor secrets. Não executa mutações de plano/trial.
 *
 * Uso: npm run qa:admin-ops:local
 */
import 'dotenv/config';
import { DatabaseManager } from '@/database/DatabaseManager';
import { getAdminOpsSummary } from '@/services/web-dashboard/admin-ops-summary.service';
import { listAdminOpsOrganizations } from '@/services/web-dashboard/admin-ops-organizations.service';
import { listAdminOpsSecurityEvents } from '@/services/web-dashboard/admin-ops-security-events.service';
import { assertSafeOrganizationRow } from '@/services/web-dashboard/admin-ops-organizations.service';
import { assertSafeSecurityEventRow } from '@/services/web-dashboard/admin-ops-security-events.service';

const SENSITIVE = [
  'sk_test_',
  'sk_live_',
  'whsec_',
  'SESSION_ENCRYPTION_KEY',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'STRIPE_SECRET_KEY',
  'publicAccessToken',
  'sessionData',
  'stripeSubscriptionId',
];

const FORBIDDEN_KEYS = ['"meta"', '"payload"', '"details"', '"metadata"', '"sessionData"'];

function assertNoSecrets(label: string, json: string): void {
  for (const key of FORBIDDEN_KEYS) {
    if (json.includes(key)) {
      throw new Error(`${label}: contém chave proibida ${key}`);
    }
  }
  for (const pattern of SENSITIVE) {
    if (json.includes(pattern)) {
      throw new Error(`${label}: contém padrão sensível ${pattern}`);
    }
  }
}

async function main(): Promise<void> {
  const started = new Date().toISOString();
  console.log('=== Radar Chat — QA Admin Ops Local (Etapa 7) ===\n');

  const db = DatabaseManager.getInstance();
  await db.connect();
  if (!db.isConnected()) {
    throw new Error('Mongo não conectado');
  }
  console.log('✓ Mongo conectado');

  const summary = await getAdminOpsSummary({ refresh: true });
  const summaryJson = JSON.stringify(summary);
  assertNoSecrets('summary', summaryJson);
  if (!summary.system.version) throw new Error('summary.system.version ausente');
  if (!summary.billing.stripeMode) throw new Error('summary.billing.stripeMode ausente');
  if (summaryJson.includes('sk_')) throw new Error('summary contém sk_');
  console.log(`✓ summary OK — versão ${summary.system.version}, stripeMode=${summary.billing.stripeMode}`);

  const orgs = await listAdminOpsOrganizations({ page: 1, limit: 10 });
  const orgsJson = JSON.stringify(orgs);
  assertNoSecrets('organizations', orgsJson);
  for (const row of orgs.items) {
    assertSafeOrganizationRow(row);
  }
  console.log(`✓ organizations OK — ${orgs.items.length} rows (total ${orgs.total})`);

  const events = await listAdminOpsSecurityEvents({ limit: 25 });
  const eventsJson = JSON.stringify(events);
  assertNoSecrets('security-events', eventsJson);
  for (const row of events.items) {
    assertSafeSecurityEventRow(row);
  }
  console.log(`✓ security-events OK — ${events.items.length} items (total ${events.total})`);

  const result = {
    startedAt: started,
    finishedAt: new Date().toISOString(),
    version: summary.system.version,
    stripeMode: summary.billing.stripeMode,
    tenants: summary.tenants.totalOrganizations,
    orgsSample: orgs.items.length,
    eventsSample: events.items.length,
    status: 'APPROVED_FOR_COMMIT',
  };

  console.log('\n=== Resultado ===');
  console.log(JSON.stringify(result, null, 2));
  await db.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n✗ QA Admin Ops Local falhou:', err);
  process.exit(1);
});
