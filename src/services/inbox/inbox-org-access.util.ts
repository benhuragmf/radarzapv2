import { CompanyMember } from '@/models/CompanyMember';
import type { ICompanyMember } from '@/models/CompanyMember';
import { CompanyRole } from '@/auth/rbac/roles';

/** Garante que o usuário é membro ativo da organização (anti cross-tenant). */
export async function assertInboxOrganizationMember(
  clientId: string,
  userId: string,
): Promise<ICompanyMember> {
  const member = await CompanyMember.findActiveByUserId(userId);
  if (!member || String(member.organizationId) !== clientId) {
    throw new Error('Sem permissão para esta organização');
  }
  if (!member.isActive) {
    throw new Error('Membro inativo');
  }
  return member;
}

/** Dono, admin ou gestor podem agir em conversa atribuída a outro atendente. */
export function canOverrideAssignedConversation(member: {
  companyRole: CompanyRole;
}): boolean {
  return (
    member.companyRole === CompanyRole.OWNER ||
    member.companyRole === CompanyRole.ADMIN ||
    member.companyRole === CompanyRole.MANAGER
  );
}
