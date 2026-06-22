import { Link } from 'react-router-dom'
import type { PanelEvent } from '../../context/EventNotificationContext'
import { PANEL_EVENT_TYPE_LABEL } from '../../lib/panelEventLabels'

export function PanelNotificationRow({
  ev,
  onNavigate,
  compact = false,
}: {
  ev: PanelEvent
  onNavigate?: () => void
  compact?: boolean
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span
          className={`text-xs font-medium ${
            ev.urgent ? 'text-red-300' : 'text-[var(--rz-text-primary)]'
          }`}
        >
          {ev.title}
        </span>
        <span className="text-[10px] text-[var(--rz-text-muted)] shrink-0">
          {PANEL_EVENT_TYPE_LABEL[ev.type] ?? ev.type}
        </span>
      </div>
      <p className={`text-xs text-[var(--rz-text-muted)] ${compact ? 'line-clamp-2' : ''}`}>
        {ev.body}
      </p>
      <p className="text-[10px] text-[var(--rz-text-muted)] mt-0.5">
        {new Date(ev.createdAt).toLocaleString('pt-BR')}
      </p>
    </>
  )

  const className = `block px-3 py-2.5 border-b border-[var(--rz-border)]/80 hover:bg-[var(--rz-surface-muted)] ${
    !ev.read
      ? ev.urgent
        ? 'bg-red-950/35 border-l-2 border-l-red-500'
        : 'bg-amber-950/20'
      : ''
  }`

  if (ev.href) {
    return (
      <Link to={ev.href} onClick={onNavigate} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <Link to="/dashboard/notificacoes" onClick={onNavigate} className={className}>
      {content}
    </Link>
  )
}
