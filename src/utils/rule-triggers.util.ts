import type { DiscordRuleTrigger } from '@/types/discord-monitor';

const VALID_TRIGGERS: DiscordRuleTrigger[] = [
  'message',
  'voice_join',
  'voice_leave',
  'member_join',
  'member_leave',
  'member_kick',
  'member_ban',
];

export function defaultTemplateForEventTrigger(trigger: DiscordRuleTrigger): string {
  if (trigger === 'message') return 'dw-padrao';
  return `dw-${trigger.replace(/_/g, '-')}`;
}

export function getRuleTriggers(rule: {
  trigger?: DiscordRuleTrigger;
  triggers?: DiscordRuleTrigger[];
}): DiscordRuleTrigger[] {
  if (rule.triggers?.length) {
    return [...new Set(rule.triggers.filter(t => VALID_TRIGGERS.includes(t)))];
  }
  const single = rule.trigger ?? 'message';
  return VALID_TRIGGERS.includes(single) ? [single] : ['message'];
}

export function normalizeRuleTriggersInput(input: {
  trigger?: unknown;
  triggers?: unknown;
}): DiscordRuleTrigger[] {
  let raw: unknown[] = [];
  if (Array.isArray(input.triggers) && input.triggers.length > 0) {
    raw = input.triggers;
  } else if (typeof input.trigger === 'string' && input.trigger) {
    raw = [input.trigger];
  } else {
    raw = ['message'];
  }

  const parsed = raw
    .filter((t): t is string => typeof t === 'string')
    .filter((t): t is DiscordRuleTrigger => VALID_TRIGGERS.includes(t as DiscordRuleTrigger));

  const unique = [...new Set(parsed)];
  if (unique.length === 0) return ['message'];

  if (unique.includes('message') && unique.length > 1) {
    return ['message'];
  }

  return unique;
}

export function resolveRuleTemplateForEvent(
  rule: { action: { templateName: string }; trigger?: DiscordRuleTrigger; triggers?: DiscordRuleTrigger[] },
  eventTrigger: DiscordRuleTrigger,
): string {
  const triggers = getRuleTriggers(rule);
  if (triggers.length === 1) return rule.action.templateName;
  if (eventTrigger === 'message') return rule.action.templateName;
  return defaultTemplateForEventTrigger(eventTrigger);
}
