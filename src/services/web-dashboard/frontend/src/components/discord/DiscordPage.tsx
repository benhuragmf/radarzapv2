import { Link } from 'react-router-dom'
import { useGuild } from '../../lib/guildContext'
import { Hash, AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/design-system'

interface Props {
  description?: string
  children: ReactNode
  requireGuild?: boolean
  actions?: ReactNode
}

export function DiscordPage({ description, children, requireGuild = true, actions }: Props) {
  const { guildId, guildName } = useGuild()

  if (requireGuild && !guildId) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Selecione um servidor Discord"
        description="Use o seletor de servidor na barra lateral (aba Discord) antes de configurar a automação."
      />
    )
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {guildName && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <Hash size={16} className="text-brand-500" />
            <span>
              Servidor: <span className="text-[var(--rz-text-primary)] font-medium">{guildName}</span>
            </span>
          </div>
          {actions}
        </div>
      )}
      {description && (
        <p className="text-sm text-[var(--rz-text-secondary)] leading-relaxed">{description}</p>
      )}
      {children}
    </div>
  )
}

export function DiscordEmpty({ icon: Icon, title, hint, actionTo, actionLabel }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  hint: string
  actionTo?: string
  actionLabel?: string
}) {
  return (
    <EmptyState
      icon={Icon}
      title={title}
      description={hint}
      action={
        actionTo && actionLabel ? (
          <Link to={actionTo} className="text-sm text-[var(--rz-primary)] hover:underline">
            {actionLabel}
          </Link>
        ) : undefined
      }
    />
  )
}
