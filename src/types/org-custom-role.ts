import { Cap, Capability } from '@/auth/rbac/capabilities';

export const CUSTOM_ROLE_PREFIX = 'custom:';

export interface OrgCustomRole {
  id: string;
  name: string;
  description?: string;
  capabilities: Capability[];
}

export function customRoleKey(id: string): string {
  return `${CUSTOM_ROLE_PREFIX}${id}`;
}

export function isCustomRoleKey(key: string): boolean {
  return key.startsWith(CUSTOM_ROLE_PREFIX);
}

export function customRoleIdFromKey(key: string): string | null {
  if (!isCustomRoleKey(key)) return null;
  return key.slice(CUSTOM_ROLE_PREFIX.length);
}

/** Papéis personalizados sugeridos ao criar a organização */
export function defaultOrgCustomRoles(): OrgCustomRole[] {
  return [
    {
      id: 'attendant-tier-2',
      name: 'Atendente 2ª instância',
      description:
        'Inbox e transferência para setores internos (2ª instância) — sem gestão de setores nem aprovar consentimento.',
      capabilities: [
        Cap.DASHBOARD_VIEW,
        Cap.CONSENT_VIEW,
        Cap.INBOX_VIEW,
        Cap.INBOX_REPLY,
        Cap.INBOX_TRANSFER,
      ],
    },
    {
      id: 'role-finance',
      name: 'Financeiro',
      description:
        'Plano, faturas, consumo e créditos IA — sem acesso a conversas de atendimento.',
      capabilities: [
        Cap.DASHBOARD_VIEW,
        Cap.ACCOUNT_SETTINGS,
        Cap.BILLING_VIEW,
        Cap.INBOX_AI_BALANCE_VIEW,
        Cap.PLATFORM_REPORTS_VIEW,
      ],
    },
    {
      id: 'role-marketing',
      name: 'Marketing / Leads',
      description:
        'Leads, contatos e formulários — visualiza conversas vinculadas sem responder por padrão.',
      capabilities: [
        Cap.DASHBOARD_VIEW,
        Cap.ACCOUNT_SETTINGS,
        Cap.CONSENT_VIEW,
        Cap.CONTACTS_VIEW,
        Cap.LEADS_VIEW,
        Cap.LEADS_MANAGE,
        Cap.LEADS_KANBAN_MANAGE,
        Cap.SEND_DESTINATION_VIEW,
        Cap.INBOX_VIEW,
        Cap.PLATFORM_REPORTS_VIEW,
      ],
    },
    {
      id: 'role-viewer',
      name: 'Somente leitura',
      description: 'Consulta painéis e relatórios autorizados — sem alterar dados nem atender.',
      capabilities: [
        Cap.DASHBOARD_VIEW,
        Cap.CONSENT_VIEW,
        Cap.CONTACTS_VIEW,
        Cap.LEADS_VIEW,
        Cap.INBOX_REPORTS_VIEW,
        Cap.PLATFORM_REPORTS_VIEW,
      ],
    },
  ];
}
