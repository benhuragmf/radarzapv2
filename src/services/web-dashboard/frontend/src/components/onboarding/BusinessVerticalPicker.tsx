import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Store,
  ShoppingCart,
  UtensilsCrossed,
  Stethoscope,
  Briefcase,
  Building2,
  Scissors,
  Car,
  GraduationCap,
  Wrench,
  LayoutGrid,
  Check,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { cn } from '@/lib/utils'
import { notifySuccess, mutationError } from '../../lib/notify'

export interface BusinessVerticalOption {
  id: string
  label: string
  description: string
  icon: string
  suggestedAttendanceMode?: string
}

const VERTICAL_ICONS: Record<string, LucideIcon> = {
  Store,
  ShoppingCart,
  UtensilsCrossed,
  Stethoscope,
  Briefcase,
  Building2,
  Scissors,
  Car,
  GraduationCap,
  Wrench,
  LayoutGrid,
}

interface Props {
  onApplied?: () => void
  overwrite?: boolean
  compact?: boolean
  showCurrent?: boolean
}

export function BusinessVerticalPicker({ onApplied, overwrite = false, compact = false, showCurrent = false }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)

  const { data: verticals = [], isLoading: loadingList } = useQuery<BusinessVerticalOption[]>({
    queryKey: ['onboarding-verticals'],
    queryFn: () => api.get('/onboarding/verticals'),
  })

  const { data: status } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () =>
      api.get<{ businessVertical: string | null; needsOnboarding: boolean }>('/onboarding/status'),
  })

  const apply = useMutation({
    mutationFn: (verticalId: string) =>
      api.post<{ sections?: Record<string, string> }>('/onboarding/apply-vertical', { verticalId, overwrite }),
    onSuccess: (data: { sections?: Record<string, string> }) => {
      qc.invalidateQueries({ queryKey: ['onboarding-status'] })
      qc.invalidateQueries({ queryKey: ['organization-profile'] })
      qc.invalidateQueries({ queryKey: ['inbox-departments'] })
      qc.invalidateQueries({ queryKey: ['inbox-settings'] })
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      qc.invalidateQueries({ queryKey: ['ai-settings'] })
      const s = data?.sections
      const aiParts: string[] = []
      if (s?.aiSettings === 'updated') aiParts.push('modo IA')
      if (s?.aiPrompt === 'updated') aiParts.push('prompt/regras')
      if (s?.knowledgeBase === 'seeded') aiParts.push('base de conhecimento')
      if (s?.aiSkills === 'seeded') aiParts.push('skills')
      if (s?.aiMemories === 'seeded') aiParts.push('memórias')
      const aiHint = aiParts.length ? ` IA: ${aiParts.join(', ')}.` : ''
      notifySuccess(`Configuração aplicada! Setores, bot e chat ajustados.${aiHint}`)
      onApplied?.()
    },
    onError: mutationError,
  })

  const currentId = status?.businessVertical ?? null
  const gridCols = compact
    ? 'grid-cols-1 sm:grid-cols-2'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  if (loadingList) {
    return (
      <p className="text-sm text-[var(--rz-text-muted)] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando tipos de negócio…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {showCurrent && currentId && (
        <p className="text-sm text-[var(--rz-text-secondary)]">
          Tipo atual:{' '}
          <strong>{verticals.find(v => v.id === currentId)?.label ?? currentId}</strong>
        </p>
      )}

      <div className={cn('grid gap-3', gridCols)}>
        {verticals.map(v => {
          const Icon = VERTICAL_ICONS[v.icon] ?? LayoutGrid
          const isSelected = selected === v.id
          const isCurrent = currentId === v.id && !overwrite
          return (
            <button
              key={v.id}
              type="button"
              disabled={apply.isPending || (isCurrent && !overwrite)}
              onClick={() => setSelected(v.id)}
              className={cn(
                'text-left rounded-xl border p-4 transition-all',
                'hover:border-[var(--rz-primary)]/50 hover:bg-[var(--rz-surface-muted)]/50',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                isSelected
                  ? 'border-[var(--rz-primary)] ring-2 ring-[var(--rz-primary)]/30 bg-[var(--rz-primary)]/5'
                  : 'border-[var(--rz-border)] bg-[var(--rz-surface)]',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--rz-primary)]/10 text-[var(--rz-primary)]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--rz-text-primary)]">{v.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--rz-primary)] font-semibold">
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--rz-text-muted)] mt-1 line-clamp-2">{v.description}</p>
                </div>
                {isSelected && <Check className="h-4 w-4 text-[var(--rz-primary)] shrink-0 mt-1" />}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!selected || apply.isPending}
          onClick={() => selected && apply.mutate(selected)}
        >
          {apply.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Aplicando…
            </>
          ) : overwrite ? (
            'Substituir configuração'
          ) : (
            'Aplicar pré-configuração'
          )}
        </Button>
        {!overwrite && (
          <p className="text-xs text-[var(--rz-text-muted)] max-w-md">
            Ajusta setores, textos do bot, horários, chat do site, FAQ, skills, memórias e respostas rápidas.
            Mesmo no plano free os dados ficam salvos — a IA só responde após upgrade. Personalize depois no painel.
          </p>
        )}
      </div>
    </div>
  )
}
