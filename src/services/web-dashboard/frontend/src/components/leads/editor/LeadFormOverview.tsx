import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SectionStatus } from '@/lib/leadFormEditorUtils'
import {
  LEAD_FORM_EDITOR_SECTIONS,
  type LeadFormEditorSectionId,
} from './LeadFormEditorSection'

type Props = {
  statuses: Record<LeadFormEditorSectionId, SectionStatus>
  onNavigate: (section: LeadFormEditorSectionId) => void
}

const QUICK_START: LeadFormEditorSectionId[] = ['overview', 'fields', 'appearance', 'instalacao']

export function LeadFormOverview({ statuses, onNavigate }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
        <h4 className="text-sm font-semibold text-[var(--rz-text-primary)]">Por onde começar?</h4>
        <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
          Configure nesta ordem: domínios permitidos → campos → aparência → instale o script no site.
          Destino e LGPD podem vir depois.
        </p>
        <ol className="mt-3 space-y-2">
          {QUICK_START.map((id, index) => {
            const section = LEAD_FORM_EDITOR_SECTIONS.find(s => s.id === id)!
            const status = statuses[id]
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--rz-border)]/80 bg-[var(--rz-surface)]/50 px-3 py-2.5 text-left transition-colors hover:border-brand-500/30 hover:bg-brand-500/5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rz-surface-muted)] text-[11px] font-bold text-[var(--rz-text-muted)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--rz-text-primary)]">{section.label}</p>
                    <p className="text-[10px] text-[var(--rz-text-muted)]">{status.hint}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--rz-text-muted)]" />
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
          Status das seções
        </h4>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {LEAD_FORM_EDITOR_SECTIONS.filter(s => s.id !== 'overview').map(section => {
            const status = statuses[section.id]
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(section.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--rz-surface-muted)]/50"
                >
                  <span className="text-xs text-[var(--rz-text-secondary)]">{section.label}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium',
                      status.kind === 'complete' && 'border-emerald-500/25 text-emerald-400',
                      status.kind === 'incomplete' && 'border-amber-500/25 text-amber-400',
                      status.kind === 'optional' && 'border-[var(--rz-border)] text-[var(--rz-text-muted)]',
                      status.kind === 'attention' && 'border-violet-500/25 text-violet-300',
                    )}
                  >
                    {status.hint}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
