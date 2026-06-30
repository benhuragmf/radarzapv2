import { MessageSquare, Mic, Users, UserPlus, UserMinus, UserX, Ban, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  type DiscordRuleTrigger,
  TRIGGER_GROUPS,
  TRIGGER_HINTS,
  TRIGGER_LABELS,
  toggleRuleTrigger,
} from '../../lib/discordMonitor'
import { cn } from '@/lib/utils'

const TRIGGER_ICONS: Partial<Record<DiscordRuleTrigger, LucideIcon>> = {
  message: MessageSquare,
  voice_join: Mic,
  voice_leave: Mic,
  member_join: UserPlus,
  member_leave: UserMinus,
  member_kick: UserX,
  member_ban: Ban,
}

interface Props {
  value: DiscordRuleTrigger[]
  onChange: (triggers: DiscordRuleTrigger[]) => void
}

export function RuleTriggerPicker({ value, onChange }: Props) {
  const selected = new Set(value)

  const handleToggle = (trigger: DiscordRuleTrigger) => {
    onChange(toggleRuleTrigger(value, trigger))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-[var(--rz-text-muted)]">
          Clique para marcar ou desmarcar — pode combinar vários gatilhos na mesma regra.
        </p>
        {value.length > 0 && (
          <span className="text-[10px] font-medium text-brand-400 shrink-0">
            {value.length} selecionado{value.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {TRIGGER_GROUPS.map(group => (
        <div key={group.id}>
          <div className="mb-2">
            <p className="text-xs font-semibold text-[var(--rz-text-secondary)]">{group.title}</p>
            <p className="text-[10px] text-[var(--rz-text-muted)]">{group.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.triggers.map(trigger => {
              const Icon = TRIGGER_ICONS[trigger] ?? MessageSquare
              const isSelected = selected.has(trigger)
              return (
                <button
                  key={trigger}
                  type="button"
                  onClick={() => handleToggle(trigger)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors min-w-[140px]',
                    isSelected
                      ? 'bg-brand-600 border-brand-500 text-white shadow-sm'
                      : 'bg-[var(--rz-surface-muted)] border-[var(--rz-border)] text-[var(--rz-text-secondary)] hover:border-brand-500/50',
                  )}
                >
                  <Icon size={14} className={isSelected ? 'text-white' : 'text-brand-400'} />
                  <span className="font-medium leading-tight flex-1">{TRIGGER_LABELS[trigger]}</span>
                  {isSelected && <Check size={12} className="shrink-0 opacity-90" />}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {value.length === 0 ? (
        <p className="text-xs text-amber-500/90 rounded-lg bg-amber-950/20 border border-amber-800/40 px-3 py-2">
          Selecione ao menos um gatilho para salvar a regra.
        </p>
      ) : value.length === 1 ? (
        <p className="text-xs text-[var(--rz-text-muted)] rounded-lg bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)] px-3 py-2">
          {TRIGGER_HINTS[value[0]]}
        </p>
      ) : (
        <div className="text-xs text-[var(--rz-text-muted)] rounded-lg bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)] px-3 py-2 space-y-1">
          <p className="font-medium text-[var(--rz-text-secondary)]">Gatilhos desta regra:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {value.map(t => (
              <li key={t}>
                <span className="text-[var(--rz-text-secondary)]">{TRIGGER_LABELS[t]}</span>
                {' — '}
                {TRIGGER_HINTS[t]}
              </li>
            ))}
          </ul>
          {value.some(t => t !== 'message') && value.length > 1 && (
            <p className="pt-1 text-[10px] border-t border-[var(--rz-border)] mt-2">
              Com vários gatilhos de evento, o template recomendado é aplicado automaticamente a cada tipo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
