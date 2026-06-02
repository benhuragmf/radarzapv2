import { UserRole } from './roles';

/** Capabilities granulares — autorização por ação, não só por role */
export const Cap = {
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_GLOBAL: 'dashboard:global',

  ACCOUNT_SETTINGS: 'account:settings',

  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',

  WHATSAPP_SESSION_VIEW: 'whatsapp:session:view',
  WHATSAPP_SESSION_MANAGE: 'whatsapp:session:manage',

  DISCORD_SERVER_VIEW: 'discord:server:view',
  DISCORD_SERVER_MANAGE: 'discord:server:manage',
  DISCORD_CHANNELS_MANAGE: 'discord:channels:manage',
  DISCORD_WEBHOOKS_MANAGE: 'discord:webhooks:manage',
  DISCORD_MEMBERS_MANAGE: 'discord:members:manage',

  SEND_DESTINATION_MANAGE: 'send:destination:manage',
  SEND_RULES_MANAGE: 'send:rules:manage',
  SEND_TEMPLATES_MANAGE: 'send:templates:manage',
  SEND_SCHEDULE_MANAGE: 'send:schedule:manage',
  SEND_TEST: 'send:test',

  QUEUE_VIEW: 'queue:view',
  QUEUE_RETRY: 'queue:retry',
  QUEUE_GLOBAL: 'queue:global',

  LOGS_VIEW: 'logs:view',
  LOGS_GLOBAL: 'logs:global',
  LOGS_LIMITED: 'logs:limited',

  API_KEY_CREATE: 'api:key:create',
  API_KEY_REVOKE: 'api:key:revoke',
  API_LOGS_VIEW: 'api:logs:view',
  API_GLOBAL: 'api:global',

  SYSTEM_USERS_VIEW: 'system:users:view',
  SYSTEM_USERS_MANAGE: 'system:users:manage',
  SYSTEM_SERVERS_VIEW: 'system:servers:view',
  SYSTEM_SERVERS_MANAGE: 'system:servers:manage',
  SYSTEM_PLANS_MANAGE: 'system:plans:manage',
  SYSTEM_SETTINGS_MANAGE: 'system:settings:manage',
  SYSTEM_AUDIT_VIEW: 'system:audit:view',
  SYSTEM_AUDIT_LIMITED: 'system:audit:limited',
  SYSTEM_MODERATION: 'system:moderation:action',
  SYSTEM_PAYMENTS_VIEW: 'system:payments:view',
} as const;

export type Capability = (typeof Cap)[keyof typeof Cap];

const USER_CAPS: Capability[] = [
  Cap.DASHBOARD_VIEW,
  Cap.ACCOUNT_SETTINGS,
  Cap.BILLING_VIEW,
];

const DISCORD_OWNER_CAPS: Capability[] = [
  ...USER_CAPS,
  Cap.WHATSAPP_SESSION_VIEW,
  Cap.WHATSAPP_SESSION_MANAGE,
  Cap.DISCORD_SERVER_VIEW,
  Cap.DISCORD_SERVER_MANAGE,
  Cap.DISCORD_CHANNELS_MANAGE,
  Cap.DISCORD_WEBHOOKS_MANAGE,
  Cap.DISCORD_MEMBERS_MANAGE,
  Cap.SEND_DESTINATION_MANAGE,
  Cap.SEND_RULES_MANAGE,
  Cap.SEND_TEMPLATES_MANAGE,
  Cap.SEND_SCHEDULE_MANAGE,
  Cap.SEND_TEST,
  Cap.QUEUE_VIEW,
  Cap.QUEUE_RETRY,
  Cap.LOGS_VIEW,
  Cap.API_KEY_CREATE,
  Cap.API_LOGS_VIEW,
];

const DISCORD_ADMIN_CAPS: Capability[] = [
  Cap.DASHBOARD_VIEW,
  Cap.ACCOUNT_SETTINGS,
  Cap.DISCORD_SERVER_VIEW,
  Cap.DISCORD_CHANNELS_MANAGE,
  Cap.DISCORD_WEBHOOKS_MANAGE,
  Cap.SEND_DESTINATION_MANAGE,
  Cap.SEND_RULES_MANAGE,
  Cap.SEND_TEMPLATES_MANAGE,
  Cap.SEND_SCHEDULE_MANAGE,
  Cap.SEND_TEST,
  Cap.QUEUE_VIEW,
  Cap.LOGS_VIEW,
];

const SYSTEM_MODERATOR_CAPS: Capability[] = [
  Cap.DASHBOARD_VIEW,
  Cap.DASHBOARD_GLOBAL,
  Cap.SYSTEM_USERS_VIEW,
  Cap.SYSTEM_SERVERS_VIEW,
  Cap.WHATSAPP_SESSION_VIEW,
  Cap.QUEUE_VIEW,
  Cap.QUEUE_RETRY,
  Cap.QUEUE_GLOBAL,
  Cap.LOGS_LIMITED,
  Cap.LOGS_GLOBAL,
  Cap.SYSTEM_MODERATION,
  Cap.SYSTEM_AUDIT_LIMITED,
];

/** Todas as capabilities — SYSTEM_ADMIN */
export const ALL_CAPABILITIES = Object.values(Cap) as Capability[];

export function capabilitiesForRole(role: UserRole): Capability[] {
  switch (role) {
    case UserRole.SYSTEM_ADMIN:
      return ALL_CAPABILITIES;
    case UserRole.SYSTEM_MODERATOR:
      return SYSTEM_MODERATOR_CAPS;
    case UserRole.DISCORD_OWNER:
      return DISCORD_OWNER_CAPS;
    case UserRole.DISCORD_ADMIN:
      return DISCORD_ADMIN_CAPS;
    default:
      return USER_CAPS;
  }
}

/** Planos que permitem API Key pessoal/servidor */
export function planAllowsApi(plan: string): boolean {
  return plan === 'pro' || plan === 'enterprise';
}

/** Adiciona capabilities condicionais ao plano */
export function applyPlanCapabilities(caps: Set<Capability>, plan: string): void {
  if (planAllowsApi(plan)) {
    caps.add(Cap.API_KEY_CREATE);
    caps.add(Cap.API_LOGS_VIEW);
  }
}
