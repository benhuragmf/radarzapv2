import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useEventNotifications } from '../../context/EventNotificationContext'
import { PanelNotificationRow } from './PanelNotificationRow'

export default function EventNotificationBell() {
  const { events, unreadCount, urgentUnreadCount, markAllRead, markRead } =
    useEventNotifications()
  const [open, setOpen] = useState(false)
  const badgeIsUrgent = urgentUnreadCount > 0
  const preview = events.slice(0, 8)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(v => !v)
          if (!open && unreadCount > 0) markAllRead()
        }}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
          badgeIsUrgent
            ? 'border-red-500/50 hover:bg-red-950/30 text-red-300'
            : 'border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)]'
        }`}
        title={unreadCount > 0 ? `Eventos: ${unreadCount} não lidos` : 'Eventos'}
        aria-label={unreadCount > 0 ? `Eventos: ${unreadCount} não lidos` : 'Eventos'}
        aria-expanded={open}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${
              badgeIsUrgent ? 'bg-red-600 ring-2 ring-red-400/60' : 'bg-amber-500 text-[var(--rz-on-accent)]'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] cursor-default bg-black/40 sm:bg-transparent"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-3 right-3 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-[60] max-h-[min(24rem,calc(100dvh-4.5rem-env(safe-area-inset-bottom,0px)))] overflow-y-auto bg-[var(--rz-surface)] border border-[var(--rz-border)] rounded-xl shadow-xl sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80 sm:max-h-96">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--rz-border)]">
              <span className="text-xs font-semibold text-[var(--rz-text-muted)] uppercase tracking-wider">
                Eventos
              </span>
              {events.length > 0 && (
                <Link
                  to="/dashboard/notificacoes"
                  onClick={() => setOpen(false)}
                  className="text-[10px] text-[var(--rz-primary)] hover:underline"
                >
                  Ver todas
                </Link>
              )}
            </div>
            {events.length === 0 ? (
              <p className="text-xs text-[var(--rz-text-muted)] p-4 text-center">Nenhum evento recente.</p>
            ) : (
              <>
                {preview.map(ev => (
                  <PanelNotificationRow
                    key={ev.id}
                    ev={ev}
                    compact
                    onNavigate={() => {
                      markRead(ev.id)
                      setOpen(false)
                    }}
                  />
                ))}
                {events.length > preview.length && (
                  <Link
                    to="/dashboard/notificacoes"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 text-center text-xs text-[var(--rz-primary)] hover:bg-[var(--rz-surface-muted)]"
                  >
                    Ver todas ({events.length})
                  </Link>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
