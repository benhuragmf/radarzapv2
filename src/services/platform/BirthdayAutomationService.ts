import mongoose from 'mongoose';
import { Destination, type IDestination } from '@/models/Destination';
import { BirthdayAutomationRule, type IBirthdayAutomationRule } from '@/models/BirthdayAutomationRule';
import { Organization, type IOrganization } from '@/models/Organization';
import { User, type IUser } from '@/models/User';
import { CampaignDispatchService } from '@/services/send/CampaignDispatchService';
import { ConsentService } from '@/services/consent/ConsentService';
import { buildPlatformWhatsAppVariables } from '@/utils/platform-wa-variables';
import { renderPlatformTemplateForClient } from '@/services/platform/platformTemplateRender';
import {
  TRIGGER_REQUIRES_BIRTHDAY,
  type PlatformAutomationTriggerType,
} from '@/constants/platform-automation-triggers';
import {
  isCalendarDayOfMonth,
  isNthBusinessDayOfMonth,
  weekdayMatches,
  weekdaysMatch,
} from '@/utils/automation-schedule';
import { QUEUED_RUN_PREFIX } from '@/constants/automation-scheduler';
import {
  buildSendAtToday,
  contactBirthdayMatchesToday,
  contactBirthdayDayOfMonth,
  intervalMonthsElapsed,
  isOnceAtPlanWindow,
  isRecurringPlanWindow,
  onceAtOccurrenceKey,
  recurringOccurrenceKey,
  wasBirthdaySentThisYear,
} from '@/utils/birthday-match';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('PlatformAutomationService');

function triggerRequiresBirthday(type: PlatformAutomationTriggerType): boolean {
  return TRIGGER_REQUIRES_BIRTHDAY.has(type);
}

function applyPlainVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

function scheduleMatchesToday(
  rule: Pick<
    IBirthdayAutomationRule,
    'triggerType' | 'dayOfMonth' | 'nthBusinessDay' | 'weekday' | 'weekdays' | 'scheduledAt'
  >,
  refDate: Date,
): boolean {
  switch (rule.triggerType) {
    case 'once_at':
      return true;
    case 'calendar_day_of_month':
      return isCalendarDayOfMonth(refDate, rule.dayOfMonth ?? 0);
    case 'nth_business_day_of_month':
      return isNthBusinessDayOfMonth(refDate, rule.nthBusinessDay ?? 0);
    case 'weekly': {
      if (rule.weekdays?.length) return weekdaysMatch(refDate, rule.weekdays);
      return weekdayMatches(refDate, rule.weekday ?? 0);
    }
    default:
      return true;
  }
}

export interface ProcessRuleOptions {
  /** Enfileira para envio futuro (fila de campanhas / Agendamentos). */
  sendAt?: Date;
  /** Ignora dedup de ocorrência — usado em "testar agora". */
  force?: boolean;
}

function recurringQueueKey(refDate: Date): string {
  return `${QUEUED_RUN_PREFIX.recurring}${recurringOccurrenceKey(refDate)}`;
}

function onceQueueKey(scheduledAt: Date): string {
  return `${QUEUED_RUN_PREFIX.once}${onceAtOccurrenceKey(scheduledAt)}`;
}

function isLegacyQueuedForToday(lastRunDate: string | undefined, refDate: Date): boolean {
  if (!lastRunDate) return false;
  if (lastRunDate.startsWith(QUEUED_RUN_PREFIX.recurring) || lastRunDate.startsWith(QUEUED_RUN_PREFIX.once)) {
    return false;
  }
  return lastRunDate === recurringOccurrenceKey(refDate);
}

export class BirthdayAutomationService {
  private static instance: BirthdayAutomationService;

  static getInstance(): BirthdayAutomationService {
    if (!BirthdayAutomationService.instance) {
      BirthdayAutomationService.instance = new BirthdayAutomationService();
    }
    return BirthdayAutomationService.instance;
  }

  /** Envios únicos / iminentes — tick a cada 1 min. */
  async planImminentOnceAt(refDate: Date = new Date()): Promise<number> {
    const rules = await BirthdayAutomationRule.find({
      active: true,
      triggerType: 'once_at',
      scheduledAt: { $exists: true, $ne: null },
    }).lean();
    return this.planRules(rules as IBirthdayAutomationRule[], refDate, 'imminent');
  }

  /** Regras recorrentes — tick a cada 5 min; pré-enfileira na fila de campanhas. */
  async planRecurringRules(refDate: Date = new Date()): Promise<number> {
    const rules = await BirthdayAutomationRule.find({
      active: true,
      triggerType: { $ne: 'once_at' },
    }).lean();
    return this.planRules(rules as IBirthdayAutomationRule[], refDate, 'recurring');
  }

  /** Ao criar/editar regra no painel — planeja imediatamente se aplicável. */
  async planSingleRule(
    rule: IBirthdayAutomationRule | { _id: mongoose.Types.ObjectId; toObject?: () => IBirthdayAutomationRule },
    refDate: Date = new Date(),
  ): Promise<number> {
    const doc =
      typeof (rule as IBirthdayAutomationRule).toObject === 'function'
        ? (rule as IBirthdayAutomationRule).toObject()
        : (rule as IBirthdayAutomationRule);
    if (!doc.active) return 0;
    const mode = doc.triggerType === 'once_at' ? 'imminent' : 'recurring';
    return this.planRules([doc], refDate, mode, true);
  }

  private async planRules(
    rules: IBirthdayAutomationRule[],
    refDate: Date,
    mode: 'imminent' | 'recurring',
    force = false,
  ): Promise<number> {
    let enqueued = 0;

    for (const rule of rules) {
      try {
        if (mode === 'imminent') {
          if (rule.triggerType !== 'once_at' || !rule.scheduledAt) continue;
          const sched = new Date(rule.scheduledAt);
          if (!isOnceAtPlanWindow(sched, refDate)) continue;
          const qKey = onceQueueKey(sched);
          if (!force && (rule.lastRunDate === qKey || isLegacyQueuedForToday(rule.lastRunDate, refDate))) {
            continue;
          }
          const count = await this.processRule(rule, refDate, { sendAt: sched });
          if (count > 0) {
            await BirthdayAutomationRule.updateOne({ _id: rule._id }, { $set: { lastRunDate: qKey } });
            enqueued += count;
          }
          continue;
        }

        if (rule.triggerType === 'once_at') continue;
        if (!scheduleMatchesToday(rule, refDate)) continue;

        const sendAt = buildSendAtToday(rule.sendTime, refDate);
        if (!sendAt || !isRecurringPlanWindow(sendAt, refDate)) continue;

        const qKey = recurringQueueKey(refDate);
        if (!force && (rule.lastRunDate === qKey || isLegacyQueuedForToday(rule.lastRunDate, refDate))) {
          continue;
        }

        const count = await this.processRule(rule, refDate, { sendAt });
        if (count > 0) {
          await BirthdayAutomationRule.updateOne({ _id: rule._id }, { $set: { lastRunDate: qKey } });
          enqueued += count;
        }
      } catch (err) {
        logger.error('Automation plan failed', {
          ruleId: rule._id,
          organizationId: rule.organizationId,
          mode,
          err,
        });
      }
    }

    if (enqueued > 0) {
      logger.info('Platform automation planned campaigns', { enqueued, mode });
    }
    return enqueued;
  }

  /** @deprecated use planImminentOnceAt + planRecurringRules */
  async processAllOrganizations(refDate: Date = new Date()): Promise<number> {
    const a = await this.planImminentOnceAt(refDate);
    const b = await this.planRecurringRules(refDate);
    return a + b;
  }

  async processRule(
    rule: IBirthdayAutomationRule,
    refDate: Date = new Date(),
    options: ProcessRuleOptions = {},
  ): Promise<number> {
    if (!scheduleMatchesToday(rule, refDate)) return 0;

    const clientId = rule.organizationId.toString();
    const scope = rule.destinationScope ?? 'contacts';
    const includeContacts = scope === 'contacts' || scope === 'both';
    const includeGroups = scope === 'whatsapp_groups' || scope === 'both';

    const org = await Organization.findById(clientId);
    const owner = org
      ? await User.findById(org.ownerUserId)
      : await User.findById(clientId);

    const dispatcher = CampaignDispatchService.getInstance();
    const ruleTitle = rule.name?.trim() || rule.templateName;
    const sendAt = options.sendAt;
    const deferSend = !!sendAt && sendAt.getTime() > Date.now() + 2000;
    const dispatchOpts = {
      sendAt: deferSend ? sendAt : undefined,
      perDestinationRender: deferSend,
      source: 'automation' as const,
      automationRuleId: rule._id.toString(),
    };
    let count = 0;

    if (includeContacts) {
      count += await this.processContactTargets(
        rule,
        refDate,
        clientId,
        org,
        owner,
        dispatcher,
        ruleTitle,
        dispatchOpts,
      );
    }

    if (includeGroups) {
      count += await this.processGroupTargets(
        rule,
        clientId,
        org,
        owner,
        dispatcher,
        ruleTitle,
        dispatchOpts,
      );
    }

    return count;
  }

  private async processContactTargets(
    rule: IBirthdayAutomationRule,
    refDate: Date,
    clientId: string,
    org: IOrganization | null,
    owner: IUser | null,
    dispatcher: CampaignDispatchService,
    ruleTitle: string,
    dispatchOpts: {
      sendAt?: Date;
      perDestinationRender?: boolean;
      source: 'automation';
      automationRuleId: string;
    },
  ): Promise<number> {
    const needsBirthday = triggerRequiresBirthday(rule.triggerType);

    const query: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(clientId),
      type: 'contact',
      isActive: true,
    };
    if (needsBirthday) {
      query.birthday = { $exists: true, $nin: [null, ''] };
    }

    const contacts = await Destination.find(query);
    const consentSvc = ConsentService.getInstance();
    const toSend: IDestination[] = [];

    for (const dest of contacts) {
      if (needsBirthday) {
        if (!dest.birthday) continue;
        if (!this.matchesBirthdayTrigger(rule, dest.birthday, dest, refDate)) continue;
        const useInterval =
          rule.triggerType === 'interval_months' ||
          (rule.intervalMonths != null && rule.intervalMonths > 0);
        if (useInterval) {
          const months = rule.intervalMonths ?? 6;
          if (!intervalMonthsElapsed(dest.birthdayLastSentAt, months, refDate)) continue;
        } else if (wasBirthdaySentThisYear(dest.birthdayLastSentAt, refDate)) {
          continue;
        }
      }

      if (!this.matchesContactFilters(rule, dest)) continue;

      const consentErr = consentSvc.assertCanSend(dest);
      if (consentErr) continue;
      toSend.push(dest);
    }

    if (toSend.length === 0) return 0;

    let count = 0;
    const deferred = !!dispatchOpts.sendAt;

    for (const dest of toSend) {
      const text = await this.buildMessage(
        rule,
        dest,
        org,
        owner,
        new mongoose.Types.ObjectId(clientId),
      );
      if (!text?.trim()) continue;

      await dispatcher.createCampaign({
        clientId,
        title: `${ruleTitle} — ${dest.name}`,
        message: text,
        destinations: [
          {
            type: 'contact',
            identifier: dest.identifier,
            name: dest.name,
          },
        ],
        sendAt: dispatchOpts.sendAt,
        priority: 'medium',
        delayBetweenMs: 3000,
        requireConnected: true,
        acceptWhatsAppRisk: false,
        messageMode: rule.messageMode === 'plain' ? 'plain' : 'platform_template',
        platformTemplateName:
          rule.messageMode === 'plain' ? undefined : rule.templateName,
        templateVariables: { mensagem: rule.mensagemExtra },
        perDestinationRender: dispatchOpts.perDestinationRender ?? false,
        source: dispatchOpts.source,
        automationRuleId: dispatchOpts.automationRuleId,
        automationBirthdayTouch: needsBirthday,
      });

      if (needsBirthday && !deferred) {
        dest.birthdayLastSentAt = refDate;
        await dest.save();
      }
      count++;
    }

    return count;
  }

  private async processGroupTargets(
    rule: IBirthdayAutomationRule,
    clientId: string,
    org: IOrganization | null,
    owner: IUser | null,
    dispatcher: CampaignDispatchService,
    ruleTitle: string,
    dispatchOpts: {
      sendAt?: Date;
      perDestinationRender?: boolean;
      source: 'automation';
      automationRuleId: string;
    },
  ): Promise<number> {
    const groups = await this.getWhatsAppGroupTargets(rule, clientId);
    if (groups.length === 0) return 0;

    let count = 0;
    const clientOid = new mongoose.Types.ObjectId(clientId);

    for (const dest of groups) {
      const text = await this.buildMessage(rule, dest, org, owner, clientOid);
      if (!text?.trim()) continue;

      await dispatcher.createCampaign({
        clientId,
        title: `${ruleTitle} — ${dest.name}`,
        message: text,
        destinations: [
          {
            type: 'group',
            identifier: dest.identifier,
            name: dest.name,
          },
        ],
        sendAt: dispatchOpts.sendAt,
        priority: 'medium',
        delayBetweenMs: 3000,
        requireConnected: true,
        acceptWhatsAppRisk: false,
        messageMode: rule.messageMode === 'plain' ? 'plain' : 'platform_template',
        platformTemplateName:
          rule.messageMode === 'plain' ? undefined : rule.templateName,
        templateVariables: { mensagem: rule.mensagemExtra },
        perDestinationRender: dispatchOpts.perDestinationRender ?? false,
        source: dispatchOpts.source,
        automationRuleId: dispatchOpts.automationRuleId,
      });
      count++;
    }

    return count;
  }

  private matchesContactFilters(rule: IBirthdayAutomationRule, dest: IDestination): boolean {
    if (rule.contactGroupIds?.length) {
      const allowed = new Set(rule.contactGroupIds.map(id => id.toString()));
      const inGroup = (dest.contactGroupIds ?? []).some(gid => allowed.has(gid.toString()));
      if (!inGroup) return false;
    }

    if (rule.destinationFilterTags?.length) {
      const tags = dest.tags ?? [];
      const hasTag = rule.destinationFilterTags.some(t => tags.includes(t));
      if (!hasTag) return false;
    }

    return true;
  }

  private async getWhatsAppGroupTargets(
    rule: IBirthdayAutomationRule,
    clientId: string,
  ): Promise<IDestination[]> {
    const query: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(clientId),
      type: 'group',
      isActive: true,
    };
    if (rule.whatsappDestinationIds?.length) {
      query._id = { $in: rule.whatsappDestinationIds };
    }
    return Destination.find(query);
  }

  private async buildMessage(
    rule: IBirthdayAutomationRule,
    dest: IDestination,
    org: IOrganization | null,
    owner: IUser | null,
    clientOid: mongoose.Types.ObjectId,
  ): Promise<string> {
    const vars = buildPlatformWhatsAppVariables(dest, org, owner, {
      mensagem: rule.mensagemExtra,
    });

    if (rule.messageMode === 'plain') {
      const raw = (rule.customMessage || rule.mensagemExtra || '').trim();
      return applyPlainVariables(raw, vars);
    }

    return renderPlatformTemplateForClient(clientOid, rule.templateName, vars);
  }

  matchesBirthdayTrigger(
    rule: Pick<
      IBirthdayAutomationRule,
      'triggerType' | 'dayOfMonth' | 'intervalMonths'
    >,
    birthday: string,
    dest: IDestination,
    refDate: Date,
  ): boolean {
    switch (rule.triggerType) {
      case 'on_contact_birthday':
        return contactBirthdayMatchesToday(birthday, refDate);
      case 'day_of_month':
        if (!rule.dayOfMonth) return false;
        return contactBirthdayDayOfMonth(birthday, rule.dayOfMonth);
      case 'interval_months':
        if (!contactBirthdayMatchesToday(birthday, refDate)) return false;
        return intervalMonthsElapsed(
          dest.birthdayLastSentAt,
          rule.intervalMonths ?? 6,
          refDate,
        );
      default:
        return false;
    }
  }

  /** @deprecated use matchesBirthdayTrigger */
  matchesTrigger(
    rule: Pick<
      IBirthdayAutomationRule,
      'triggerType' | 'dayOfMonth' | 'intervalMonths'
    >,
    birthday: string,
    dest: IDestination,
    refDate: Date,
  ): boolean {
    return this.matchesBirthdayTrigger(rule, birthday, dest, refDate);
  }
}
