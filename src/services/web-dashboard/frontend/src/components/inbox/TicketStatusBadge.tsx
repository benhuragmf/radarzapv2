import { Badge } from '../ui/Badge'
import {
  INBOX_TICKET_DISPLAY_LABEL,
  ticketDisplayLabel,
  type InboxTicketDisplayStatus,
  type InboxTicketStatus,
} from '../../lib/inboxTicket'

const CONVERSATION_STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
  transferred: 'Transferido',
  resolved: 'Chat finalizado',
  closed: 'Chat encerrado',
}

const DISPLAY_VARIANT: Record<
  InboxTicketDisplayStatus,
  'yellow' | 'blue' | 'green' | 'gray' | 'red' | 'orange'
> = {
  open: 'yellow',
  in_progress: 'blue',
  client_replied: 'green',
  closed: 'gray',
  waiting_team: 'orange',
  waiting_client: 'blue',
  paused: 'gray',
  expired: 'gray',
}

interface TicketStatusProps {
  status: InboxTicketStatus | string
  displayStatus?: InboxTicketDisplayStatus
  teamSlaOverdue?: boolean
  size?: 'sm' | 'md'
}

/** Status do ticket (independente do chat WhatsApp) */
export function TicketStatusBadge({
  status,
  displayStatus,
  teamSlaOverdue,
  size = 'md',
}: TicketStatusProps) {
  const key = (displayStatus ?? status) as InboxTicketDisplayStatus
  const label = ticketDisplayLabel(displayStatus, String(status))
  const variant = teamSlaOverdue ? 'red' : (DISPLAY_VARIANT[key] ?? 'gray')

  if (size === 'sm') {
    const color =
      variant === 'red'
        ? 'bg-red-500/10 text-red-400 border-red-500/30'
        : variant === 'orange'
          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
          : variant === 'yellow'
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            : variant === 'blue'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              : variant === 'green'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] border-[var(--rz-border)]/60'
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${color}`}>
        {label}
        {teamSlaOverdue ? ' · SLA' : ''}
      </span>
    )
  }
  return (
    <Badge
      label={teamSlaOverdue ? `${label} · SLA` : label}
      variant={variant === 'orange' || variant === 'red' ? 'yellow' : variant}
    />
  )
}

export function ConversationStatusBadge({
  status,
  size = 'sm',
}: {
  status: string
  size?: 'sm' | 'md'
}) {
  const label = CONVERSATION_STATUS_LABEL[status] ?? status
  if (size === 'sm') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--rz-surface-muted)]/80 text-[var(--rz-text-muted)] border border-[var(--rz-border)]/50">
        {label}
      </span>
    )
  }
  return <Badge label={label} variant="gray" />
}

export { ticketIsOpen } from '../../lib/inboxTicket'
