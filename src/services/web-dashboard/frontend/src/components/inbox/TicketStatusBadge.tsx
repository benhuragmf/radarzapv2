import { Badge } from '../ui/Badge'
import { INBOX_TICKET_STATUS_LABEL, type InboxTicketStatus } from '../../lib/inboxTicket'

const CONVERSATION_STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
  transferred: 'Transferido',
  resolved: 'Chat finalizado',
  closed: 'Chat encerrado',
}

const TICKET_VARIANT: Record<InboxTicketStatus, 'yellow' | 'blue' | 'green' | 'gray'> = {
  open: 'yellow',
  in_progress: 'blue',
  client_replied: 'green',
  closed: 'gray',
}

interface TicketStatusProps {
  status: InboxTicketStatus | string
  size?: 'sm' | 'md'
}

/** Status do ticket (independente do chat WhatsApp) */
export function TicketStatusBadge({ status, size = 'md' }: TicketStatusProps) {
  const key = status as InboxTicketStatus
  const label = INBOX_TICKET_STATUS_LABEL[key] ?? status
  const variant = TICKET_VARIANT[key] ?? 'gray'

  if (size === 'sm') {
    return (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
          key === 'open'
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            : key === 'in_progress'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              : key === 'client_replied'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-gray-800 text-gray-500 border-gray-700/60'
        }`}
      >
        {label}
      </span>
    )
  }
  return <Badge label={label} variant={variant} />
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
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-500 border border-gray-700/50">
        {label}
      </span>
    )
  }
  return <Badge label={label} variant="gray" />
}

export { ticketIsOpen } from '../../lib/inboxTicket'
