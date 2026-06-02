import { Link } from 'react-router-dom'
import { useGuild } from '../../lib/guildContext'
import { Card } from '../ui/Card'
import { Hash, AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

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
      <Card className="flex items-start gap-3 border-amber-800/50 bg-amber-950/20 max-w-lg">
        <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-200 font-medium">Selecione um servidor Discord</p>
          <p className="text-xs text-gray-500 mt-1">
            Use o seletor de servidor na barra lateral (aba Discord) antes de configurar a automação.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {guildName && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Hash size={16} className="text-brand-500" />
            <span>
              Servidor: <span className="text-white font-medium">{guildName}</span>
            </span>
          </div>
          {actions}
        </div>
      )}
      {description && (
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
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
    <Card className="text-center py-12 text-gray-500">
      <Icon size={32} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium text-gray-400">{title}</p>
      <p className="text-sm mt-1 max-w-md mx-auto">{hint}</p>
      {actionTo && actionLabel && (
        <Link to={actionTo} className="text-brand-400 text-sm hover:underline mt-3 inline-block">
          {actionLabel}
        </Link>
      )}
    </Card>
  )
}
