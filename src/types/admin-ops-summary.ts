/** Payload agregado para ops global — GET /api/admin/ops/summary */

export type AdminOpsServiceStatus = 'ok' | 'degraded' | 'down' | 'not_configured';

export type AdminOpsAlertLevel = 'info' | 'warning' | 'critical';

export interface AdminOpsAlert {
  level: AdminOpsAlertLevel;
  kind: string;
  title: string;
  message: string;
  source?: string;
  createdAt?: string;
}

export interface AdminOpsSummary {
  generatedAt: string;

  system: {
    version: string;
    nodeEnv: string;
    uptimeSeconds: number;
    nodeVersion: string;
    memoryMb: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    cpu?: {
      load1?: number;
      load5?: number;
      load15?: number;
      cpuCount?: number;
    };
  };

  services: {
    mongo: {
      status: AdminOpsServiceStatus;
      latencyMs?: number;
    };
    redis: {
      status: AdminOpsServiceStatus;
      latencyMs?: number;
    };
    queues: {
      status: AdminOpsServiceStatus;
      waiting: number;
      active: number;
      failed: number;
      delayed: number;
      paused: number;
    };
  };

  tenants: {
    totalOrganizations: number;
    freeOrganizations: number;
    starterOrganizations: number;
    proOrganizations: number;
    enterpriseOrganizations: number;
    paidOrganizations: number;
    expiredOrganizations: number;
    pastDueOrganizations: number;
    trialingOrganizations: number;
  };

  operations: {
    whatsapp: {
      connected: number;
      disconnected: number;
      expired: number;
      totalSessions: number;
    };
    webchat: {
      activeWidgets: number;
      totalWidgets: number;
      activeConversations: number;
      queuedConversations: number;
      bridgeActive: number;
    };
    inbox: {
      openConversations: number;
      waitingQueue: number;
      inProgress: number;
      resolvedToday: number;
    };
    tickets: {
      open: number;
      inProgress: number;
      clientReplied: number;
      closedThisMonth: number;
    };
    leads: {
      leadsToday: number;
      leadsThisMonth: number;
      activeForms: number;
      totalForms: number;
    };
  };

  ai: {
    creditsConsumedThisMonth: number;
    organizationsWithLowCredits?: number;
    organizationsWithoutCredits?: number;
    premiumCallsThisMonth: number;
    basicLlmCallsThisMonth: number;
  };

  billing: {
    stripeMode: 'off' | 'test' | 'live' | 'unknown';
    pendingOrders: number;
    paidOrdersThisMonth: number;
    failedInvoicesThisMonth: number;
    pastDueOrganizations: number;
  };

  security: {
    errorsLast24h: number;
    invalidTicketLookupsLast24h: number;
    formBlocksLast24h: number;
    billingLimitBlocksLast24h: number;
    webhookFailuresLast24h: number;
  };

  alerts: AdminOpsAlert[];

  links: {
    monitoring: string;
    clients: string;
    payments: string;
    servers: string;
    errors: string;
    queue: string;
    aiPlatform: string;
  };
}

export interface AdminOpsTenantMetrics {
  totalOrganizations: number;
  freeOrganizations: number;
  starterOrganizations: number;
  proOrganizations: number;
  enterpriseOrganizations: number;
  paidOrganizations: number;
  expiredOrganizations: number;
  pastDueOrganizations: number;
  trialingOrganizations: number;
}

export interface AdminOpsOrgBillingInput {
  plan: string;
  planExpiresAt?: Date | null;
  stripeSubscriptionStatus?: string | null;
}
