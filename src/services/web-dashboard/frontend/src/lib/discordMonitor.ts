export type DiscordMonitorType = 'text' | 'voice' | 'guild'

export type DiscordRuleTrigger =
  | 'message'
  | 'voice_join'
  | 'voice_leave'
  | 'member_join'
  | 'member_leave'
  | 'member_kick'
  | 'member_ban'

export const MONITOR_LABELS: Record<DiscordMonitorType, string> = {
  text: 'Texto',
  voice: 'Voz',
  guild: 'Eventos',
}

export const TRIGGER_LABELS: Record<DiscordRuleTrigger, string> = {
  message: 'Nova mensagem',
  voice_join: 'Entrou na chamada',
  voice_leave: 'Saiu da chamada',
  member_join: 'Membro entrou',
  member_leave: 'Membro saiu',
  member_kick: 'Membro removido (kick)',
  member_ban: 'Membro banido',
}

export const TRIGGER_HINTS: Record<DiscordRuleTrigger, string> = {
  message: 'Dispara quando chega mensagem em canal de texto monitorado.',
  voice_join: 'Alguém entra em canal de voz monitorado. Configure o canal em Canais → Voz.',
  voice_leave: 'Alguém sai do canal de voz monitorado.',
  member_join: 'Novo membro no servidor. Requer monitor "Eventos do servidor".',
  member_leave: 'Membro saiu voluntariamente do servidor.',
  member_kick: 'Membro expulso (kick). Moderador via audit log quando disponível.',
  member_ban: 'Banimento no servidor.',
}

export const TRIGGER_GROUPS: {
  id: string
  title: string
  subtitle: string
  triggers: DiscordRuleTrigger[]
}[] = [
  {
    id: 'message',
    title: 'Mensagens',
    subtitle: 'Canais de texto',
    triggers: ['message'],
  },
  {
    id: 'voice',
    title: 'Chamada de voz',
    subtitle: 'Entrada e saída',
    triggers: ['voice_join', 'voice_leave'],
  },
  {
    id: 'members',
    title: 'Eventos do servidor',
    subtitle: 'Membros e moderação',
    triggers: ['member_join', 'member_leave', 'member_kick', 'member_ban'],
  },
]

export const EVENT_TEMPLATE_NAMES = [
  'dw-voice-join',
  'dw-voice-leave',
  'dw-member-join',
  'dw-member-leave',
  'dw-member-kick',
  'dw-member-ban',
] as const

export const EVENT_TRIGGERS: DiscordRuleTrigger[] = [
  'voice_join',
  'voice_leave',
  'member_join',
  'member_leave',
  'member_kick',
  'member_ban',
]

export function defaultTemplateForTrigger(trigger: DiscordRuleTrigger): string {
  if (trigger === 'message') return 'dw-padrao'
  return `dw-${trigger.replace(/_/g, '-')}`
}

export function getRuleTriggersFromRule(rule: {
  trigger?: DiscordRuleTrigger
  triggers?: DiscordRuleTrigger[]
}): DiscordRuleTrigger[] {
  if (rule.triggers?.length) return [...new Set(rule.triggers)]
  return [rule.trigger ?? 'message']
}

export function ruleHasMessageTrigger(triggers: DiscordRuleTrigger[]): boolean {
  return triggers.includes('message')
}

export function ruleHasVoiceTrigger(triggers: DiscordRuleTrigger[]): boolean {
  return triggers.some(t => t.startsWith('voice_'))
}

export function ruleHasMemberTrigger(triggers: DiscordRuleTrigger[]): boolean {
  return triggers.some(t => t.startsWith('member_'))
}

export function toggleRuleTrigger(
  current: DiscordRuleTrigger[],
  next: DiscordRuleTrigger,
): DiscordRuleTrigger[] {
  if (next === 'message') {
    return current.includes('message') && current.length === 1 ? [] : ['message']
  }

  const withoutMessage = current.filter(t => t !== 'message')
  if (withoutMessage.includes(next)) {
    const filtered = withoutMessage.filter(t => t !== next)
    return filtered.length ? filtered : []
  }
  return [...withoutMessage, next]
}
