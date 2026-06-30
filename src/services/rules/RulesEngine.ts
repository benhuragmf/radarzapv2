import mongoose from 'mongoose';
import { Rule, IRule } from '@/models/Rule';
import { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import { OrganizationService } from '@/services/organization/OrganizationService';
import { createServiceLogger } from '@/utils/logger';
import type { DiscordEventPayload, DiscordRuleTrigger } from '@/types/discord-monitor';
import { getRuleTriggers, resolveRuleTemplateForEvent } from '@/utils/rule-triggers.util';
import { memberHasAnyRole } from '@/utils/discord-id-list.util';

export interface RuleMatch {
  rule: IRule;
  destinationIds: mongoose.Types.ObjectId[];
  templateName: string;
  priority: 'high' | 'medium' | 'low';
  addDelay: number;
}

/**
 * Motor de regras do Radar Chat.
 * Avalia cada mensagem capturada contra as regras ativas do cliente
 * e retorna as ações que devem ser executadas.
 */
export class RulesEngine {
  private serviceLogger = createServiceLogger('RulesEngine');

  /**
   * Avalia uma mensagem contra todas as regras ativas do cliente.
   * Retorna uma lista de matches — uma mensagem pode bater em múltiplas regras.
   */
  async evaluate(message: ExtractedMessage, clientId: string): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = [];
    const clientIds = await this.getRelatedClientIds(clientId);
    const seenRuleIds = new Set<string>();
    let rulesChecked = 0;

    for (const cid of clientIds) {
      const rules = await Rule.find({
        clientId: cid,
        isActive: true,
        $or: [
          { trigger: 'message' },
          { trigger: { $exists: false } },
          { triggers: 'message' },
        ],
      }).sort({ createdAt: -1 });
      rulesChecked += rules.length;

      for (const rule of rules) {
        const ruleKey = rule._id.toString();
        if (seenRuleIds.has(ruleKey)) continue;

        if (this.matchesConditions(message, rule)) {
          seenRuleIds.add(ruleKey);
          matches.push({
            rule,
            destinationIds: rule.action.destinationIds,
            templateName: rule.action.templateName,
            priority: rule.action.priority,
            addDelay: rule.action.addDelay ?? 0,
          });

          rule.incrementMatchCount().catch(() => {});

          this.serviceLogger.debug('Rule matched', {
            ruleId: rule._id,
            ruleName: rule.name,
            messageId: message.messageId,
            ruleClientId: cid.toString(),
          });
        }
      }
    }

    if (rulesChecked === 0) {
      this.serviceLogger.debug('No active rules for client', { clientId, relatedIds: clientIds.map(String) });
      return matches;
    }

    this.serviceLogger.info('Rules evaluated', {
      clientId,
      messageId: message.messageId,
      rulesChecked,
      matchesFound: matches.length,
    });

    return matches;
  }

  /**
   * Avalia eventos Discord (voz, membros) contra regras ativas.
   */
  async evaluateEvent(event: DiscordEventPayload, clientId: string): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = [];
    const clientIds = await this.getRelatedClientIds(clientId);
    const seenRuleIds = new Set<string>();

    for (const cid of clientIds) {
      const rules = await Rule.find({
        clientId: cid,
        isActive: true,
        $or: [{ trigger: event.trigger }, { triggers: event.trigger }],
      }).sort({ createdAt: -1 });

      for (const rule of rules) {
        const ruleKey = rule._id.toString();
        if (seenRuleIds.has(ruleKey)) continue;

        if (this.matchesEventConditions(event, rule)) {
          seenRuleIds.add(ruleKey);
          matches.push({
            rule,
            destinationIds: rule.action.destinationIds,
            templateName: resolveRuleTemplateForEvent(rule, event.trigger),
            priority: rule.action.priority,
            addDelay: rule.action.addDelay ?? 0,
          });
          rule.incrementMatchCount().catch(() => {});
        }
      }
    }

    this.serviceLogger.info('Event rules evaluated', {
      clientId,
      trigger: event.trigger,
      matchesFound: matches.length,
    });

    return matches;
  }

  private matchesEventConditions(event: DiscordEventPayload, rule: IRule): boolean {
    const c = rule.conditions;
    const triggers = getRuleTriggers(rule);

    if (!triggers.includes(event.trigger)) return false;

    if (c.guildIds && c.guildIds.length > 0) {
      if (!c.guildIds.includes(event.guildId)) return false;
    }

    if (event.trigger.startsWith('voice_')) {
      if (c.voiceChannelIds && c.voiceChannelIds.length > 0) {
        if (!c.voiceChannelIds.includes(event.channelId)) return false;
      }
    }

    if (c.authorIds && c.authorIds.length > 0) {
      if (!c.authorIds.includes(event.userId)) return false;
    }

    if (c.roleIds && c.roleIds.length > 0) {
      if (!memberHasAnyRole(event.roleIds, c.roleIds)) return false;
    }

    if (
      event.trigger === 'message_edit' ||
      event.trigger === 'message_reaction'
    ) {
      if (c.channelIds && c.channelIds.length > 0) {
        if (!c.channelIds.includes(event.channelId)) return false;
      }
    }

    return true;
  }

  private async getRelatedClientIds(clientId: string): Promise<mongoose.Types.ObjectId[]> {
    if (process.env.JEST_WORKER_ID && mongoose.connection.readyState === 0) {
      return [new mongoose.Types.ObjectId(clientId)];
    }
    return OrganizationService.getInstance().getRelatedClientIds(clientId);
  }

  /**
   * Verifica se uma mensagem satisfaz TODAS as condições de uma regra (AND).
   * Público para preview de regras no painel.
   */
  messageMatchesRule(message: ExtractedMessage, rule: IRule): boolean {
    return this.matchesConditions(message, rule);
  }

  private matchesConditions(message: ExtractedMessage, rule: IRule): boolean {
    const triggers = getRuleTriggers(rule);
    if (!triggers.includes('message')) return false;

    const c = rule.conditions;

    // Filtro por canal
    if (c.channelIds && c.channelIds.length > 0) {
      if (!c.channelIds.includes(message.channelId)) return false;
    }

    // Filtro por servidor
    if (c.guildIds && c.guildIds.length > 0) {
      if (!c.guildIds.includes(message.guildId)) return false;
    }

    // Filtro por autor específico
    if (c.authorIds && c.authorIds.length > 0) {
      if (!c.authorIds.includes(message.authorId)) return false;
    }

    if (c.roleIds && c.roleIds.length > 0) {
      if (!memberHasAnyRole(message.authorRoleIds, c.roleIds)) return false;
    }

    // Apenas bots
    if (c.onlyBots && !message.isBot) return false;

    // Apenas usuários (não bots)
    if (c.onlyUsers && message.isBot) return false;

    // Palavras-chave obrigatórias (qualquer uma basta — OR)
    const searchable = [
      message.text,
      message.searchText,
      message.whatsappBody,
      message.embedFieldsText,
      message.embedTitles.join(' '),
      message.embedDescriptions.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (c.requireKeywords && c.requireKeywords.length > 0) {
      const hasKeyword = c.requireKeywords.some(kw => searchable.includes(kw.toLowerCase()));
      if (!hasKeyword) return false;
    }

    // Palavras proibidas (nenhuma pode estar presente)
    if (c.excludeKeywords && c.excludeKeywords.length > 0) {
      const text = searchable;
      const hasExcluded = c.excludeKeywords.some(kw => text.includes(kw.toLowerCase()));
      if (hasExcluded) return false;
    }

    // Requer link
    if (c.requireLink && !message.hasLink) return false;

    // Requer imagem
    if (c.requireImage && !message.hasImage) return false;

    // Requer embed
    if (c.requireEmbed && !message.hasEmbed) return false;

    return true;
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createRule(
    clientId: string,
    data: {
      name: string;
      conditions: IRule['conditions'];
      action: IRule['action'];
    }
  ): Promise<IRule> {
    const rule = new Rule({
      clientId: new mongoose.Types.ObjectId(clientId),
      name: data.name,
      isActive: true,
      conditions: data.conditions,
      action: data.action,
    });

    await rule.save();
    this.serviceLogger.info('Rule created', { ruleId: rule._id, name: rule.name, clientId });
    return rule;
  }

  async updateRule(
    ruleId: string,
    clientId: string,
    data: Partial<Pick<IRule, 'name' | 'conditions' | 'action'>>
  ): Promise<IRule> {
    const rule = await Rule.findOne({
      _id: new mongoose.Types.ObjectId(ruleId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!rule) throw new Error('Rule not found');

    if (data.name) rule.name = data.name;
    if (data.conditions) rule.conditions = { ...rule.conditions, ...data.conditions };
    if (data.action) rule.action = { ...rule.action, ...data.action };

    await rule.save();
    this.serviceLogger.info('Rule updated', { ruleId, clientId });
    return rule;
  }

  async deleteRule(ruleId: string, clientId: string): Promise<void> {
    const result = await Rule.deleteOne({
      _id: new mongoose.Types.ObjectId(ruleId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (result.deletedCount === 0) throw new Error('Rule not found');
    this.serviceLogger.info('Rule deleted', { ruleId, clientId });
  }

  async toggleRule(ruleId: string, clientId: string): Promise<IRule> {
    const rule = await Rule.findOne({
      _id: new mongoose.Types.ObjectId(ruleId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!rule) throw new Error('Rule not found');
    return rule.toggle();
  }

  async getRules(clientId: string): Promise<IRule[]> {
    return Rule.findByClientId(new mongoose.Types.ObjectId(clientId));
  }
}
