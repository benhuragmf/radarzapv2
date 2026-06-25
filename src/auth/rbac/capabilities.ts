import { CompanyRole, UserRole } from './roles';

/** Capabilities granulares — autorização por ação, não só por role */
export const Cap = {
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_GLOBAL: 'dashboard:global',

  PLATFORM_REPORTS_VIEW: 'platform:reports:view',
  PLATFORM_AUDIT_VIEW: 'platform:audit:view',

  ACCOUNT_SETTINGS: 'account:settings',

  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',

  COMPANY_MEMBERS_MANAGE: 'company:members:manage',
  COMPANY_MEMBERS_REMOVE: 'company:members:remove',

  WHATSAPP_SESSION_VIEW: 'whatsapp:session:view',
  WHATSAPP_SESSION_MANAGE: 'whatsapp:session:manage',

  DISCORD_SERVER_VIEW: 'discord:server:view',
  DISCORD_SERVER_MANAGE: 'discord:server:manage',
  DISCORD_CHANNELS_MANAGE: 'discord:channels:manage',
  DISCORD_WEBHOOKS_MANAGE: 'discord:webhooks:manage',
  DISCORD_MEMBERS_MANAGE: 'discord:members:manage',

  SEND_DESTINATION_MANAGE: 'send:destination:manage',
  SEND_DESTINATION_VIEW: 'send:destination:view',

  CONSENT_VIEW: 'consent:view',
  CONSENT_REQUEST_RENEWAL: 'consent:request-renewal',
  CONSENT_APPROVE_RENEWAL: 'consent:approve-renewal',
  CONSENT_CLEAR_REFUSAL: 'consent:clear-refusal',
  CONSENT_MANUAL_BLOCK: 'consent:manual-block',

  LEADS_VIEW: 'leads:view',
  LEADS_MANAGE: 'leads:manage',
  LEADS_KANBAN_MANAGE: 'leads:kanban:manage',
  LEADS_EXPORT: 'leads:export',

  CONTACTS_VIEW: 'contacts:view',
  CONTACTS_MANAGE: 'contacts:manage',

  SEND_RULES_MANAGE: 'send:rules:manage',
  SEND_TEMPLATES_MANAGE: 'send:templates:manage',
  SEND_SCHEDULE_MANAGE: 'send:schedule:manage',
  SEND_TEST: 'send:test',

  INBOX_VIEW: 'inbox:view',
  INBOX_REPLY: 'inbox:reply',
  INBOX_TRANSFER: 'inbox:transfer',
  INBOX_DEPARTMENT_MANAGE: 'inbox:department:manage',
  INBOX_REPORTS_VIEW: 'inbox:reports:view',
  INBOX_SUPERVISE: 'inbox:supervise',
  INBOX_AI_MANAGE: 'inbox:ai:manage',
  /** Saldo IA/LM na barra superior — liberável pelo dono na equipe. */
  INBOX_AI_BALANCE_VIEW: 'inbox:ai:balance:view',

  WEBCHAT_VIEW: 'webchat:view',
  WEBCHAT_REPLY: 'webchat:reply',
  WEBCHAT_MANAGE: 'webchat:manage',

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

const BASE_CAPS: Capability[] = [
  Cap.DASHBOARD_VIEW,
  Cap.ACCOUNT_SETTINGS,
];

/** Plataforma — papéis da empresa (tenant) */
const COMPANY_OWNER_CAPS: Capability[] = [
  ...BASE_CAPS,
  Cap.BILLING_VIEW,
  Cap.BILLING_MANAGE,
  Cap.COMPANY_MEMBERS_MANAGE,
  Cap.COMPANY_MEMBERS_REMOVE,
  Cap.WHATSAPP_SESSION_VIEW,
  Cap.WHATSAPP_SESSION_MANAGE,
  Cap.SEND_DESTINATION_MANAGE,
  Cap.SEND_DESTINATION_VIEW,
  Cap.CONSENT_VIEW,
  Cap.CONSENT_REQUEST_RENEWAL,
  Cap.CONSENT_APPROVE_RENEWAL,
  Cap.CONSENT_CLEAR_REFUSAL,
  Cap.CONSENT_MANUAL_BLOCK,
  Cap.CONTACTS_VIEW,
  Cap.CONTACTS_MANAGE,
  Cap.LEADS_VIEW,
  Cap.LEADS_MANAGE,
  Cap.LEADS_KANBAN_MANAGE,
  Cap.LEADS_EXPORT,
  Cap.SEND_RULES_MANAGE,
  Cap.SEND_TEMPLATES_MANAGE,
  Cap.SEND_SCHEDULE_MANAGE,
  Cap.SEND_TEST,
  Cap.INBOX_VIEW,
  Cap.INBOX_REPLY,
  Cap.INBOX_TRANSFER,
  Cap.INBOX_DEPARTMENT_MANAGE,
  Cap.INBOX_REPORTS_VIEW,
  Cap.INBOX_SUPERVISE,
  Cap.INBOX_AI_MANAGE,
  Cap.INBOX_AI_BALANCE_VIEW,
  Cap.WEBCHAT_VIEW,
  Cap.WEBCHAT_REPLY,
  Cap.WEBCHAT_MANAGE,
  Cap.PLATFORM_REPORTS_VIEW,
  Cap.PLATFORM_AUDIT_VIEW,
  Cap.QUEUE_VIEW,
  Cap.QUEUE_RETRY,
  Cap.LOGS_VIEW,
  Cap.API_KEY_CREATE,
  Cap.API_LOGS_VIEW,
];

const COMPANY_ADMIN_CAPS: Capability[] = [
  ...BASE_CAPS,
  Cap.BILLING_VIEW,
  Cap.COMPANY_MEMBERS_MANAGE,
  Cap.COMPANY_MEMBERS_REMOVE,
  Cap.WHATSAPP_SESSION_VIEW,
  Cap.SEND_DESTINATION_MANAGE,
  Cap.SEND_DESTINATION_VIEW,
  Cap.CONSENT_VIEW,
  Cap.CONSENT_REQUEST_RENEWAL,
  Cap.CONSENT_APPROVE_RENEWAL,
  Cap.CONSENT_CLEAR_REFUSAL,
  Cap.CONTACTS_VIEW,
  Cap.CONTACTS_MANAGE,
  Cap.LEADS_VIEW,
  Cap.LEADS_MANAGE,
  Cap.LEADS_KANBAN_MANAGE,
  Cap.LEADS_EXPORT,
  Cap.SEND_RULES_MANAGE,
  Cap.SEND_TEMPLATES_MANAGE,
  Cap.SEND_SCHEDULE_MANAGE,
  Cap.SEND_TEST,
  Cap.INBOX_VIEW,
  Cap.INBOX_REPLY,
  Cap.INBOX_TRANSFER,
  Cap.INBOX_DEPARTMENT_MANAGE,
  Cap.INBOX_REPORTS_VIEW,
  Cap.INBOX_SUPERVISE,
  Cap.INBOX_AI_MANAGE,
  Cap.INBOX_AI_BALANCE_VIEW,
  Cap.WEBCHAT_VIEW,
  Cap.WEBCHAT_REPLY,
  Cap.WEBCHAT_MANAGE,
  Cap.PLATFORM_REPORTS_VIEW,
  Cap.PLATFORM_AUDIT_VIEW,
  Cap.QUEUE_VIEW,
  Cap.LOGS_VIEW,
];

/** Gerente — supervisão, relatórios Inbox, operações; sem API nem gestão de sessão WA */
const COMPANY_MANAGER_CAPS: Capability[] = [
  ...BASE_CAPS,
  Cap.SEND_DESTINATION_MANAGE,
  Cap.SEND_DESTINATION_VIEW,
  Cap.CONSENT_VIEW,
  Cap.CONTACTS_VIEW,
  Cap.LEADS_VIEW,
  Cap.LEADS_KANBAN_MANAGE,
  Cap.SEND_SCHEDULE_MANAGE,
  Cap.SEND_TEST,
  Cap.INBOX_VIEW,
  Cap.INBOX_REPLY,
  Cap.INBOX_TRANSFER,
  Cap.INBOX_REPORTS_VIEW,
  Cap.INBOX_SUPERVISE,
  Cap.INBOX_AI_BALANCE_VIEW,
  Cap.WEBCHAT_VIEW,
  Cap.WEBCHAT_REPLY,
  Cap.WEBCHAT_MANAGE,
  Cap.PLATFORM_REPORTS_VIEW,
  Cap.QUEUE_VIEW,
  Cap.LOGS_VIEW,
];

const COMPANY_ATTENDANT_CAPS: Capability[] = [
  Cap.DASHBOARD_VIEW,
  Cap.ACCOUNT_SETTINGS,
  Cap.SEND_DESTINATION_VIEW,
  Cap.CONSENT_VIEW,
  Cap.CONTACTS_VIEW,
  Cap.LEADS_VIEW,
  Cap.INBOX_VIEW,
  Cap.INBOX_REPLY,
  Cap.INBOX_TRANSFER,
  Cap.WEBCHAT_VIEW,
  Cap.WEBCHAT_REPLY,
  Cap.QUEUE_VIEW,
];

/** Integração API — chaves e logs; sem Inbox nem campanhas */
const COMPANY_INTEGRATION_CAPS: Capability[] = [
  Cap.DASHBOARD_VIEW,
  Cap.ACCOUNT_SETTINGS,
  Cap.API_KEY_CREATE,
  Cap.API_KEY_REVOKE,
  Cap.API_LOGS_VIEW,
];

/** Discord — somente automação de servidor (requer guild vinculada) */
const DISCORD_GUILD_OWNER_CAPS: Capability[] = [
  Cap.DISCORD_SERVER_VIEW,
  Cap.DISCORD_SERVER_MANAGE,
  Cap.DISCORD_CHANNELS_MANAGE,
  Cap.DISCORD_WEBHOOKS_MANAGE,
  Cap.DISCORD_MEMBERS_MANAGE,
];

const DISCORD_GUILD_ADMIN_CAPS: Capability[] = [
  Cap.DISCORD_SERVER_VIEW,
  Cap.DISCORD_CHANNELS_MANAGE,
  Cap.DISCORD_WEBHOOKS_MANAGE,
];

const SYSTEM_MODERATOR_CAPS: Capability[] = [
  Cap.DASHBOARD_VIEW,
  Cap.DASHBOARD_GLOBAL,
  Cap.SYSTEM_USERS_VIEW,
  Cap.SYSTEM_SERVERS_VIEW,
  Cap.WHATSAPP_SESSION_VIEW,
  Cap.CONSENT_VIEW,
  Cap.QUEUE_VIEW,
  Cap.QUEUE_RETRY,
  Cap.QUEUE_GLOBAL,
  Cap.LOGS_LIMITED,
  Cap.LOGS_GLOBAL,
  Cap.SYSTEM_MODERATION,
  Cap.SYSTEM_AUDIT_LIMITED,
  Cap.CONSENT_MANUAL_BLOCK,
];

export const ALL_CAPABILITIES = Object.values(Cap) as Capability[];

export function capabilitiesForCompanyRole(role: CompanyRole): Capability[] {
  switch (role) {
    case CompanyRole.OWNER:
      return COMPANY_OWNER_CAPS;
    case CompanyRole.ADMIN:
      return COMPANY_ADMIN_CAPS;
    case CompanyRole.MANAGER:
      return COMPANY_MANAGER_CAPS;
    case CompanyRole.ATTENDANT:
      return COMPANY_ATTENDANT_CAPS;
    case CompanyRole.INTEGRATION:
      return COMPANY_INTEGRATION_CAPS;
    case CompanyRole.CUSTOM:
      return BASE_CAPS;
    default:
      return BASE_CAPS;
  }
}

/** @deprecated use capabilitiesForCompanyRole — mantido para staff Discord guild */
export function capabilitiesForRole(role: UserRole): Capability[] {
  switch (role) {
    case UserRole.SYSTEM_ADMIN:
      return ALL_CAPABILITIES;
    case UserRole.SYSTEM_MODERATOR:
      return SYSTEM_MODERATOR_CAPS;
    case UserRole.DISCORD_OWNER:
      return DISCORD_GUILD_OWNER_CAPS;
    case UserRole.DISCORD_ADMIN:
      return DISCORD_GUILD_ADMIN_CAPS;
    default:
      return BASE_CAPS;
  }
}

export function capabilitiesForGuildRole(
  guildRole: 'OWNER' | 'ADMIN' | 'MEMBER',
): Capability[] {
  if (guildRole === 'OWNER') return DISCORD_GUILD_OWNER_CAPS;
  if (guildRole === 'ADMIN') return DISCORD_GUILD_ADMIN_CAPS;
  return [];
}

export function planAllowsApi(plan: string): boolean {
  return plan === 'pro' || plan === 'enterprise';
}

export function applyPlanCapabilities(caps: Set<Capability>, plan: string): void {
  if (planAllowsApi(plan)) {
    caps.add(Cap.API_KEY_CREATE);
    caps.add(Cap.API_LOGS_VIEW);
  }
  if (plan === 'pro' || plan === 'enterprise') {
    caps.add(Cap.CONSENT_REQUEST_RENEWAL);
  }
}
