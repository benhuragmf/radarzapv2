import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../../lib/browserNotify'

const DISMISS_KEY = 'radarzap-browser-notify-banner-dismissed'

export function BrowserNotifyPermissionBanner() {
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [requesting, setRequesting] = useState(false)

  const permission = getBrowserNotificationPermission()
  const onInbox = pathname.startsWith('/platform/inbox')

  if (!onInbox || hidden || permission !== 'default') return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setHidden(true)
  }

  const allow = async () => {
    setRequesting(true)
    try {
      await requestBrowserNotificationPermission()
      setHidden(true)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div
      role="region"
      aria-label="Permissão de notificações"
      className="mx-3 sm:mx-4 lg:mx-6 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-[var(--rz-text-secondary)]"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Bell size={16} className="shrink-0 text-amber-400" />
        <span>Ative notificações do sistema para receber alertas de fila e novas mensagens.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="secondary" onClick={() => void allow()} disabled={requesting}>
          {requesting ? 'Aguardando…' : 'Permitir'}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] hover:bg-[var(--rz-surface-muted)]"
          aria-label="Fechar aviso de notificações"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
