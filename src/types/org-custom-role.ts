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
  ];
}
