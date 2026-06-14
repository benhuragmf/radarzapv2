import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { registerNotifyHandlers } from '../lib/notify'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  push: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-brand-600/40 bg-brand-950/90 text-brand-100',
  error: 'border-red-600/40 bg-red-950/90 text-red-100',
  info: 'border-blue-600/40 bg-blue-950/90 text-blue-100',
}

const KIND_ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const text = message.trim()
    if (!text) return
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setItems(prev => [...prev.slice(-4), { id, message: text, kind }])
    window.setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, 5200)
  }, [])

  useEffect(() => {
    registerNotifyHandlers({
      success: msg => push(msg, 'success'),
      error: msg => push(msg, 'error'),
      info: msg => push(msg, 'info'),
    })
    return () => registerNotifyHandlers(null)
  }, [push])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[min(100vw-2rem,24rem)] pointer-events-none"
        aria-live="polite"
      >
        {items.map(t => {
          const Icon = KIND_ICON[t.kind]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg text-sm ${KIND_STYLES[t.kind]}`}
              role="status"
            >
              <Icon size={16} className="shrink-0 mt-0.5" />
              <p className="flex-1 leading-snug">{t.message}</p>
              <button
                type="button"
                className="shrink-0 opacity-70 hover:opacity-100"
                aria-label="Fechar"
                onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
