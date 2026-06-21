import { Link } from 'react-router-dom'
import { MessageSquare, Clock, Bot, Star, Globe, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface QuickCard {
  label: string
  value: number | string
  description: string
  href: string
  icon: LucideIcon
  colorClass: string
}

interface Props {
  queueCount: number
  triageCount: number
  priorityCount: number
  webchatQueueCount: number
  waConnected: boolean
  /** Oculta cards duplicados quando InboxStatsRow já está visível acima */
  compact?: boolean
}

export function InboxEmptyChat({
  queueCount,
  triageCount,
  priorityCount,
  webchatQueueCount,
  waConnected,
  compact = false,
}: Props) {
  const cards: QuickCard[] = [
    {
      label: 'Na fila',
      value: queueCount,
      description: 'Aguardando atendente',
      href: '/platform/inbox?status=waiting_queue',
      icon: Clock,
      colorClass: 'text-blue-400',
    },
    {
      label: 'Em triagem',
      value: triageCount,
      description: 'Bot automático',
      href: '/platform/inbox?status=bot_triage',
      icon: Bot,
      colorClass: 'text-yellow-400',
    },
    {
      label: 'Suas prioridades',
      value: priorityCount,
      description: 'Round-robin para você',
      href: '/platform/inbox?status=waiting_queue',
      icon: Star,
      colorClass: 'text-amber-400',
    },
    {
      label: 'Chat do site',
      value: webchatQueueCount,
      description: 'Visitantes aguardando',
      href: '/platform/inbox?status=waiting_queue&channel=webchat',
      icon: Globe,
      colorClass: 'text-violet-400',
    },
    {
      label: 'WhatsApp',
      value: waConnected ? 'Conectado' : 'Offline',
      description: waConnected ? 'Pronto para receber' : 'Verifique a sessão',
      href: '/sessions',
      icon: Smartphone,
      colorClass: waConnected ? 'text-emerald-400' : 'text-red-400',
    },
  ]

  return (
    <div className="hidden lg:flex flex-col items-center justify-center flex-1 min-h-[240px] p-6 overflow-y-auto">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/10 border border-[var(--rz-border)]/60 flex items-center justify-center mb-4 shrink-0">
        <MessageSquare size={32} className="text-brand-400/70" />
      </div>
      <p className="text-base font-medium text-[var(--rz-text-secondary)]">Selecione uma conversa</p>
      <p className="text-sm text-[var(--rz-text-muted)] mt-1 text-center max-w-md">
        Escolha um atendimento na lista para visualizar o histórico, responder e gerenciar o contato.
      </p>

      {!compact && (
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mt-8 w-full max-w-2xl">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              to={card.href}
              className="rounded-xl border border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/30 px-4 py-3 hover:bg-[var(--rz-surface-muted)]/50 hover:border-brand-500/20 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={card.colorClass} />
                <span className="text-[11px] uppercase tracking-wider text-[var(--rz-text-muted)]">
                  {card.label}
                </span>
              </div>
              <p className={`text-lg font-semibold ${card.colorClass}`}>{card.value}</p>
              <p className="text-[11px] text-[var(--rz-text-muted)] mt-0.5">{card.description}</p>
            </Link>
          )
        })}
      </div>
      )}
    </div>
  )
}
