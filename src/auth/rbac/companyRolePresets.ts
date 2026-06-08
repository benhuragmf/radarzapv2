import { Cap, Capability, capabilitiesForCompanyRole } from './capabilities';

import { CompanyRole } from './roles';



export interface PermissionGroup {

  id: string;

  label: string;

  description: string;

  capabilities: Capability[];

}



/** Capabilities que o dono pode conceder/revogar por papel na empresa. */

export const TENANT_ASSIGNABLE_CAPABILITIES: Capability[] = [

  Cap.DASHBOARD_VIEW,

  Cap.PLATFORM_REPORTS_VIEW,

  Cap.PLATFORM_AUDIT_VIEW,

  Cap.ACCOUNT_SETTINGS,

  Cap.BILLING_VIEW,

  Cap.COMPANY_MEMBERS_MANAGE,

  Cap.COMPANY_MEMBERS_REMOVE,

  Cap.CONSENT_MANUAL_BLOCK,

  Cap.SEND_TEST,

  Cap.SEND_TEMPLATES_MANAGE,

  Cap.SEND_SCHEDULE_MANAGE,

  Cap.SEND_RULES_MANAGE,

  Cap.CONSENT_VIEW,

  Cap.CONSENT_REQUEST_RENEWAL,

  Cap.CONSENT_APPROVE_RENEWAL,

  Cap.CONSENT_CLEAR_REFUSAL,

  Cap.SEND_DESTINATION_MANAGE,

  Cap.SEND_DESTINATION_VIEW,

  Cap.INBOX_VIEW,

  Cap.INBOX_REPLY,

  Cap.INBOX_TRANSFER,

  Cap.INBOX_DEPARTMENT_MANAGE,

  Cap.INBOX_REPORTS_VIEW,

  Cap.INBOX_SUPERVISE,

  Cap.WHATSAPP_SESSION_VIEW,

  Cap.WHATSAPP_SESSION_MANAGE,

  Cap.QUEUE_VIEW,

  Cap.QUEUE_RETRY,

  Cap.LOGS_VIEW,

  Cap.API_KEY_CREATE,

  Cap.API_KEY_REVOKE,

  Cap.API_LOGS_VIEW,

  Cap.DISCORD_SERVER_VIEW,

  Cap.DISCORD_SERVER_MANAGE,

  Cap.DISCORD_CHANNELS_MANAGE,

  Cap.DISCORD_WEBHOOKS_MANAGE,

  Cap.DISCORD_MEMBERS_MANAGE,

];



export const DISCORD_PERMISSION_GROUP: PermissionGroup = {

  id: 'discord',

  label: 'Discord',

  description: 'Aba Discord (requer conta vinculada)',

  capabilities: [

    Cap.DISCORD_SERVER_VIEW,

    Cap.DISCORD_SERVER_MANAGE,

    Cap.DISCORD_CHANNELS_MANAGE,

    Cap.DISCORD_WEBHOOKS_MANAGE,

    Cap.DISCORD_MEMBERS_MANAGE,

  ],

};



/** Grupos alinhados às seções do menu da plataforma. */

export const PERMISSION_GROUPS: PermissionGroup[] = [

  {

    id: 'inicio',

    label: 'Visão geral',

    description: 'Dashboard e hub da empresa',

    capabilities: [Cap.DASHBOARD_VIEW],

  },

  {

    id: 'relatorios',

    label: 'Relatórios',

    description: 'Relatórios operacionais (logs e fila do tenant)',

    capabilities: [Cap.PLATFORM_REPORTS_VIEW, Cap.LOGS_VIEW, Cap.QUEUE_VIEW],

  },

  {

    id: 'auditoria',

    label: 'Auditoria',

    description: 'Trilha de auditoria e integrações',

    capabilities: [Cap.PLATFORM_AUDIT_VIEW],

  },

  {

    id: 'mensagens',

    label: 'Mensagens',

    description: 'Enviar, campanhas, modelos, status e histórico',

    capabilities: [Cap.SEND_TEST, Cap.SEND_TEMPLATES_MANAGE, Cap.SEND_SCHEDULE_MANAGE],

  },

  {

    id: 'contatos',

    label: 'Contatos',

    description: 'Lista, segmentos, grupos e importação',

    capabilities: [

      Cap.CONSENT_VIEW,

      Cap.SEND_DESTINATION_VIEW,

      Cap.SEND_DESTINATION_MANAGE,

    ],

  },

  {

    id: 'consentimento',

    label: 'Consentimento',

    description: 'LGPD — listas, renovação e aprovações',

    capabilities: [

      Cap.CONSENT_REQUEST_RENEWAL,

      Cap.CONSENT_APPROVE_RENEWAL,

      Cap.CONSENT_CLEAR_REFUSAL,

      Cap.CONSENT_MANUAL_BLOCK,

    ],

  },

  {

    id: 'automacoes',

    label: 'Automações',

    description: 'Regras automáticas, gatilhos e agend. automação',

    capabilities: [Cap.SEND_RULES_MANAGE],

  },

  {

    id: 'inbox',

    label: 'Inbox',

    description: 'Atender conversas WhatsApp',

    capabilities: [Cap.INBOX_VIEW, Cap.INBOX_REPLY, Cap.INBOX_TRANSFER],

  },

  {

    id: 'inbox_gestao',

    label: 'Gestão Inbox',

    description: 'Setores, bot, supervisor e relatórios de atendimento',

    capabilities: [

      Cap.INBOX_DEPARTMENT_MANAGE,

      Cap.INBOX_SUPERVISE,

      Cap.INBOX_REPORTS_VIEW,

    ],

  },

  {

    id: 'whatsapp',

    label: 'WhatsApp',

    description: 'Sessões, QR, status, fila e logs WA',

    capabilities: [

      Cap.WHATSAPP_SESSION_VIEW,

      Cap.WHATSAPP_SESSION_MANAGE,

      Cap.QUEUE_RETRY,

      Cap.LOGS_VIEW,

    ],

  },

  {

    id: 'api',

    label: 'Integração API',

    description: 'Chaves, webhooks e documentação',

    capabilities: [Cap.API_KEY_CREATE, Cap.API_KEY_REVOKE, Cap.API_LOGS_VIEW],

  },

  {

    id: 'empresa',

    label: 'Empresa',

    description: 'Configurações, plano e equipe',

    capabilities: [

      Cap.ACCOUNT_SETTINGS,

      Cap.BILLING_VIEW,

      Cap.COMPANY_MEMBERS_MANAGE,

      Cap.COMPANY_MEMBERS_REMOVE,

    ],

  },

  DISCORD_PERMISSION_GROUP,

];



export function permissionGroupsForOrg(hasDiscordIntegration: boolean): PermissionGroup[] {

  if (hasDiscordIntegration) return PERMISSION_GROUPS;

  return PERMISSION_GROUPS.filter(g => g.id !== 'discord');

}



export function assignableCapabilitiesForOrg(hasDiscordIntegration: boolean): Capability[] {

  if (hasDiscordIntegration) return TENANT_ASSIGNABLE_CAPABILITIES;

  return TENANT_ASSIGNABLE_CAPABILITIES.filter(c => !c.startsWith('discord:'));

}



export interface CompanyRolePreset {

  role: CompanyRole;

  label: string;

  description: string;

  inviteable: boolean;

  capabilities: Capability[];

  customized?: boolean;

}



export const COMPANY_ROLE_PRESETS: CompanyRolePreset[] = [

  {

    role: CompanyRole.OWNER,

    label: 'Dono',

    description: 'Acesso total à empresa, faturamento e exclusão de conta.',

    inviteable: false,

    capabilities: capabilitiesForCompanyRole(CompanyRole.OWNER),

  },

  {

    role: CompanyRole.ADMIN,

    label: 'Administrador',

    description: 'Quase tudo: equipe, WhatsApp, campanhas e Inbox completo.',

    inviteable: true,

    capabilities: capabilitiesForCompanyRole(CompanyRole.ADMIN),

  },

  {

    role: CompanyRole.MANAGER,

    label: 'Gerente',

    description: 'Supervisiona atendimento, relatórios Inbox e operações — sem API nem sessão WA.',

    inviteable: true,

    capabilities: capabilitiesForCompanyRole(CompanyRole.MANAGER),

  },

  {

    role: CompanyRole.ATTENDANT,

    label: 'Atendente',

    description: 'Inbox e contatos — sem relatórios, supervisor nem configurações.',

    inviteable: true,

    capabilities: capabilitiesForCompanyRole(CompanyRole.ATTENDANT),

  },

  {

    role: CompanyRole.INTEGRATION,

    label: 'Integração API',

    description: 'Somente chaves de API, webhooks e documentação — sem painel operacional.',

    inviteable: true,

    capabilities: capabilitiesForCompanyRole(CompanyRole.INTEGRATION),

  },

  {

    role: CompanyRole.CUSTOM,

    label: 'Personalizado',

    description: 'Acesso definido pelo dono — marque cada aba e permissão manualmente.',

    inviteable: true,

    capabilities: capabilitiesForCompanyRole(CompanyRole.CUSTOM),

  },

];



export const INVITEABLE_ROLES = COMPANY_ROLE_PRESETS.filter(p => p.inviteable).map(p => p.role);



export type OrgRoleCapabilities = Partial<Record<CompanyRole, Capability[]>>;



export function parseOrgRoleCapabilities(

  raw?: Partial<Record<string, string[]>>,

): OrgRoleCapabilities {

  if (!raw || typeof raw !== 'object') return {};

  const out: OrgRoleCapabilities = {};

  for (const [key, caps] of Object.entries(raw)) {

    if (Array.isArray(caps)) {

      out[key as CompanyRole] = caps as Capability[];

    }

  }

  return out;

}



export function effectiveCapabilitiesForRole(

  role: CompanyRole,

  orgRoleCapabilities?: OrgRoleCapabilities,

): Capability[] {

  if (orgRoleCapabilities && Object.prototype.hasOwnProperty.call(orgRoleCapabilities, role)) {

    return orgRoleCapabilities[role] ?? [];

  }

  return capabilitiesForCompanyRole(role);

}



export function buildPresetsForOrg(

  orgRoleCapabilities?: OrgRoleCapabilities,

): CompanyRolePreset[] {

  return COMPANY_ROLE_PRESETS.map(preset => ({

    ...preset,

    capabilities: effectiveCapabilitiesForRole(preset.role, orgRoleCapabilities),

    customized: Object.prototype.hasOwnProperty.call(orgRoleCapabilities ?? {}, preset.role),

  }));

}



export function resolveMemberCapabilities(

  role: CompanyRole,

  extra: Capability[] = [],

  denied: Capability[] = [],

  orgRoleCapabilities?: OrgRoleCapabilities,

): Capability[] {

  const base = new Set(effectiveCapabilitiesForRole(role, orgRoleCapabilities));

  for (const c of extra) base.add(c);

  for (const c of denied) base.delete(c);

  return [...base];

}



export function computeCapabilityOverrides(

  role: CompanyRole,

  selected: Capability[],

): { extraCapabilities: Capability[]; deniedCapabilities: Capability[] } {

  const base = new Set(capabilitiesForCompanyRole(role));

  const assignable = new Set(TENANT_ASSIGNABLE_CAPABILITIES);

  const selectedSet = new Set(selected.filter(c => assignable.has(c)));



  const extraCapabilities = [...selectedSet].filter(c => !base.has(c));

  const deniedCapabilities = [...base].filter(c => assignable.has(c) && !selectedSet.has(c));

  return { extraCapabilities, deniedCapabilities };

}



export function presetForRole(role: CompanyRole): CompanyRolePreset | undefined {

  return COMPANY_ROLE_PRESETS.find(p => p.role === role);

}


