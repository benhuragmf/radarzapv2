import crypto from 'crypto';
import mongoose from 'mongoose';
import { Rule, type IRule } from '@/models/Rule';
import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import { RulesEngine } from '@/services/rules/RulesEngine';
import { renderCatalogTemplate } from '@/constants/discord-whatsapp-templates';
import { buildDiscordWhatsAppVariables } from '@/utils/discord-wa-variables';
import {
  applyStandardWhatsAppLayout,
  collectPrimaryLink,
  inferTwitchSlug,
} from '@/utils/discord-wa-format';
import { resolveStreamTemplate, streamLinkFromExtracted } from '@/utils/stream-template';
import { resolveTenantSenderLabelAsync } from '@/utils/radarzap-sender';
import { Organization, User } from '@/models';
import {
  normalizeRuleTriggersInput,
  parseKeywordList,
  resolveRuleTemplateForEvent,
} from '@/utils/rule-triggers.util';
import type { DiscordRuleTrigger } from '@/types/discord-monitor';

export interface RulePreviewSample {
  text: string;
  channelId?: string;
  channelName?: string;
  guildId?: string;
  guildName?: string;
  hasLink?: boolean;
  hasImage?: boolean;
  hasEmbed?: boolean;
  isBot?: boolean;
  captureKind?: string;
  embedTitle?: string;
  primaryLink?: string;
}

export interface RulePreviewInput {
  ruleId?: string;
  name?: string;
  triggers?: DiscordRuleTrigger[];
  trigger?: DiscordRuleTrigger;
  templateName?: string;
  keywords?: string;
  excludeKeywords?: string;
  channelIds?: string[];
  onlyBots?: boolean;
  onlyUsers?: boolean;
  requireLink?: boolean;
  requireImage?: boolean;
  requireEmbed?: boolean;
  sample: RulePreviewSample;
}

export interface RulePreviewResult {
  matched: boolean;
  reason?: string;
  ruleName?: string;
  templateName?: string;
  renderedPreview?: string;
  captureKind?: string;
}

function buildSampleMessage(sample: RulePreviewSample): ExtractedMessage {
  const text = sample.text.trim();
  const links = sample.hasLink || sample.primaryLink
    ? [sample.primaryLink ?? 'https://exemplo.com/promo']
    : [];
  const searchText = [text, sample.embedTitle].filter(Boolean).join(' ');

  return {
    messageId: `preview-${crypto.randomUUID()}`,
    guildId: sample.guildId ?? '000000000000000000',
    guildName: sample.guildName ?? 'Servidor exemplo',
    channelId: sample.channelId ?? '000000000000000001',
    channelName: sample.channelName ?? 'ofertas',
    authorId: sample.isBot ? '999999999999999999' : '111111111111111111',
    authorName: sample.isBot ? 'BotPromo' : 'UsuarioTeste',
    authorTag: sample.isBot ? 'BotPromo#0000' : 'UsuarioTeste#1234',
    discordPosterLabel: sample.isBot ? 'BotPromo' : 'UsuarioTeste',
    isBot: Boolean(sample.isBot),
    text,
    hasEmbed: Boolean(sample.hasEmbed ?? sample.embedTitle),
    hasLink: Boolean(sample.hasLink ?? links.length),
    hasImage: Boolean(sample.hasImage),
    links,
    imageUrls: sample.hasImage ? ['https://cdn.example/image.png'] : [],
    embedTitles: sample.embedTitle ? [sample.embedTitle] : [],
    embedDescriptions: [],
    captureKind: sample.captureKind ?? (sample.hasLink ? 'promo' : 'text'),
    searchText,
    whatsappBody: text,
    embedFieldsText: '',
    primaryLink: links[0],
    timestamp: new Date(),
    hash: crypto.createHash('sha256').update(text).digest('hex'),
  };
}

function buildDraftRule(clientId: string, input: RulePreviewInput): IRule {
  const triggers = normalizeRuleTriggersInput({ trigger: input.trigger, triggers: input.triggers });
  return {
    _id: new mongoose.Types.ObjectId(),
    clientId: new mongoose.Types.ObjectId(clientId),
    name: input.name ?? 'Prévia',
    isActive: true,
    trigger: triggers[0],
    triggers,
    conditions: {
      channelIds: input.channelIds ?? [],
      voiceChannelIds: [],
      requireKeywords: parseKeywordList(input.keywords),
      excludeKeywords: parseKeywordList(input.excludeKeywords),
      onlyBots: Boolean(input.onlyBots),
      onlyUsers: Boolean(input.onlyUsers),
      requireLink: Boolean(input.requireLink),
      requireImage: Boolean(input.requireImage),
      requireEmbed: Boolean(input.requireEmbed),
    },
    action: {
      destinationIds: [],
      templateName: input.templateName ?? 'dw-padrao',
      priority: 'medium',
      addDelay: 0,
    },
    matchCount: 0,
  } as IRule;
}

async function renderPreview(
  extracted: ExtractedMessage,
  templateName: string,
  clientId: string,
): Promise<{ rendered: string; resolvedTemplate: string; captureKind?: string }> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const org = await Organization.findById(clientOid);
  let user = await User.findById(clientOid);
  if (!user && org) user = await User.findById(org.ownerUserId);

  extracted.radarzapSenderLabel = await resolveTenantSenderLabelAsync(org, user);

  const linkForRoute = streamLinkFromExtracted(extracted);
  if (linkForRoute && /twitch\.tv|youtube\.com|youtu\.be/i.test(linkForRoute)) {
    extracted.captureKind = 'live';
  }

  const { template: resolvedTemplate } = resolveStreamTemplate(
    templateName,
    extracted.captureKind ?? 'text',
    extracted,
  );

  const slug = inferTwitchSlug(extracted);
  if (slug && !extracted.embedAuthorName) extracted.embedAuthorName = slug;

  const { variables } = buildDiscordWhatsAppVariables(extracted);
  const linkFinal = collectPrimaryLink(extracted) || variables.link_principal || '';

  let rendered =
    renderCatalogTemplate(resolvedTemplate, variables as Record<string, string>) ?? '';

  rendered = applyStandardWhatsAppLayout(rendered, variables.rodape || '', linkFinal);

  return { rendered, resolvedTemplate, captureKind: extracted.captureKind };
}

export class DiscordRulePreviewService {
  private static instance: DiscordRulePreviewService;
  private rulesEngine = new RulesEngine();

  static getInstance(): DiscordRulePreviewService {
    if (!DiscordRulePreviewService.instance) {
      DiscordRulePreviewService.instance = new DiscordRulePreviewService();
    }
    return DiscordRulePreviewService.instance;
  }

  async preview(clientId: string, input: RulePreviewInput): Promise<RulePreviewResult> {
    const extracted = buildSampleMessage(input.sample);
    const triggers = normalizeRuleTriggersInput({ trigger: input.trigger, triggers: input.triggers });

    if (!triggers.includes('message')) {
      return {
        matched: false,
        reason: 'Prévia disponível apenas para gatilho de mensagem.',
      };
    }

    let rule: IRule | null = null;

    if (input.ruleId) {
      rule = await Rule.findOne({
        _id: input.ruleId,
        clientId: new mongoose.Types.ObjectId(clientId),
      });
      if (!rule) return { matched: false, reason: 'Regra não encontrada.' };
    } else {
      rule = buildDraftRule(clientId, input);
    }

    const matched = this.rulesEngine.messageMatchesRule(extracted, rule);
    if (!matched) {
      return {
        matched: false,
        reason: 'A mensagem de exemplo não satisfaz os filtros desta regra.',
        captureKind: extracted.captureKind,
      };
    }

    const templateName = resolveRuleTemplateForEvent(rule, 'message');
    const { rendered, resolvedTemplate, captureKind } = await renderPreview(
      extracted,
      templateName,
      clientId,
    );

    return {
      matched: true,
      ruleName: rule.name,
      templateName: resolvedTemplate,
      renderedPreview: rendered,
      captureKind,
    };
  }
}
