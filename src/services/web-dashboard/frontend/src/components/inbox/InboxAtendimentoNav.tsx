import { Link, useLocation } from 'react-router-dom'
import {
  MessageSquare,
  Ticket,
  Building2,
  Bot,
  Zap,
  Eye,
  BarChart3,
  Sparkles,
  Globe,
} from 'lucide-react'
import { can, type AuthUser } from '../../lib/auth'

const LINKS = [
  { to: '/platform/inbox', label: 'Inbox', icon: MessageSquare, cap: 'inbox:view' },
  { to: '/platform/inbox/tickets', label: 'Tickets', icon: Ticket, cap: 'inbox:view' },
  { to: '/platform/inbox/setores', label: 'Setores', icon: Building2, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/bot', label: 'Bot', icon: Bot, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/ia', label: 'IA', icon: Sparkles, cap: 'inbox:ai:manage' },
  { to: '/platform/inbox/respostas', label: 'Respostas', icon: Zap, cap: 'inbox:department:manage' },
  { to: '/platform/inbox/supervisor', label: 'Supervisor', icon: Eye, cap: 'inbox:supervise' },
  { to: '/platform/inbox/relatorios', label: 'Relatórios', icon: BarChart3, cap: 'inbox:reports:view' },
  { to: '/platform/webchat', label: 'Chat do site', icon: Globe, cap: 'webchat:view' },
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
      className={`flex flex-wrap gap-1.5 p-1 rounded-xl bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)]/80 ${className}`}
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
                : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] border border-transparent hover:bg-[var(--rz-surface-muted)]'
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
