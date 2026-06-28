import mongoose from 'mongoose';
import { CompanyRole } from '@/auth/rbac/roles';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxService } from '@/services/inbox/InboxService';
import { LeadCapture } from '@/models/LeadCapture';
import { LeadFormService } from '@/services/leads/LeadFormService';

jest.mock('@/models/CompanyMember', () => ({
  CompanyMember: {
    findActiveByUserId: jest.fn(),
  },
}));

jest.mock('@/models/InboxConversation');
jest.mock('@/models/LeadCapture');
jest.mock('@/models/LeadForm', () => ({ LeadForm: { findById: jest.fn() } }));
jest.mock('@/models/ContactGroup', () => ({ ContactGroup: { find: jest.fn().mockResolvedValue([]) } }));

import { CompanyMember } from '@/models/CompanyMember';

const findActiveByUserId = CompanyMember.findActiveByUserId as jest.Mock;
const findOneConv = InboxConversation.findOne as jest.Mock;
const findOneCapture = LeadCapture.findOne as jest.Mock;

function freshInboxService(): InboxService {
  (InboxService as unknown as { instance?: InboxService }).instance = undefined;
  return InboxService.getInstance();
}

function freshLeadFormService(): LeadFormService {
  (LeadFormService as unknown as { instance?: LeadFormService }).instance = undefined;
  return LeadFormService.getInstance();
}

describe('isolamento cross-tenant — Inbox + Leads (AH-M04)', () => {
  const orgA = new mongoose.Types.ObjectId().toString();
  const orgB = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const foreignConvId = new mongoose.Types.ObjectId().toString();
  const foreignCaptureId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    findActiveByUserId.mockResolvedValue({
      organizationId: new mongoose.Types.ObjectId(orgB),
      isActive: true,
      companyRole: CompanyRole.OWNER,
    });
  });

  it('InboxService.getConversationDetail exige conversa no clientId da sessão', async () => {
    findOneConv.mockResolvedValue(null);
    const svc = freshInboxService();

    await expect(svc.getConversationDetail(orgB, userId, foreignConvId)).rejects.toThrow(
      'Conversa não encontrada',
    );

    expect(findOneConv).toHaveBeenCalledWith({
      _id: new mongoose.Types.ObjectId(foreignConvId),
      clientId: new mongoose.Types.ObjectId(orgB),
    });
    const callClientId = findOneConv.mock.calls[0][0].clientId.toString();
    expect(callClientId).not.toBe(orgA);
  });

  it('LeadFormService.getCapture não retorna lead de outra org', async () => {
    findOneCapture.mockResolvedValue(null);
    const svc = freshLeadFormService();

    const item = await svc.getCapture(orgB, foreignCaptureId);
    expect(item).toBeNull();

    expect(findOneCapture).toHaveBeenCalledWith({
      _id: new mongoose.Types.ObjectId(foreignCaptureId),
      clientId: new mongoose.Types.ObjectId(orgB),
    });
  });
});
