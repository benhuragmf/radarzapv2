import mongoose from 'mongoose';
import { Organization } from '@/models/Organization';
import { CompanyMember } from '@/models/CompanyMember';
import { User } from '@/models/User';
import { Destination } from '@/models/Destination';
import { MessageQueue } from '@/models/MessageQueue';
import { ContactGroup } from '@/models/ContactGroup';
import { DiscordChannel } from '@/models/DiscordChannel';
import { Rule } from '@/models/Rule';
import { Template } from '@/models/Template';
import { StatusPost } from '@/models/StatusPost';
import { ConsentHistory } from '@/models/ConsentHistory';
import { ConsentPoll } from '@/models/ConsentPoll';
import { ConsentRenewalRequest } from '@/models/ConsentRenewalRequest';
import { InboxSettings } from '@/models/InboxSettings';
import { InboxDepartment } from '@/models/InboxDepartment';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxMessage } from '@/models/InboxMessage';
import { InboxTransfer } from '@/models/InboxTransfer';
import { ApiKey } from '@/models/ApiKey';
import { WebhookEndpoint } from '@/models/WebhookEndpoint';
import { BirthdayAutomationRule } from '@/models/BirthdayAutomationRule';
import { PlatformTemplate } from '@/models/PlatformTemplate';
import { SystemLog } from '@/models/SystemLog';
import { writeAuditLog } from '@/models/AuditLog';
import { CompanyRole } from '@/auth/rbac/roles';
import { OrganizationService } from './OrganizationService';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('OrganizationDeletionService');

export const DELETE_ORGANIZATION_CONFIRMATION = 'APAGAR TUDO';

export class OrganizationDeletionService {
  private static instance: OrganizationDeletionService;

  static getInstance(): OrganizationDeletionService {
    if (!OrganizationDeletionService.instance) {
      OrganizationDeletionService.instance = new OrganizationDeletionService();
    }
    return OrganizationDeletionService.instance;
  }

  async deleteOrganization(params: {
    organizationId: string;
    requesterUserId: string;
    confirmation: string;
    ip?: string;
  }): Promise<{ deletedUser: boolean; organizationName: string }> {
    const { organizationId, requesterUserId, confirmation, ip } = params;

    if (confirmation.trim() !== DELETE_ORGANIZATION_CONFIRMATION) {
      throw new Error(`Confirmação inválida. Digite exatamente ${DELETE_ORGANIZATION_CONFIRMATION}.`);
    }

    const org = await Organization.findById(organizationId);
    if (!org) throw new Error('Empresa não encontrada');

    const ownerMember = await CompanyMember.findOne({
      organizationId,
      userId: requesterUserId,
      companyRole: CompanyRole.OWNER,
      isActive: true,
    });
    if (!ownerMember && org.ownerUserId.toString() !== requesterUserId) {
      throw new Error('Apenas o dono da empresa pode excluir todos os dados');
    }

    const orgSvc = OrganizationService.getInstance();
    const clientIds = await orgSvc.getRelatedClientIds(organizationId);
    const oid = new mongoose.Types.ObjectId(organizationId);

    await writeAuditLog({
      action: 'organization_delete_requested',
      actorUserId: requesterUserId,
      details: { organizationId, organizationName: org.name },
      ip,
    });

    const wa = WhatsAppService.getInstance();
    const uniqueClientIds = [...new Set(clientIds.map(id => id.toString()))];
    for (const cid of uniqueClientIds) {
      await wa.purgeClientCompletely(cid);
    }

    const safeDelete = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        logger.warn(`Falha ao apagar ${label} durante exclusão de org`, {
          organizationId,
          err: (err as Error).message,
        });
      }
    };

    await safeDelete('destinations', () => Destination.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('messageQueue', () => MessageQueue.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('contactGroups', () => ContactGroup.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('discordChannels', () => DiscordChannel.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('rules', () => Rule.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('templates', () => Template.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('statusPosts', () => StatusPost.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('consentHistory', () => ConsentHistory.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('consentPolls', () => ConsentPoll.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('consentRenewal', () =>
      ConsentRenewalRequest.deleteMany({ clientId: { $in: clientIds } }),
    );
    await safeDelete('inboxSettings', () => InboxSettings.deleteMany({ clientId: oid }));
    await safeDelete('inboxDepartments', () => InboxDepartment.deleteMany({ clientId: oid }));
    await safeDelete('inboxConversations', () => InboxConversation.deleteMany({ clientId: oid }));
    await safeDelete('inboxMessages', () => InboxMessage.deleteMany({ clientId: oid }));
    await safeDelete('inboxTransfers', () => InboxTransfer.deleteMany({ clientId: oid }));
    await safeDelete('apiKeys', () => ApiKey.deleteMany({ organizationId: oid }));
    await safeDelete('webhooks', () => WebhookEndpoint.deleteMany({ organizationId: oid }));
    await safeDelete('birthdayRules', () => BirthdayAutomationRule.deleteMany({ organizationId: oid }));
    await safeDelete('platformTemplates', () =>
      PlatformTemplate.deleteMany({
        $or: [{ clientId: { $in: clientIds } }, { organizationId: oid }],
      }),
    );
    await safeDelete('systemLogs', () => SystemLog.deleteMany({ clientId: { $in: clientIds } }));
    await safeDelete('companyMembers', () => CompanyMember.deleteMany({ organizationId: oid }));

    await Organization.deleteOne({ _id: oid });

    const remainingMemberships = await CompanyMember.find({
      userId: requesterUserId,
      isActive: true,
    });

    let deletedUser = false;
    const requester = await User.findById(requesterUserId);
    if (requester) {
      if (remainingMemberships.length === 0) {
        await User.deleteOne({ _id: requester._id });
        deletedUser = true;
      } else if (requester.primaryOrganizationId?.toString() === organizationId) {
        requester.primaryOrganizationId = remainingMemberships[0].organizationId;
        await requester.save();
      }
    }

    logger.warn('Organização excluída permanentemente', {
      organizationId,
      organizationName: org.name,
      requesterUserId,
      deletedUser,
    });

    try {
      await writeAuditLog({
        action: 'organization_deleted',
        actorUserId: requesterUserId,
        details: { organizationId, organizationName: org.name, deletedUser },
        ip,
      });
    } catch (err) {
      logger.warn('Audit log pós-exclusão falhou', { organizationId, err });
    }

    return { deletedUser, organizationName: org.name };
  }
}
