import type { ReactNode } from 'react'
import {
  Code2,
  LayoutDashboard,
  ListChecks,
  Palette,
  Route,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SectionStatus, SectionStatusKind, LeadFormEditorSectionId } from '@/lib/leadFormEditorUtils'

export type { LeadFormEditorSectionId }

export const LEAD_FORM_EDITOR_SECTIONS: Array<{
  id: LeadFormEditorSectionId
  label: string
  description: string
  icon: LucideIcon
}> = [
  {
    id: 'overview',
    label: 'Visão geral',
    description: 'Domínios e identificação',
    icon: LayoutDashboard,
  },
  {
    id: 'fields',
    label: 'Campos',
    description: 'Perguntas do formulário',
    icon: ListChecks,
  },
  {
    id: 'appearance',
    label: 'Aparência',
    description: 'Tema, tamanho e estilo',
    icon: Palette,
  },
  {
    id: 'dest',
    label: 'Destino do lead',
    description: 'Listas, tags e responsável',
    icon: Route,
  },
  {
    id: 'security',
    label: 'Segurança / LGPD',
    description: 'Anti-spam e consentimento',
    icon: Shield,
  },
  {
    id: 'instalacao',
    label: 'Integrar no site',
    description: 'Script e códigos',
    icon: Code2,
  },
]

const STATUS_STYLES: Record<SectionStatusKind, string> = {
  complete: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  incomplete: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  optional: 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] border-[var(--rz-border)]',
  attention: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
}

function StatusDot({ kind }: { kind: SectionStatusKind }) {
  return (
    <span
      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', {
        'bg-emerald-400': kind === 'complete',
        'bg-amber-400': kind === 'incomplete',
        'bg-[var(--rz-text-muted)]': kind === 'optional',
        'bg-violet-400': kind === 'attention',
      })}
      aria-hidden
    />
  )
}

export function LeadFormEditorSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-28 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)]/40',
        className,
      )}
    >
      <div className="border-b border-[var(--rz-border)]/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--rz-text-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function LeadFormSectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/15',
        className,
      )}
    >
      <div className="border-b border-[var(--rz-border)]/60 px-4 py-2.5">
        <h4 className="text-xs font-semibold text-[var(--rz-text-primary)]">{title}</h4>
        {description ? (
          <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--rz-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  )
}

export function LeadFormSectionNav({
  active,
  onChange,
  statuses,
  className,
}: {
  active: LeadFormEditorSectionId
  onChange: (id: LeadFormEditorSectionId) => void
  statuses: Record<LeadFormEditorSectionId, SectionStatus>
  className?: string
}) {
  return (
    <nav className={cn('space-y-1', className)} aria-label="Seções do formulário">
      {LEAD_FORM_EDITOR_SECTIONS.map(section => {
        const Icon = section.icon
        const status = statuses[section.id]
        const isActive = active === section.id
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            className={cn(
              'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
              isActive
                ? 'border-brand-500/35 bg-brand-500/10'
                : 'border-transparent hover:border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]/50',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                isActive ? 'text-brand-300' : 'text-[var(--rz-text-muted)]',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-xs font-medium',
                    isActive ? 'text-brand-200' : 'text-[var(--rz-text-secondary)]',
                  )}
                >
                  {section.label}
                </span>
                <StatusDot kind={status.kind} />
              </div>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--rz-text-muted)]">
                {section.description}
              </p>
              <span
                className={cn(
                  'mt-1.5 inline-flex max-w-full truncate rounded-full border px-1.5 py-0.5 text-[9px] font-medium',
                  STATUS_STYLES[status.kind],
                )}
              >
                {status.hint}
              </span>
            </div>
          </button>
        )
      })}
    </nav>
  )
}

export function LeadFormSectionNavCompact({
  active,
  onChange,
}: {
  active: LeadFormEditorSectionId
  onChange: (id: LeadFormEditorSectionId) => void
}) {
  return (
    <nav
      className="mb-4 flex gap-0.5 overflow-x-auto border-b border-[var(--rz-border)] pb-px scrollbar-thin xl:hidden"
      aria-label="Seções do formulário"
    >
      {LEAD_FORM_EDITOR_SECTIONS.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            'shrink-0 border-b-2 px-2.5 py-2 text-[11px] font-medium transition-colors',
            active === s.id
              ? 'border-brand-400 text-brand-300'
              : 'border-transparent text-[var(--rz-text-muted)]',
          )}
        >
          {s.label}
        </button>
      ))}
    </nav>
  )
}
