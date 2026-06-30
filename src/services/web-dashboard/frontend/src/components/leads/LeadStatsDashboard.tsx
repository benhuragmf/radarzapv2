import { useState } from 'react'
import {
  ChevronDown,
  Flame,
  Inbox,
  Link2,
  MessageCircle,
  Sparkles,
  UserCheck,
  UserX,
} from 'lucide-react'
import type { LeadClassificationStats, LeadStats } from '@radarchat-types/lead-form'
import { operationalStatCards, type OperationalStatKey } from '../../lib/leadUi'
import { CONTACT_KIND_LABELS, type ContactKind } from '../../lib/contactClassificationUi'
import { cn } from '@/lib/utils'

type ClassificationStatKey = 'opt_in' | 'pending' | 'hot' | 'blocked' | 'unlinked'

type StatCard = {
  key: string
  label: string
  value: number
  icon: typeof Inbox
  accent?: 'primary' | 'success' | 'warning' | 'muted'
}

function accentCls(accent: StatCard['accent']) {
  if (accent === 'success') return 'text-emerald-500'
  if (accent === 'warning') return 'text-amber-500'
  if (accent === 'primary') return 'text-[var(--rz-primary)]'
  return 'text-[var(--rz-text-muted)]'
}

function StatButton({
  card,
  active,
  onClick,
}: {
  card: StatCard
  active: boolean
  onClick: () => void
}) {
  const Icon = card.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-w-[132px] flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
        active
          ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 shadow-sm'
          : 'border-[var(--rz-border)] bg-[var(--rz-surface)] hover:border-[var(--rz-primary)]/35 hover:bg-[var(--rz-surface-muted)]/40',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--rz-surface-muted)]',
          accentCls(card.accent),
        )}
      >
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] leading-tight text-[var(--rz-text-muted)] truncate">{card.label}</span>
        <span className="block text-xl font-semibold tabular-nums leading-tight text-[var(--rz-text-primary)]">
          {card.value}
        </span>
      </span>
    </button>
  )
}

export function LeadStatsDashboard({
  stats,
  classificationStats,
  activeOperationalKey,
  activeClassificationKey,
  onOperationalSelect,
  onClassificationSelect,
}: {
  stats: LeadStats | undefined
  classificationStats: LeadClassificationStats | undefined
  activeOperationalKey?: OperationalStatKey | null
  activeClassificationKey?: ClassificationStatKey | null
  onOperationalSelect?: (key: OperationalStatKey) => void
  onClassificationSelect?: (key: ClassificationStatKey) => void
}) {
  const [crmExpanded, setCrmExpanded] = useState(false)

  const operational = operationalStatCards(stats).map(c => {
    const icons: Record<OperationalStatKey, typeof Inbox> = {
      newOpen: Sparkles,
      whatsappWaiting: MessageCircle,
      siteWaiting: Inbox,
      inProgress: UserCheck,
      convertedToday: UserCheck,
      unassigned: UserX,
    }
    const accents: Partial<Record<OperationalStatKey, StatCard['accent']>> = {
      newOpen: 'primary',
      whatsappWaiting: 'success',
      convertedToday: 'success',
      unassigned: 'warning',
    }
    return {
      key: c.key,
      label: c.label,
      value: c.value,
      icon: icons[c.key],
      accent: accents[c.key] ?? 'muted',
    }
  })

  const classification: StatCard[] = classificationStats
    ? [
        { key: 'opt_in', label: 'CRM com opt-in', value: classificationStats.withOptIn, icon: UserCheck, accent: 'success' },
        { key: 'pending', label: 'Opt-in pendente', value: classificationStats.pendingConsent, icon: Link2, accent: 'warning' },
        { key: 'hot', label: 'Quentes/mornos', value: classificationStats.hotWarm, icon: Flame, accent: 'primary' },
        { key: 'blocked', label: 'Bloq. campanha', value: classificationStats.blockedCampaign, icon: UserX, accent: 'muted' },
        { key: 'unlinked', label: 'Sem contato CRM', value: classificationStats.unlinkedLeads, icon: Link2, accent: 'warning' },
      ]
    : []

  const topKinds = classificationStats
    ? (['lead', 'client', 'prospect'] as ContactKind[])
        .map(k => ({ kind: k, count: classificationStats.byKind[k] ?? 0 }))
        .filter(x => x.count > 0)
    : []

  if (!operational.length && !classification.length) return null

  return (
    <div className="mb-4 space-y-3">
      {operational.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
          {operational.map(c => (
            <StatButton
              key={c.key}
              card={c}
              active={activeOperationalKey === c.key}
              onClick={() => onOperationalSelect?.(c.key as OperationalStatKey)}
            />
          ))}
        </div>
      )}

      {classification.length > 0 && classificationStats && classificationStats.totalLeads > 0 && (
        <div className="rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/15 overflow-hidden">
          <button
            type="button"
            onClick={() => setCrmExpanded(v => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--rz-surface-muted)]/30 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--rz-text-secondary)]">Classificação CRM</p>
              {topKinds.length > 0 && (
                <p className="text-[10px] text-[var(--rz-text-muted)] truncate mt-0.5">
                  {topKinds.map(({ kind, count }) => `${count} ${CONTACT_KIND_LABELS[kind].toLowerCase()}`).join(' · ')}
                  {classificationStats.linkedLeads > 0 && (
                    <span> ({classificationStats.linkedLeads} de {classificationStats.totalLeads} leads)</span>
                  )}
                </p>
              )}
            </div>
            <ChevronDown
              size={16}
              className={cn('shrink-0 text-[var(--rz-text-muted)] transition-transform', crmExpanded && 'rotate-180')}
            />
          </button>
          {crmExpanded && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--rz-border)] p-2">
              {classification.map(c => (
                <StatButton
                  key={c.key}
                  card={c}
                  active={activeClassificationKey === c.key}
                  onClick={() => onClassificationSelect?.(c.key as ClassificationStatKey)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
