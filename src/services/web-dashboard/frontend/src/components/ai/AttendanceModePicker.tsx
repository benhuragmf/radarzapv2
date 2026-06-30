import { Link } from 'react-router-dom'
import { Bot, Lock } from 'lucide-react'
import type { AttendanceMode, AiCredentialSource } from '@/lib/attendanceMode'
import {
  ATTENDANCE_MODE_CARDS,
  CREDENTIAL_SOURCE_CARDS,
} from '@/lib/attendanceMode'

interface AttendanceModePickerProps {
  selected: AttendanceMode
  onSelect: (mode: AttendanceMode) => void
}

export function AttendanceModePicker({ selected, onSelect }: AttendanceModePickerProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-[var(--rz-text-secondary)]">Modo de atendimento</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {ATTENDANCE_MODE_CARDS.map(card => {
          const isSelected = selected === card.id
          const isDisabled = card.comingSoon === true
          return (
            <button
              key={card.id}
              type="button"
              data-testid={`attendance-mode-${card.id}`}
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelect(card.id)}
              className={`relative text-left rounded-lg border p-3 transition-colors ${
                isDisabled
                  ? 'opacity-70 cursor-not-allowed border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40'
                  : isSelected
                    ? 'border-brand-500/50 bg-brand-500/10 ring-1 ring-brand-500/30'
                    : 'border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30 hover:border-[var(--rz-border-strong)] hover:bg-[var(--rz-surface-muted)]/50'
              }`}
            >
              {isDisabled && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-400">
                  <Lock className="w-3 h-3" /> Próxima etapa
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-2 pr-16">
                <span className="font-medium text-[var(--rz-text-primary)]">{card.title}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${card.badgeClass}`}
                >
                  {card.badge}
                </span>
              </div>
              <p className="text-xs text-[var(--rz-text-muted)] leading-relaxed">{card.description}</p>
              {card.example && (
                <pre className="mt-2 text-[11px] text-[var(--rz-text-secondary)] whitespace-pre-wrap font-sans bg-[var(--rz-surface)]/60 rounded-lg p-2 border border-[var(--rz-border)]/60">
                  {card.example}
                </pre>
              )}
              {card.note && (
                <p className="mt-2 text-[11px] text-[var(--rz-text-muted)] leading-relaxed">{card.note}</p>
              )}
              {card.id === 'robotic' && isSelected && (
                <p className="mt-2 text-xs">
                  <Link
                    to="/platform/inbox/bot"
                    className="inline-flex items-center gap-1 text-brand-400 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Configurar Triagem e Bot
                  </Link>
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface CredentialSourcePickerProps {
  selected: AiCredentialSource
  onSelect: (source: AiCredentialSource) => void
  disabled: boolean
  radarchatAllowed: boolean
}

export function CredentialSourcePicker({
  selected,
  onSelect,
  disabled,
  radarchatAllowed,
}: CredentialSourcePickerProps) {
  return (
    <div className="space-y-2 border-t border-[var(--rz-border)] pt-3">
      <h3 className="text-xs font-medium text-[var(--rz-text-secondary)]">Provedor da IA</h3>
      <p className="text-[11px] text-[var(--rz-text-muted)] leading-snug">
        Credencial da IA generativa — nos modos <strong>IA Premium</strong> e <strong>Híbrido</strong>.
      </p>
      <div className="grid gap-1.5">
        {CREDENTIAL_SOURCE_CARDS.map(card => {
          const isNone = card.id === 'none'
          const isRadarchatMode = card.id === 'radarchat'
          const optionDisabled =
            disabled ||
            isNone ||
            (isRadarchatMode && !radarchatAllowed)
          const isSelected = !disabled && selected === card.id
          return (
            <label
              key={card.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                optionDisabled && !isSelected
                  ? 'opacity-60 cursor-not-allowed border-[var(--rz-border)]'
                  : isSelected
                    ? 'border-brand-500/50 bg-brand-500/10'
                    : 'border-[var(--rz-border)] cursor-pointer hover:bg-[var(--rz-surface-muted)]/40'
              }`}
            >
              <input
                type="radio"
                name="credentialSource"
                className="mt-1"
                checked={isSelected}
                disabled={optionDisabled}
                onChange={() => !optionDisabled && onSelect(card.id)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--rz-text-primary)]">
                  {card.title}
                  {isRadarchatMode && !radarchatAllowed && (
                    <span className="ml-2 text-amber-500 text-xs font-normal">
                      Indisponível no plano Free
                    </span>
                  )}
                </span>
                <span className="block text-xs text-[var(--rz-text-muted)] mt-0.5">{card.description}</span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
