import mongoose from 'mongoose';
import {
  assertSafeOrganizationRow,
  cancelAdminOpsOrganizationTrial,
  changeAdminOpsOrganizationPlan,
  extendAdminOpsOrganizationTrial,
  listAdminOpsOrganizations,
  validateAdminOpsReason,
} from '@/services/web-dashboard/admin-ops-organizations.service';
import { invalidateAdminOpsSummaryCache } from '@/services/web-dashboard/admin-ops-summary.service';

jest.mock('@/config/billing-env', () => ({
  stripeSecretKeyStatus: () => 'test',
}));

jest.mock('@/models/Organization', () => ({
  Organization: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('@/models/WhatsAppSession', () => ({
  WhatsAppSession: { aggregate: jest.fn() },
}));

jest.mock('@/models/CompanyMember', () => ({
  CompanyMember: { aggregate: jest.fn() },
}));

jest.mock('@/models/User', () => ({
  User: {
    getPlanLimits: jest.fn(() => ({
      messagesPerDay: 10,
      groupsMax: 2,
      templatesMax: 5,
    })),
  },
}));

jest.mock('@/models/AuditLog', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('@/services/web-dashboard/admin-ops-summary.service', () => ({
  invalidateAdminOpsSummaryCache: jest.fn(),
}));

const { Organization } = jest.requireMock('@/models/Organization');
const { WhatsAppSession } = jest.requireMock('@/models/WhatsAppSession');
const { writeAuditLog } = jest.requireMock('@/models/AuditLog');

const orgId = new mongoose.Types.ObjectId();

function mockOrg(overrides: Record<string, unknown> = {}) {
  return {
    _id: orgId,
    name: 'Acme Corp',
    plan: 'starter',
    planExpiresAt: new Date(Date.now() + 86400000),
    stripeSubscriptionStatus: 'trialing',
    createdAt: new Date('2026-01-01'),
    limits: { messagesPerDay: 100, groupsMax: 5, templatesMax: 10 },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('admin-ops-organizations.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    WhatsAppSession.aggregate.mockResolvedValue([]);
    jest.requireMock('@/models/CompanyMember').CompanyMember.aggregate.mockResolvedValue([]);
  });

  describe('validateAdminOpsReason', () => {
    it('rejeita motivo curto', () => {
      expect(() => validateAdminOpsReason('abc')).toThrow(/mínimo 5/);
    });

    it('aceita motivo válido', () => {
      expect(validateAdminOpsReason('Extensão aprovada')).toBe('Extensão aprovada');
    });
  });

  describe('listAdminOpsOrganizations', () => {
    it('pagina sem filtro de status', async () => {
      Organization.countDocuments.mockResolvedValue(1);
      Organization.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  {
                    _id: orgId,
                    name: 'Acme',
                    plan: 'starter',
                    planExpiresAt: null,
                    stripeSubscriptionStatus: null,
                    createdAt: new Date(),
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      const page = await listAdminOpsOrganizations({ page: 1, limit: 25 });
      expect(page.items).toHaveLength(1);
      expect(page.items[0].name).toBe('Acme');
      assertSafeOrganizationRow(page.items[0]);
    });

    it('filtra por status via MongoDB (sem full scan)', async () => {
      Organization.countDocuments.mockResolvedValue(1);
      Organization.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  {
                    _id: orgId,
                    name: 'Trial Co',
                    plan: 'starter',
                    planExpiresAt: new Date(Date.now() + 86400000),
                    stripeSubscriptionStatus: 'trialing',
                    createdAt: new Date(),
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      const page = await listAdminOpsOrganizations({ status: 'trialing' });
      expect(page.total).toBe(1);
      expect(page.items[0].billingStatus).toBe('trialing');
      expect(Organization.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionStatus: expect.objectContaining({ $regex: expect.any(RegExp) }),
        }),
      );
      expect(Organization.find).toHaveBeenCalled();
    });
  });

  describe('changeAdminOpsOrganizationPlan', () => {
    it('altera plano e audita', async () => {
      const org = mockOrg();
      Organization.findById.mockResolvedValue(org);

      const result = await changeAdminOpsOrganizationPlan(String(orgId), {
        plan: 'pro',
        reason: 'Cortesia parceiro',
        actorUserId: 'admin1',
      });

      expect(result.plan).toBe('pro');
      expect(org.save).toHaveBeenCalled();
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.plan.changed' }),
      );
      expect(invalidateAdminOpsSummaryCache).toHaveBeenCalled();
    });
  });

  describe('extendAdminOpsOrganizationTrial', () => {
    it('estende trial free → starter', async () => {
      const org = mockOrg({ plan: 'free', planExpiresAt: undefined });
      Organization.findById.mockResolvedValue(org);

      const result = await extendAdminOpsOrganizationTrial(String(orgId), {
        days: 7,
        reason: 'Extensão comercial',
        actorUserId: 'admin1',
      });

      expect(result.plan).toBe('starter');
      expect(org.stripeSubscriptionStatus).toBe('trialing');
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.trial.extended' }),
      );
    });
  });

  describe('cancelAdminOpsOrganizationTrial', () => {
    it('downgrade para free', async () => {
      const org = mockOrg();
      Organization.findById.mockResolvedValue(org);

      const result = await cancelAdminOpsOrganizationTrial(String(orgId), {
        reason: 'Trial encerrado manualmente',
        actorUserId: 'admin1',
      });

      expect(result.plan).toBe('free');
      expect(org.plan).toBe('free');
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.trial.cancelled' }),
      );
    });
  });
});
