import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { TicketStatusBadge } from '../../components/inbox/TicketStatusBadge'
import { formatInboxMsgTime } from '../../components/inbox/InboxMessageBubble'
import { formatContactIdentifier } from '../../lib/destinationFormat'
import { ticketIsOpen, type InboxTicketListRow, type InboxTicketStats } from '../../lib/inboxTicket'
import {
  Search,
  Ticket,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  User,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { inputCls, selectCls, LoadingState, EmptyState, MetricCard, searchFieldIconCls } from '@/design-system'

const PAGE_SIZE = 15

interface InboxTicketListResponse {
  items: InboxTicketListRow[]
  total: number
  page: number
  limit: number
}

export default function InboxTickets() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const params = new URLSearchParams()
  if (statusFilter) params.set('status', statusFilter)
  if (mineOnly) params.set('mine', '1')
  if (search.trim()) params.set('search', search.trim())
  params.set('page', String(page))
  params.set('limit', String(PAGE_SIZE))

  const {
    data: stats,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['inbox-ticket-stats'],
    queryFn: () => api.get<InboxTicketStats>('/inbox/tickets/stats'),
  })

  const {
    data: listData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['inbox-tickets', statusFilter, mineOnly, search, page],
    queryFn: () => api.get<InboxTicketListResponse>(`/inbox/tickets?${params}`),
  })

  const tickets = listData?.items ?? []
  const total = listData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const setSearchWithReset = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const metricItems = [
    { label: 'Total', value: stats?.total ?? '—', icon: BarChart3 },
    { label: 'Abertos', value: stats?.open ?? '—', icon: Ticket, status: (stats?.open ?? 0) > 0 ? { status: 'warning' as const, text: 'Abertos' } : undefined },
    { label: 'Em andamento', value: stats?.inProgress ?? '—', icon: Clock },
    { label: 'Cliente respondeu', value: stats?.clientReplied ?? '—', icon: MessageSquare },
    { label: 'Aguard. equipe', value: stats?.waitingTeam ?? '—', icon: User },
    { label: 'SLA estourado', value: stats?.slaBreached ?? '—', icon: AlertTriangle, status: (stats?.slaBreached ?? 0) > 0 ? { status: 'danger' as const, text: 'SLA' } : undefined },
    { label: 'Fechados', value: stats?.closed ?? '—', icon: CheckCircle2 },
  ]

  return (
    <PlatformPage
      title="Tickets de atendimento"
      description="Chamados abertos a partir do Inbox. Permanecem abertos para a equipe mesmo após finalizar o chat WhatsApp."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      {statsError ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>Não foi possível carregar as métricas.</span>
          <Button size="sm" variant="secondary" onClick={() => refetchStats()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          {metricItems.map(s => (
            <MetricCard
              key={s.label}
              title={s.label}
              value={s.value}
              icon={s.icon}
              status={s.status}
              className="text-center [&_p:first-child]:text-[10px] [&_p:first-child]:uppercase"
            />
          ))}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-[var(--rz-border)] flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className={searchFieldIconCls} />
            <input
              type="search"
              value={search}
              onChange={e => setSearchWithReset(e.currentTarget.value)}
              placeholder="Buscar ticket, contato ou telefone…"
              className={`${inputCls} pl-9`}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.currentTarget.value)
                setPage(1)
              }}
              className={`${selectCls} text-xs py-2`}
            >
              <option value="">Todos status</option>
              <option value="open">Aberto</option>
              <option value="in_progress">Em andamento</option>
              <option value="client_replied">Cliente respondeu</option>
              <option value="closed">Fechado</option>
            </select>
            <Button
              size="sm"
              variant={mineOnly ? 'primary' : 'secondary'}
              onClick={() => {
                setMineOnly(v => !v)
                setPage(1)
              }}
            >
              <Filter size={14} /> Meus
            </Button>
            <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              Atualizar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <LoadingState rows={4} className="py-8" />
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar os tickets"
            description="Verifique sua conexão e tente novamente."
            action={
              <Button size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : total === 0 ? (
          <EmptyState
            icon={Ticket}
            title={statusFilter || mineOnly || search ? 'Nenhum ticket nesse filtro' : 'Nenhum ticket encontrado'}
            description={
              statusFilter || mineOnly || search
                ? 'Ajuste os filtros ou limpe a busca.'
                : 'Converta uma conversa no Inbox usando o ícone de ticket.'
            }
            action={
              <Link to="/platform/inbox" className="text-sm text-[var(--rz-primary)] hover:underline">
                Ir para o Inbox
              </Link>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30">
                    <th className="px-4 py-2.5 font-medium">Ticket</th>
                    <th className="px-4 py-2.5 font-medium">Cliente</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">Setor</th>
                    <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Atendente</th>
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Atualizado</th>
                    <th className="px-4 py-2.5 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr
                      key={t._id}
                      className="border-b border-[var(--rz-border)]/60 hover:bg-[var(--rz-surface-muted)]/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/platform/inbox/tickets/${t.ticketRef}`}
                          className="font-mono text-amber-400 hover:text-amber-300 font-medium"
                        >
                          {t.ticketRef}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[var(--rz-text-primary)] truncate max-w-[160px]">{t.contactName}</p>
                        <p className="text-[11px] text-[var(--rz-text-muted)] truncate max-w-[160px]">
                          {formatContactIdentifier(t.contactIdentifier, t.contactName)}
                        </p>
                        <p className="text-[10px] text-[var(--rz-text-muted)] sm:hidden tabular-nums mt-0.5">
                          {formatInboxMsgTime(t.lastMessageAt, true)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <TicketStatusBadge
                          status={t.ticketStatus}
                          displayStatus={t.displayStatus}
                          teamSlaOverdue={t.teamSlaOverdue}
                          size="sm"
                        />
                        {ticketIsOpen(t.ticketStatus) && (
                          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--rz-text-muted)] hidden md:table-cell truncate max-w-[120px]">
                        {t.departmentName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--rz-text-muted)] hidden lg:table-cell truncate max-w-[120px]">
                        {t.assignedUserName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--rz-text-muted)] text-xs tabular-nums whitespace-nowrap hidden sm:table-cell">
                        {formatInboxMsgTime(t.lastMessageAt, true)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/platform/inbox/tickets/${t.ticketRef}`}
                          className="text-xs text-brand-400 hover:underline"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-[var(--rz-border)]/60 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--rz-text-muted)]">
              <span>
                {total} ticket(s) · página {safePage} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Anterior
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Próxima <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </PlatformPage>
  )
}
