import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '../ui/Button'

const DISMISS_KEY = 'radarzap-pwa-install-dismissed-at'
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => isStandaloneDisplay() || wasDismissedRecently())
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (hidden || isStandaloneDisplay()) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [hidden])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setHidden(true)
    setDeferred(null)
  }

  const install = async () => {
    if (!deferred) return
    setInstalling(true)
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setHidden(true)
      }
    } finally {
      setInstalling(false)
      setDeferred(null)
    }
  }

  if (hidden || !deferred) return null

  return (
    <div
      role="region"
      aria-label="Instalar aplicativo"
      className="mx-3 sm:mx-4 lg:mx-6 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-[var(--rz-text-secondary)]"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Download size={16} className="shrink-0 text-brand-400" />
        <span>
          Instale o <strong className="font-medium text-[var(--rz-text-primary)]">Radar Chat</strong> na área de
          trabalho para abrir o Inbox como app.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={() => void install()} disabled={installing}>
          {installing ? 'Instalando…' : 'Instalar app'}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] hover:bg-[var(--rz-surface-muted)]"
          aria-label="Fechar aviso de instalação"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
