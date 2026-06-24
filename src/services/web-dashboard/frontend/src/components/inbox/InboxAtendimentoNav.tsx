import { Link, useLocation } from 'react-router-dom'
import {
  Inbox,
  Ticket,
  Building2,
  Bot,
  MessageSquareText,
  Eye,
  BarChart3,
  Sparkles,
  PanelTop,
} from 'lucide-react'
import { can, type AuthUser } from '../../lib/auth'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/platform/inbox', label: 'Caixa de Entrada', icon: Inbox, cap: 'inbox:view' },
  { to: '/platform/inbox/tickets', label: 'Chamados', icon: Ticket, cap: 'inbox:view' },
  { to: '/platform/inbox/setores', label: 'Setores', icon: Building2, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/bot', label: 'Triagem e Bot', icon: Bot, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/ia', label: 'IA', icon: Sparkles, cap: 'inbox:ai:manage' },
  { to: '/platform/inbox/respostas', label: 'Respostas', icon: MessageSquareText, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/supervisor', label: 'Supervisão', icon: Eye, cap: 'inbox:supervise' },
  { to: '/platform/inbox/relatorios', label: 'Métricas', icon: BarChart3, cap: 'inbox:reports:view' },
  { to: '/platform/webchat', label: 'Chat do Site', icon: PanelTop, cap: 'webchat:view' },
] as const

interface Props {
  me: AuthUser | null | undefined
  className?: string
  compact?: boolean
}

export function InboxAtendimentoNav({ me, className = '', compact = true }: Props) {
  const { pathname } = useLocation()
  const visible = LINKS.filter(l => can(me ?? null, l.cap))

  if (visible.length <= 1) return null

  return (
    <nav
      className={cn(
        'bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)]/80 overflow-hidden',
        compact ? 'rounded-lg' : 'rounded-xl',
        className,
      )}
      aria-label="Navegação do módulo de atendimento"
    >
      <div className={cn('flex gap-0.5 overflow-x-auto scrollbar-thin', compact ? 'p-0.5' : 'gap-1 p-1')}>
        {visible.map(({ to, label, icon: Icon }) => {
          const active =
            to === '/platform/inbox'
              ? pathname === '/platform/inbox'
              : pathname === to || pathname.startsWith(`${to}/`)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'inline-flex items-center rounded-md font-medium transition-colors shrink-0 whitespace-nowrap border',
                compact ? 'gap-1 px-2 py-1 text-[11px]' : 'gap-1.5 px-3 py-1.5 rounded-lg text-xs',
                active
                  ? 'bg-brand-500/15 text-brand-400 border-brand-500/30 shadow-sm shadow-brand-500/10'
                  : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] border-transparent hover:bg-[var(--rz-surface-muted)]',
              )}
            >
              <Icon size={compact ? 12 : 14} aria-hidden />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
