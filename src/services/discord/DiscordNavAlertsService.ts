import mongoose from 'mongoose';
import { Rule } from '@/models/Rule';
import { DiscordChannel } from '@/models/DiscordChannel';
import { SystemLog } from '@/models/SystemLog';
import { OrganizationService } from '@/services/organization/OrganizationService';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { RuleGroupBlockService } from '@/services/rules/RuleGroupBlockService';
import {
  DISCORD_NAV_ALERT_IDS,
  DISCORD_PIPELINE_LOG_SERVICES,
  type NavAlertItem,
  type NavAlertsMap,
} from '@/constants/nav-alerts';

const ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;

export class DiscordNavAlertsService {
  private static instance: DiscordNavAlertsService;

  static getInstance(): DiscordNavAlertsService {
    if (!DiscordNavAlertsService.instance) {
      DiscordNavAlertsService.instance = new DiscordNavAlertsService();
    }
    return DiscordNavAlertsService.instance;
  }

  async getAlerts(clientId: string, guildId?: string): Promise<{ items: NavAlertsMap }> {
    const items: NavAlertsMap = {};
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const since = new Date(Date.now() - ALERT_WINDOW_MS);

    const groupIssue = await this.checkActiveRulesGroupMembership(clientId, guildId);
    if (groupIssue) {
      items[DISCORD_NAV_ALERT_IDS.RULES] = groupIssue;
    }

    const pipelineErrors = await SystemLog.countDocuments({
      clientId: clientOid,
      level: 'error',
      service: { $in: DISCORD_PIPELINE_LOG_SERVICES },
      timestamp: { $gte: since },
    });

    if (pipelineErrors > 0) {
      items[DISCORD_NAV_ALERT_IDS.LOGS] = {
        severity: 'warn',
        count: pipelineErrors,
        summary:
          pipelineErrors === 1
            ? '1 erro recente no pipeline Discord → WhatsApp'
            : `${pipelineErrors} erros recentes no pipeline Discord → WhatsApp`,
        code: 'pipeline_errors',
      };
    }

    return { items };
  }

  private async checkActiveRulesGroupMembership(
    clientId: string,
    guildId?: string,
  ): Promise<NavAlertItem | null> {
    const orgSvc = OrganizationService.getInstance();
    const relatedIds = await orgSvc.getRelatedClientIds(clientId);
    const query: Record<string, unknown> = {
      clientId: { $in: relatedIds },
      isActive: true,
    };

    if (guildId) {
      const channels = await DiscordChannel.find({ guildId, isActive: true }).lean();
      const channelIds = channels.map(c => c.channelId);
      if (channelIds.length === 0) return null;
      query['conditions.channelIds'] = { $in: channelIds };
    }

    const rules = await Rule.find(query).lean();
    if (!rules.length) return null;

    const wa = WhatsAppService.getInstance();
    if (!wa.isClientConnected(clientId)) return null;

    const blockSvc = RuleGroupBlockService.getInstance();
    const blockedRules: Array<{ name: string; reason: string }> = [];

    for (const rule of rules) {
      const block = await blockSvc.checkRuleBlocked(
        clientId,
        rule.action?.destinationIds as mongoose.Types.ObjectId[] | undefined,
      );
      if (block.blocked && block.reason) {
        blockedRules.push({ name: rule.name, reason: block.reason });
      }
    }

    if (blockedRules.length === 0) return null;

    const first = blockedRules[0];
    return {
      severity: 'error',
      count: blockedRules.length,
      summary:
        blockedRules.length === 1
          ? `Regra "${first.name}" bloqueada — ${first.reason}`
          : `${blockedRules.length} regras bloqueadas — número fora de grupo destino`,
      code: 'wa_not_in_group',
    };
  }
}
