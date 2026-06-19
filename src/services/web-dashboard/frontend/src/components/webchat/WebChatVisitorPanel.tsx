import { Link } from 'react-router-dom'
import {
  Globe,
  Inbox as InboxIcon,
  Copy,
  Monitor,
  Mail,
  Phone,
  ExternalLink,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { inboxWebChatUrl } from '../../lib/webchatInbox'
import { notifySuccess } from '../../lib/notify'
import { cn } from '@/lib/utils'

export interface WebChatVisitorInfo {
  id: string
  status: 'open' | 'closed'
  visitorName?: string
  visitorEmail?: string
  visitorPhone?: string
  contactReason?: string
  visitorIntake?: Record<string, string>
  pageUrl?: string
  pageTitle?: string
  userAgent?: string
  createdAt?: string
  lastMessageAt?: string
  widgetName?: string
  queueStatus?: 'bot' | 'waiting_human' | 'with_agent'
  departmentName?: string
  assignedUserName?: string
}

interface Props {
  visitor: WebChatVisitorInfo
  canInbox: boolean
  messageCount?: number
  className?: string
}

function queueLabel(status?: WebChatVisitorInfo['queueStatus']) {
  if (status === 'waiting_human') return 'Na fila'
  if (status === 'with_agent') return 'Com atendente'
  if (status === 'bot') return 'Bot/IA'
  return null
}

function formatDuration(start?: string, end?: string) {
  if (!start) return '—'
  const a = new Date(start).getTime()
  const b = end ? new Date(end).getTime() : Date.now()
  const min = Math.max(0, Math.floor((b - a) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}min`
}

function parseUserAgent(ua?: string): { browser: string; os: string; device: string } {
  if (!ua) return { browser: 'Não informado', os: 'Não informado', device: 'Não informado' }
  const lower = ua.toLowerCase()
  let browser = 'Desconhecido'
  if (lower.includes('edg/')) browser = 'Edge'
  else if (lower.includes('chrome/')) browser = 'Chrome'
  else if (lower.includes('firefox/')) browser = 'Firefox'
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari'

  let os = 'Desconhecido'
  if (lower.includes('windows')) os = 'Windows'
  else if (lower.includes('mac os')) os = 'macOS'
  else if (lower.includes('android')) os = 'Android'
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS'
  else if (lower.includes('linux')) os = 'Linux'

  const device =
    lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')
      ? 'Mobile'
      : lower.includes('tablet') || lower.includes('ipad')
        ? 'Tablet'
        : 'Desktop'

  return { browser, os, device }
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-[var(--rz-text-muted)] shrink-0">{label}</span>
      <span className="text-[var(--rz-text-secondary)] text-right truncate">{value}</span>
    </div>
  )
}

export function WebChatVisitorPanel({ visitor, canInbox, messageCount, className }: Props) {
  const name = visitor.visitorName || visitor.visitorEmail || 'Visitante'
  const initial = name.charAt(0).toUpperCase()
  const qLabel = queueLabel(visitor.queueStatus)
  const session = parseUserAgent(visitor.userAgent)
  const isOpen = visitor.status === 'open'

  const copyLink = async () => {
    const url = `${window.location.origin}${inboxWebChatUrl(visitor.id)}`
    await navigator.clipboard.writeText(url)
    notifySuccess('Link copiado')
  }

  return (
    <aside
      className={cn(
        'w-full xl:w-[300px] shrink-0 flex flex-col border-t xl:border-t-0 xl:border-l border-[var(--rz-border)]/80 bg-[var(--rz-surface)]/40 overflow-y-auto',
        className,
      )}
    >
      <div className="p-4 border-b border-[var(--rz-border)]/80">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500/20 to-brand-500/10 border border-[var(--rz-border)] flex items-center justify-center font-semibold text-violet-300 shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[var(--rz-text-primary)] truncate">{name}</p>
            {visitor.visitorEmail && (
              <p className="text-xs text-[var(--rz-text-muted)] truncate flex items-center gap-1 mt-0.5">
                <Mail size={10} /> {visitor.visitorEmail}
              </p>
            )}
            {visitor.visitorPhone && (
              <p className="text-xs text-[var(--rz-text-muted)] truncate flex items-center gap-1 mt-0.5">
                <Phone size={10} /> {visitor.visitorPhone}
              </p>
            )}
            <span
              className={cn(
                'inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded',
                isOpen ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]',
              )}
            >
              {isOpen ? 'Aberta' : 'Encerrada'}
              {qLabel ? ` · ${qLabel}` : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-[var(--rz-border)]/80 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
          Informações do visitante
        </h3>
        <DetailRow label="Widget" value={visitor.widgetName} />
        <DetailRow label="Motivo" value={visitor.contactReason || visitor.visitorIntake?.contact_reason} />
        <DetailRow label="WhatsApp" value={visitor.visitorPhone || visitor.visitorIntake?.phone} />
        {visitor.visitorIntake &&
          Object.entries(visitor.visitorIntake)
            .filter(([key]) => !['name', 'email', 'phone', 'contact_reason'].includes(key))
            .map(([key, val]) => (
              <DetailRow
                key={key}
                label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                value={val}
              />
            ))}
        <DetailRow label="Setor" value={visitor.departmentName} />
        <DetailRow label="Atendente" value={visitor.assignedUserName} />
        <DetailRow
          label="Início"
          value={visitor.createdAt ? new Date(visitor.createdAt).toLocaleString('pt-BR') : undefined}
        />
        <DetailRow label="Duração" value={formatDuration(visitor.createdAt, visitor.lastMessageAt)} />
        <DetailRow label="Mensagens" value={messageCount != null ? String(messageCount) : undefined} />
        {visitor.pageUrl && (
          <div className="flex justify-between gap-2 text-xs pt-1">
            <span className="text-[var(--rz-text-muted)] shrink-0">Página</span>
            <a
              href={visitor.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-400 hover:underline truncate flex items-center gap-1"
            >
              <ExternalLink size={10} />
              {visitor.pageUrl.replace(/^https?:\/\//, '').slice(0, 40)}
            </a>
          </div>
        )}
      </div>

      <div className="p-4 border-b border-[var(--rz-border)]/80 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)] flex items-center gap-1.5">
          <Monitor size={12} />
          Sessão do visitante
        </h3>
        <DetailRow label="Navegador" value={session.browser} />
        <DetailRow label="Sistema" value={session.os} />
        <DetailRow label="Dispositivo" value={session.device} />
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
          Ações rápidas
        </h3>
        {canInbox && isOpen && (
          <Link to={inboxWebChatUrl(visitor.id)} className="block">
            <Button size="sm" className="w-full justify-start">
              <InboxIcon size={14} /> Atender no Inbox
            </Button>
          </Link>
        )}
        <Button size="sm" variant="secondary" className="w-full justify-start" onClick={() => void copyLink()}>
          <Copy size={14} /> Copiar link
        </Button>
        {visitor.pageUrl && (
          <a href={visitor.pageUrl} target="_blank" rel="noreferrer" className="block">
            <Button size="sm" variant="secondary" className="w-full justify-start">
              <Globe size={14} /> Abrir página de origem
            </Button>
          </a>
        )}

        {isOpen && canInbox && (
          <p className="text-[10px] text-[var(--rz-text-muted)] pt-2 border-t border-[var(--rz-border)]/60">
            O atendimento ativo é feito pelo Inbox. Esta tela é para histórico e contexto do visitante.
          </p>
        )}
        {!isOpen && (
          <p className="text-[10px] text-[var(--rz-text-muted)] pt-2 border-t border-[var(--rz-border)]/60">
            Conversa encerrada. O atendimento é feito pelo Inbox.
          </p>
        )}
      </div>
    </aside>
  )
}
