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

import { Search, Ticket, Filter } from 'lucide-react'
import { inputCls, selectCls, LoadingState, EmptyState, MetricCard } from '@/design-system'



export default function InboxTickets() {

  const [search, setSearch] = useState('')

  const [statusFilter, setStatusFilter] = useState('')

  const [mineOnly, setMineOnly] = useState(false)



  const { data: me } = useQuery<AuthUser | null>({

    queryKey: ['auth-me'],

    queryFn: getMe,

  })



  const params = new URLSearchParams()

  if (statusFilter) params.set('status', statusFilter)

  if (mineOnly) params.set('mine', '1')

  if (search.trim()) params.set('search', search.trim())



  const { data: stats } = useQuery({

    queryKey: ['inbox-ticket-stats'],

    queryFn: () => api.get<InboxTicketStats>('/inbox/tickets/stats'),

  })



  const { data: tickets = [], isLoading } = useQuery({

    queryKey: ['inbox-tickets', statusFilter, mineOnly, search],

    queryFn: () => api.get<InboxTicketListRow[]>(`/inbox/tickets?${params}`),

  })



  return (

    <PlatformPage

      title="Tickets de atendimento"

      description="Chamados abertos a partir do Inbox. Permanecem abertos para a equipe mesmo após finalizar o chat WhatsApp."

    >

      <InboxAtendimentoNav me={me} className="mb-4" />



      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4 max-w-5xl">
        {[
          { label: 'Total', value: stats?.total ?? '—' },
          { label: 'Abertos', value: stats?.open ?? '—', status: stats?.open ? { status: 'warning' as const, text: 'Abertos' } : undefined },
          { label: 'Em andamento', value: stats?.inProgress ?? '—' },
          { label: 'Cliente respondeu', value: stats?.clientReplied ?? '—' },
          { label: 'Aguard. equipe', value: stats?.waitingTeam ?? '—' },
          { label: 'SLA estourado', value: stats?.slaBreached ?? '—', status: (stats?.slaBreached ?? 0) > 0 ? { status: 'danger' as const, text: 'SLA' } : undefined },
          { label: 'Fechados', value: stats?.closed ?? '—' },
        ].map(s => (
          <MetricCard key={s.label} title={s.label} value={s.value} status={s.status} className="text-center [&_p:first-child]:text-[10px] [&_p:first-child]:uppercase" />
        ))}
      </div>



      <Card className="p-0 overflow-hidden">

        <div className="p-3 border-b border-[var(--rz-border)] flex flex-col sm:flex-row gap-2 sm:items-center">

          <div className="relative flex-1">

            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rz-text-muted)]" />

            <input

              type="search"

              value={search}

              onChange={e => setSearch(e.currentTarget.value)}

              placeholder="Buscar ticket, contato ou telefone…"

              className={`${inputCls} pl-9`}

            />

          </div>

          <div className="flex gap-2 shrink-0">

            <select

              value={statusFilter}

              onChange={e => setStatusFilter(e.currentTarget.value)}

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

              onClick={() => setMineOnly(v => !v)}

            >

              <Filter size={14} /> Meus

            </Button>

          </div>

        </div>



        {isLoading ? (
          <LoadingState rows={4} className="py-8" />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="Nenhum ticket encontrado"
            description="Converta uma conversa no Inbox usando o ícone de ticket."
            action={
              <Link to="/platform/inbox" className="text-sm text-[var(--rz-primary)] hover:underline">
                Ir para o Inbox
              </Link>
            }
          />
        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] border-b border-[var(--rz-border)]">

                  <th className="px-4 py-2.5 font-medium">Ticket</th>

                  <th className="px-4 py-2.5 font-medium">Cliente</th>

                  <th className="px-4 py-2.5 font-medium">Status</th>

                  <th className="px-4 py-2.5 font-medium hidden md:table-cell">Setor</th>

                  <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Atendente</th>

                  <th className="px-4 py-2.5 font-medium">Atualizado</th>

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

                    <td className="px-4 py-3 text-[var(--rz-text-muted)] text-xs tabular-nums whitespace-nowrap">

                      {formatInboxMsgTime(t.lastMessageAt, true)}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </Card>

    </PlatformPage>

  )

}

