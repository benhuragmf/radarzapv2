import { Link, useLocation } from 'react-router-dom'
import {
  MessageSquare,
  Ticket,
  Building2,
  Bot,
  Zap,
  Eye,
  BarChart3,
} from 'lucide-react'
import { can, type AuthUser } from '../../lib/auth'

const LINKS = [
  { to: '/platform/inbox', label: 'Inbox', icon: MessageSquare, cap: 'inbox:view' },
  { to: '/platform/inbox/tickets', label: 'Tickets', icon: Ticket, cap: 'inbox:view' },
  { to: '/platform/inbox/setores', label: 'Setores', icon: Building2, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/bot', label: 'Bot', icon: Bot, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/respostas', label: 'Respostas', icon: Zap, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/supervisor', label: 'Supervisor', icon: Eye, cap: 'inbox:supervise' },
  { to: '/platform/inbox/relatorios', label: 'Relatórios', icon: BarChart3, cap: 'inbox:reports:view' },
] as const

interface Props {
  me: AuthUser | null | undefined
  className?: string
}

export function InboxAtendimentoNav({ me, className = '' }: Props) {
  const { pathname } = useLocation()
  const visible = LINKS.filter(l => can(me ?? null, l.cap))

  if (visible.length <= 1) return null

  return (
    <nav
      className={`flex flex-wrap gap-1.5 p-1 rounded-xl bg-gray-900/60 border border-gray-800/80 ${className}`}
      aria-label="Atendimento WhatsApp"
    >
      {visible.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || (to !== '/platform/inbox' && pathname.startsWith(to))
        return (
          <Link
            key={to}
            to={to}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              active
                ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent hover:bg-gray-800/50'
            }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
