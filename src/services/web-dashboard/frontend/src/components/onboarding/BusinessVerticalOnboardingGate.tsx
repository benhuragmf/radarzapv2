import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Sparkles } from 'lucide-react'
import { api } from '../../lib/api'
import { can, type AuthUser } from '../../lib/auth'
import { BusinessVerticalPicker } from './BusinessVerticalPicker'
import { Button } from '../ui/Button'

const DISMISS_KEY = 'radarchat-onboarding-vertical-dismissed'

interface Props {
  user: AuthUser
}

export function BusinessVerticalOnboardingGate({ user }: Props) {
  const [open, setOpen] = useState(false)
  const canManage = can(user, 'billing:manage') || can(user, 'account:settings')

  const { data: status } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () =>
      api.get<{ needsOnboarding: boolean; businessVertical: string | null }>('/onboarding/status'),
    enabled: canManage,
  })

  useEffect(() => {
    if (!canManage || !status?.needsOnboarding) return
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* ignore */
    }
    setOpen(true)
  }, [canManage, status?.needsOnboarding])

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  const handleApplied = () => {
    setOpen(false)
  }

  if (!open || !canManage) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65">
      <div
        role="dialog"
        aria-labelledby="onboarding-vertical-title"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--rz-border)] bg-[var(--rz-surface)]/95 backdrop-blur px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-[var(--rz-primary)] mb-1">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Configuração rápida</span>
            </div>
            <h2 id="onboarding-vertical-title" className="text-lg font-semibold text-[var(--rz-text-primary)]">
              Qual é o seu tipo de negócio?
            </h2>
            <p className="text-sm text-[var(--rz-text-muted)] mt-1">
              Escolha um segmento e deixamos setores, bot, chat, FAQ, skills e memórias de IA prontos — mesmo no plano free.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-2 text-[var(--rz-text-muted)] hover:bg-[var(--rz-surface-muted)] hover:text-[var(--rz-text-primary)]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <BusinessVerticalPicker onApplied={handleApplied} />
        </div>

        <div className="sticky bottom-0 border-t border-[var(--rz-border)] bg-[var(--rz-surface)] px-6 py-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Configurar depois
          </Button>
        </div>
      </div>
    </div>
  )
}
