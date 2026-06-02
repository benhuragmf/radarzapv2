import mongoose from 'mongoose';
import { Rule, IRule } from '@/models/Rule';
import { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import { createServiceLogger } from '@/utils/logger';

export interface RuleMatch {
  rule: IRule;
  destinationIds: mongoose.Types.ObjectId[];
  templateName: string;
  priority: 'high' | 'medium' | 'low';
  addDelay: number;
}

/**
 * Motor de regras do RadarZap.
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

    const rules = await Rule.findActiveByClientId(
      new mongoose.Types.ObjectId(clientId)
    );

    if (rules.length === 0) {
      this.serviceLogger.debug('No active rules for client', { clientId });
      return matches;
    }

    for (const rule of rules) {
      if (this.matchesConditions(message, rule)) {
        matches.push({
          rule,
          destinationIds: rule.action.destinationIds,
          templateName: rule.action.templateName,
          priority: rule.action.priority,
          addDelay: rule.action.addDelay ?? 0,
        });

        // Incrementa contador de matches em background
        rule.incrementMatchCount().catch(() => {});

        this.serviceLogger.debug('Rule matched', {
          ruleId: rule._id,
          ruleName: rule.name,
          messageId: message.messageId,
        });
      }
    }

    this.serviceLogger.info('Rules evaluated', {
      clientId,
      messageId: message.messageId,
      rulesChecked: rules.length,
      matchesFound: matches.length,
    });

    return matches;
  }

  /**
   * Verifica se uma mensagem satisfaz TODAS as condições de uma regra (AND).
   */
  private matchesConditions(message: ExtractedMessage, rule: IRule): boolean {
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

    // Apenas bots
    if (c.onlyBots && !message.isBot) return false;

    // Apenas usuários (não bots)
    if (c.onlyUsers && message.isBot) return false;

    // Palavras-chave obrigatórias (qualquer uma basta — OR)
    if (c.requireKeywords && c.requireKeywords.length > 0) {
      const text = (message.text + ' ' + message.embedTitles.join(' ') + ' ' + message.embedDescriptions.join(' ')).toLowerCase();
      const hasKeyword = c.requireKeywords.some(kw => text.includes(kw.toLowerCase()));
      if (!hasKeyword) return false;
    }

    // Palavras proibidas (nenhuma pode estar presente)
    if (c.excludeKeywords && c.excludeKeywords.length > 0) {
      const text = (message.text + ' ' + message.embedTitles.join(' ') + ' ' + message.embedDescriptions.join(' ')).toLowerCase();
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
