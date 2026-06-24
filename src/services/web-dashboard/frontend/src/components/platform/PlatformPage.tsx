import type { ReactNode } from 'react'
import { Construction } from 'lucide-react'
import { RadarPageShell, PageHeader, SectionCard } from '@/design-system'

interface Props {
  title: string
  description?: string
  phase?: string
  actions?: ReactNode
  children?: ReactNode
  /** Menos espaçamento vertical — atendimento / IA. */
  compact?: boolean
}

/** Páginas da área Plataforma (campanhas, modelos, relatórios tenant) */
export function PlatformPage({ title, description, phase = 'MVP', actions, children, compact }: Props) {
  if (children) {
    return (
      <RadarPageShell className={compact ? '!space-y-3' : undefined}>
        <PageHeader title={title} subtitle={description} actions={actions} compact={compact} />
        <div className={compact ? 'space-y-3' : 'space-y-5'}>{children}</div>
      </RadarPageShell>
    )
  }

  return (
    <RadarPageShell>
      <SectionCard>
        <div className="flex items-start gap-4 -m-1">
          <Construction size={28} className="text-brand-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--rz-text-primary)]">{title}</h2>
            {description ? (
              <p className="text-sm text-[var(--rz-text-secondary)] mt-2 leading-relaxed">{description}</p>
            ) : null}
            <p className="text-xs text-[var(--rz-text-muted)] mt-3">
              Fase planejada: <span className="text-brand-500">{phase}</span>
              {' · '}
              Ver <code className="text-[var(--rz-text-secondary)]">docs/MENUS-SISTEMA.md</code>
            </p>
          </div>
        </div>
      </SectionCard>
    </RadarPageShell>
  )
}
