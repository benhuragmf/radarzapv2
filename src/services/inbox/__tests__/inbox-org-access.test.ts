import mongoose from 'mongoose';
import { CompanyRole } from '@/auth/rbac/roles';
import {
  assertInboxOrganizationMember,
  canOverrideAssignedConversation,
} from '@/services/inbox/inbox-org-access.util';

jest.mock('@/models/CompanyMember', () => ({
  CompanyMember: {
    findActiveByUserId: jest.fn(),
  },
}));

import { CompanyMember } from '@/models/CompanyMember';

const findActiveByUserId = CompanyMember.findActiveByUserId as jest.Mock;

describe('inbox-org-access', () => {
  const clientId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const otherOrgId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejeita usuário de outra organização (cross-tenant)', async () => {
    findActiveByUserId.mockResolvedValue({
      organizationId: new mongoose.Types.ObjectId(otherOrgId),
      isActive: true,
      companyRole: CompanyRole.ATTENDANT,
    });

    await expect(assertInboxOrganizationMember(clientId, userId)).rejects.toThrow(
      'Sem permissão para esta organização',
    );
  });

  it('aceita membro ativo da organização', async () => {
    const member = {
      organizationId: new mongoose.Types.ObjectId(clientId),
      isActive: true,
      companyRole: CompanyRole.ATTENDANT,
    };
    findActiveByUserId.mockResolvedValue(member);

    await expect(assertInboxOrganizationMember(clientId, userId)).resolves.toBe(member);
  });

  it('gestor pode sobrescrever conversa atribuída a outro', () => {
    expect(canOverrideAssignedConversation({ companyRole: CompanyRole.MANAGER })).toBe(true);
    expect(canOverrideAssignedConversation({ companyRole: CompanyRole.ATTENDANT })).toBe(false);
    expect(canOverrideAssignedConversation({ companyRole: CompanyRole.OWNER })).toBe(true);
  });
});
