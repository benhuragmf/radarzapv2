import mongoose from 'mongoose';
import { CompanyMember } from '@/models/CompanyMember';
import { OrganizationService } from '@/services/organization/OrganizationService';
import { CompanyRole } from '@/auth/rbac/roles';

jest.mock('@/models/CompanyMember');
jest.mock('@/models/AuditLog', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

const findOneMock = CompanyMember.findOne as jest.Mock;

describe('OrganizationService — isolamento multiempresa (equipe)', () => {
  const orgA = new mongoose.Types.ObjectId().toString();
  const orgB = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updateMember não altera membro de outra organização', async () => {
    findOneMock.mockResolvedValue(null);

    await expect(
      OrganizationService.getInstance().updateMember(orgB, memberId, CompanyRole.OWNER, {
        roleKey: CompanyRole.ATTENDANT,
      }),
    ).rejects.toThrow('Membro não encontrado');

    expect(findOneMock).toHaveBeenCalledWith({
      _id: memberId,
      organizationId: orgB,
      isActive: true,
    });
    expect(findOneMock.mock.calls[0][0].organizationId).not.toBe(orgA);
  });

  it('removeMember filtra por organizationId', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    findOneMock.mockResolvedValue({
      save,
      companyRole: CompanyRole.ATTENDANT,
      _id: memberId,
    });

    await OrganizationService.getInstance().removeMember(orgB, memberId, {
      companyRole: CompanyRole.OWNER,
      capabilities: [],
    });

    expect(findOneMock).toHaveBeenCalledWith({ _id: memberId, organizationId: orgB });
  });

  it('removeMember falha quando membro pertence a outra org', async () => {
    findOneMock.mockResolvedValue(null);

    await expect(
      OrganizationService.getInstance().removeMember(orgB, memberId, {
        companyRole: CompanyRole.OWNER,
        capabilities: [],
      }),
    ).rejects.toThrow('Membro não encontrado');
  });
});
