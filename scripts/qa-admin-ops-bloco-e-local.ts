#!/usr/bin/env ts-node
/**
 * Bloco E — alterar plano + AuditLog (Mongo local, sem Stripe).
 * Reverte plano ao estado anterior ao final.
 *
 * Uso: npm run qa:admin-ops:bloco-e:local
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '@/database/DatabaseManager';
import { Organization } from '@/models/Organization';
import { AuditLog } from '@/models/AuditLog';
import { User } from '@/models/User';
import {
  changeAdminOpsOrganizationPlan,
  listAdminOpsOrganizations,
} from '@/services/web-dashboard/admin-ops-organizations.service';
import { getAdminOpsSummary } from '@/services/web-dashboard/admin-ops-summary.service';

const QA_REASON = 'QA local Bloco E - validacao alteracao plano Admin Ops';

async function resolveAdminActorId(): Promise<string> {
  const admin = await User.findOne({ systemRole: 'SYSTEM_ADMIN' }).select('_id').lean();
  if (!admin?._id) throw new Error('Nenhum usuário SYSTEM_ADMIN no Mongo');
  return String(admin._id);
}

async function pickTestOrgId(): Promise<{ id: string; name: string; plan: string }> {
  const page = await listAdminOpsOrganizations({ page: 1, limit: 25 });
  if (!page.items.length) throw new Error('Nenhuma organização no Mongo');

  const preferred =
    page.items.find(o => /kiro|trial demo|anthony/i.test(o.name)) ?? page.items[0];

  return { id: preferred.id, name: preferred.name, plan: preferred.plan };
}

async function main(): Promise<void> {
  console.log('=== RadarZap — QA Admin Ops Bloco E (alterar plano) ===\n');

  const db = DatabaseManager.getInstance();
  await db.connect();
  if (!db.isConnected()) throw new Error('Mongo não conectado');

  const actorUserId = await resolveAdminActorId();
  console.log(`Actor SYSTEM_ADMIN: ${actorUserId}`);

  const target = await pickTestOrgId();
  const orgBefore = await Organization.findById(target.id).lean();
  if (!orgBefore) throw new Error(`Org ${target.id} não encontrada`);

  const snapshot = {
    plan: orgBefore.plan as string,
    planExpiresAt: orgBefore.planExpiresAt?.toISOString() ?? null,
    stripeSubscriptionStatus: orgBefore.stripeSubscriptionStatus ?? null,
  };

  const targetPlan =
    snapshot.plan === 'pro' ? 'starter' : snapshot.plan === 'starter' ? 'pro' : 'starter';

  const expiresAt = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);

  console.log(`Org teste: ${target.name} (${target.id})`);
  console.log(`Plano: ${snapshot.plan} → ${targetPlan}`);

  const changed = await changeAdminOpsOrganizationPlan(target.id, {
    plan: targetPlan,
    reason: QA_REASON,
    expiresAt,
    actorUserId: actorUserId,
  });

  if (changed.plan !== targetPlan) {
    throw new Error(`Plano esperado ${targetPlan}, recebido ${changed.plan}`);
  }

  const audit = await AuditLog.findOne({
    action: 'admin.plan.changed',
    'details.organizationId': target.id,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!audit) throw new Error('AuditLog admin.plan.changed não encontrado');
  const details = audit.details as Record<string, unknown> | undefined;
  if (details?.newPlan !== targetPlan) {
    throw new Error('AuditLog newPlan não confere');
  }
  if (String(details?.reason ?? '') !== QA_REASON) {
    throw new Error('AuditLog reason não confere');
  }

  const summary = await getAdminOpsSummary({ refresh: true });
  const orgsAfter = await listAdminOpsOrganizations({ page: 1, limit: 25 });
  const row = orgsAfter.items.find(o => o.id === target.id);
  if (!row || row.plan !== targetPlan) {
    throw new Error('Listagem organizations não refletiu novo plano');
  }

  console.log('✓ changeAdminOpsOrganizationPlan OK');
  console.log('✓ AuditLog admin.plan.changed OK');
  console.log('✓ summary + listagem OK');

  await changeAdminOpsOrganizationPlan(target.id, {
    plan: snapshot.plan as 'free' | 'starter' | 'pro' | 'enterprise',
    reason: 'QA local Bloco E - revert plano original',
    expiresAt: snapshot.planExpiresAt ?? undefined,
    actorUserId: actorUserId,
  });
  console.log(`✓ Revertido para plano ${snapshot.plan}`);

  const result = {
    finishedAt: new Date().toISOString(),
    organizationId: target.id,
    organizationName: target.name,
    planBefore: snapshot.plan,
    planChangedTo: targetPlan,
    planRevertedTo: snapshot.plan,
    auditLogId: String(audit._id),
    auditAction: audit.action,
    summaryVersion: summary.system.version,
    status: 'BLOCO_E_LOCAL_PASS',
    note: 'Browser VPS ainda pendente Benhur',
  };

  const outDir = path.join(process.cwd(), 'docs', 'qa-results');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `admin-ops-bloco-e-local-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

  console.log('\n=== Resultado ===');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nEvidência: ${outFile}`);

  await db.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n✗ QA Bloco E local falhou:', err);
  process.exit(1);
});
