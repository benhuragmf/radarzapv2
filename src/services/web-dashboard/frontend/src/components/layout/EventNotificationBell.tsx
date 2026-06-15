import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useEventNotifications } from '../../context/EventNotificationContext'

const TYPE_LABEL: Record<string, string> = {
  'inbox:new_chat': 'Novo chat',
  'inbox:new_message': 'Mensagem',
  'inbox:priority': 'Prioridade',
  'whatsapp:disconnected': 'WhatsApp',
  'whatsapp:connected': 'WhatsApp',
}

export default function EventNotificationBell() {
  const { events, unreadCount, markAllRead, markRead, clearAll } = useEventNotifications()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(v => !v)
          if (!open && unreadCount > 0) markAllRead()
        }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)] transition-colors"
        title="Eventos"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-gray-950 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-80 max-h-96 overflow-y-auto bg-[var(--rz-surface)] border border-[var(--rz-border)] rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--rz-border)]">
              <span className="text-xs font-semibold text-[var(--rz-text-muted)] uppercase tracking-wider">
                Eventos
              </span>
              {events.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]"
                >
                  Limpar
                </button>
              )}
            </div>
            {events.length === 0 ? (
              <p className="text-xs text-[var(--rz-text-muted)] p-4 text-center">Nenhum evento recente.</p>
            ) : (
              events.map(ev => (
                <Link
                  key={ev.id}
                  to={ev.href ?? '/platform/inbox'}
                  onClick={() => {
                    markRead(ev.id)
                    setOpen(false)
                  }}
                  className={`block px-3 py-2.5 border-b border-[var(--rz-border)]/80 hover:bg-[var(--rz-surface-muted)] ${
                    !ev.read ? 'bg-amber-950/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-medium text-[var(--rz-text-primary)]">{ev.title}</span>
                    <span className="text-[10px] text-[var(--rz-text-muted)] shrink-0">
                      {TYPE_LABEL[ev.type] ?? ev.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{ev.body}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {new Date(ev.createdAt).toLocaleString('pt-BR')}
                  </p>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
