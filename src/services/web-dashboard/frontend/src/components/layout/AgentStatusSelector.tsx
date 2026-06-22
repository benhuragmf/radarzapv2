import { useRef, useState } from 'react'
import { Circle, ChevronDown } from 'lucide-react'
import { useAgentPresenceContext } from '../../lib/agentPresenceContext'
import { can, type AuthUser } from '../../lib/auth'
import type { AgentOperationalStatus } from '@radarzap-types/agent-presence'

const STATUS_DOT: Record<AgentOperationalStatus, string> = {
  online: 'text-emerald-500',
  ausente: 'text-amber-500',
  ocupado: 'text-orange-500',
  offline: 'text-zinc-500',
  supervisor_online: 'text-violet-500',
}

const STATUS_OPTIONS: Record<AgentOperationalStatus, string> = {
  online: 'Online — receber atendimentos',
  ausente: 'Ausente — não receber novos',
  ocupado: 'Ocupado — não receber novos',
  offline: 'Offline',
  supervisor_online: 'Online sem receber atendimento',
}

interface Props {
  user: AuthUser
}

export function AgentStatusSelector({ user }: Props) {
  const {
    presence,
    selectableStatuses,
    restorePromptOpen,
    setRestorePromptOpen,
    actionsRef,
    statusPending,
  } = useAgentPresenceContext()
  const { setOperationalStatus, restoreFromAutoAusente } = actionsRef.current
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  if (!can(user, 'inbox:reply')) return null

  const dotClass = STATUS_DOT[presence.operationalStatus] ?? STATUS_DOT.offline

  return (
    <div className="relative" ref={rootRef}>
      {restorePromptOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] p-3 shadow-lg text-sm">
          <p className="text-[var(--rz-text-primary)] mb-2">
            Você foi marcado como <strong>Ausente</strong> por inatividade. Voltar a receber atendimentos?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded hover:bg-[var(--rz-surface-muted)]"
              onClick={() => setRestorePromptOpen(false)}
            >
              Continuar ausente
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-[var(--rz-primary)] text-white"
              onClick={() => restoreFromAutoAusente()}
              disabled={statusPending}
            >
              Voltar ao status anterior
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)] max-w-[220px]"
        title={presence.statusLabel}
        aria-expanded={open}
      >
        <Circle size={10} className={`fill-current ${dotClass}`} />
        <span className="truncate hidden sm:inline">{presence.statusLabel}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fechar menu de status"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[240px] rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] py-1 shadow-lg">
            {selectableStatuses.map(status => (
              <button
                key={status}
                type="button"
                disabled={statusPending}
                onClick={() => {
                  setOperationalStatus(status, 'manual')
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--rz-surface-muted)] flex items-center gap-2 ${
                  presence.operationalStatus === status ? 'font-medium text-[var(--rz-primary)]' : ''
                }`}
              >
                <Circle size={8} className={`fill-current shrink-0 ${STATUS_DOT[status]}`} />
                <span>{STATUS_OPTIONS[status]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
