import type { AdminOpsAlert, AdminOpsSummary } from '@/types/admin-ops-summary';

/** Alertas operacionais derivados do summary — sem dados sensíveis. */
export function buildAdminOpsAlerts(summary: AdminOpsSummary): AdminOpsAlert[] {
  const alerts: AdminOpsAlert[] = [];
  const now = summary.generatedAt;

  const mongo = summary.services.mongo.status;
  if (mongo === 'down') {
    alerts.push({
      level: 'critical',
      kind: 'mongo.down',
      title: 'MongoDB offline',
      message: 'Banco de dados indisponível. Operações críticas podem falhar.',
      source: 'services.mongo',
      createdAt: now,
    });
  } else if (mongo === 'degraded') {
    alerts.push({
      level: 'warning',
      kind: 'mongo.degraded',
      title: 'MongoDB degradado',
      message: 'Latência elevada ou ping instável no MongoDB.',
      source: 'services.mongo',
      createdAt: now,
    });
  }

  const redis = summary.services.redis.status;
  if (redis === 'down') {
    alerts.push({
      level: 'critical',
      kind: 'redis.down',
      title: 'Redis offline',
      message: 'Cache/filas podem estar comprometidos.',
      source: 'services.redis',
      createdAt: now,
    });
  } else if (redis === 'degraded') {
    alerts.push({
      level: 'warning',
      kind: 'redis.degraded',
      title: 'Redis degradado',
      message: 'Latência elevada no Redis.',
      source: 'services.redis',
      createdAt: now,
    });
  }

  if (summary.services.queues.failed > 0) {
    alerts.push({
      level: 'warning',
      kind: 'queues.failed',
      title: 'Jobs falhos na fila',
      message: `${summary.services.queues.failed} job(s) com falha nas filas BullMQ.`,
      source: 'services.queues',
      createdAt: now,
    });
  }

  const wa = summary.operations.whatsapp;
  if (wa.totalSessions > 0 && wa.connected < wa.disconnected + wa.expired) {
    alerts.push({
      level: 'warning',
      kind: 'whatsapp.disconnected_majority',
      title: 'Maioria das sessões WA desconectada',
      message: `${wa.connected} conectada(s) vs ${wa.disconnected + wa.expired} inativa(s)/expirada(s).`,
      source: 'operations.whatsapp',
      createdAt: now,
    });
  }

  if (summary.tenants.pastDueOrganizations > 0) {
    alerts.push({
      level: 'warning',
      kind: 'billing.past_due',
      title: 'Organizações inadimplentes',
      message: `${summary.tenants.pastDueOrganizations} organização(ões) com pagamento past_due.`,
      source: 'tenants',
      createdAt: now,
    });
  }

  if ((summary.ai.organizationsWithoutCredits ?? 0) > 0) {
    alerts.push({
      level: 'warning',
      kind: 'ai.credits.exhausted',
      title: 'Empresas sem crédito IA',
      message: `${summary.ai.organizationsWithoutCredits} organização(ões) com créditos esgotados (eventos recentes).`,
      source: 'ai',
      createdAt: now,
    });
  }

  if (summary.system.nodeEnv === 'production' && summary.billing.stripeMode === 'off') {
    alerts.push({
      level: 'critical',
      kind: 'billing.stripe.off_production',
      title: 'Stripe desligado em produção',
      message: 'NODE_ENV=production sem STRIPE_SECRET_KEY válida. Checkout indisponível.',
      source: 'billing',
      createdAt: now,
    });
  }

  if (summary.billing.stripeMode === 'live') {
    alerts.push({
      level: 'info',
      kind: 'billing.stripe.live',
      title: 'Stripe em modo live',
      message: 'Chave live detectada. Confirme QA manual e checklists antes de operação comercial.',
      source: 'billing',
      createdAt: now,
    });
  }

  if (summary.security.errorsLast24h > 0) {
    alerts.push({
      level: 'warning',
      kind: 'security.errors_24h',
      title: 'Erros no sistema (24h)',
      message: `${summary.security.errorsLast24h} registro(s) de erro nas últimas 24 horas.`,
      source: 'security',
      createdAt: now,
    });
  }

  alerts.push({
    level: 'info',
    kind: 'release.qa_manual_pending',
    title: 'QA manual pendente (TOP 20)',
    message:
      'Produção ainda não declarada pronta: QA manual A–J pendente. Status documental: PRONTO PARA QA MANUAL.',
    source: 'release',
    createdAt: now,
  });

  return alerts;
}
