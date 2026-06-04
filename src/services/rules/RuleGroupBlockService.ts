import mongoose from 'mongoose';
import { Destination } from '@/models/Destination';
import { OrganizationService } from '@/services/organization/OrganizationService';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';

export interface RuleExecutionBlock {
  blocked: boolean;
  reason: string | null;
  blockedGroupNames: string[];
}

export class RuleGroupBlockService {
  private static instance: RuleGroupBlockService;

  static getInstance(): RuleGroupBlockService {
    if (!RuleGroupBlockService.instance) {
      RuleGroupBlockService.instance = new RuleGroupBlockService();
    }
    return RuleGroupBlockService.instance;
  }

  async resolveDestinationIds(
    clientId: string,
    destinationIds: mongoose.Types.ObjectId[] | undefined,
  ): Promise<mongoose.Types.ObjectId[]> {
    if (destinationIds?.length) {
      return destinationIds;
    }

    const relatedIds = await OrganizationService.getInstance().getRelatedClientIds(clientId);
    const allDests = (
      await Promise.all(relatedIds.map(id => Destination.findByClientId(id, true)))
    ).flat();

    const seen = new Set<string>();
    return allDests
      .filter(d => {
        const key = String(d._id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(d => d._id as mongoose.Types.ObjectId);
  }

  /** Bloqueia a regra se o WhatsApp não participa de algum grupo destino. */
  async checkRuleBlocked(
    clientId: string,
    destinationIds: mongoose.Types.ObjectId[] | undefined,
  ): Promise<RuleExecutionBlock> {
    const wa = WhatsAppService.getInstance();
    if (!wa.isClientConnected(clientId)) {
      return { blocked: false, reason: null, blockedGroupNames: [] };
    }

    const resolvedIds = await this.resolveDestinationIds(clientId, destinationIds);
    if (!resolvedIds.length) {
      return { blocked: false, reason: null, blockedGroupNames: [] };
    }

    const groupDests = await Destination.find({
      _id: { $in: resolvedIds },
      type: 'group',
      isActive: true,
    }).lean();

    if (!groupDests.length) {
      return { blocked: false, reason: null, blockedGroupNames: [] };
    }

    for (const group of groupDests) {
      const err = await wa.validateGroupMembershipForSend(clientId, [
        { identifier: group.identifier, name: group.name },
      ]);
      if (err) {
        return {
          blocked: true,
          reason: err,
          blockedGroupNames: [group.name],
        };
      }
    }

    return { blocked: false, reason: null, blockedGroupNames: [] };
  }
}
