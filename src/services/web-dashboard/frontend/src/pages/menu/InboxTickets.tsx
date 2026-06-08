import { useState } from 'react'

import { Link } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'

import { api } from '../../lib/api'

import { getMe, type AuthUser } from '../../lib/auth'

import { PlatformPage } from '../../components/platform/PlatformPage'

import { Card } from '../../components/ui/Card'

import { Button } from '../../components/ui/Button'

import { Spinner } from '../../components/ui/Spinner'

import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'

import { TicketStatusBadge } from '../../components/inbox/TicketStatusBadge'

import { formatInboxMsgTime } from '../../components/inbox/InboxMessageBubble'

import { formatContactIdentifier } from '../../lib/destinationFormat'

import { ticketIsOpen, type InboxTicketListRow, type InboxTicketStats } from '../../lib/inboxTicket'

import { Search, Ticket, Filter } from 'lucide-react'



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



      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4 max-w-3xl">

        {[

          { label: 'Total', value: stats?.total ?? '—', color: 'text-amber-400' },

          { label: 'Abertos', value: stats?.open ?? '—', color: 'text-amber-400' },

          { label: 'Em andamento', value: stats?.inProgress ?? '—', color: 'text-blue-400' },

          { label: 'Cliente respondeu', value: stats?.clientReplied ?? '—', color: 'text-emerald-400' },

          { label: 'Fechados', value: stats?.closed ?? '—', color: 'text-gray-400' },

        ].map(s => (

          <Card key={s.label} className="px-3 py-2.5 text-center">

            <p className="text-[10px] uppercase text-gray-600">{s.label}</p>

            <p className={`text-xl font-semibold tabular-nums ${s.color}`}>{s.value}</p>

          </Card>

        ))}

      </div>



      <Card className="p-0 overflow-hidden">

        <div className="p-3 border-b border-gray-800 flex flex-col sm:flex-row gap-2 sm:items-center">

          <div className="relative flex-1">

            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />

            <input

              type="search"

              value={search}

              onChange={e => setSearch(e.currentTarget.value)}

              placeholder="Buscar ticket, contato ou telefone…"

              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-900/80 border border-gray-800 rounded-lg text-gray-200"

            />

          </div>

          <div className="flex gap-2 shrink-0">

            <select

              value={statusFilter}

              onChange={e => setStatusFilter(e.currentTarget.value)}

              className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-2 text-xs text-gray-200"

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

          <div className="flex justify-center py-16">

            <Spinner size={28} />

          </div>

        ) : tickets.length === 0 ? (

          <div className="text-center py-16 px-4">

            <Ticket size={36} className="mx-auto text-gray-700 mb-3" />

            <p className="text-gray-500">Nenhum ticket encontrado.</p>

            <p className="text-xs text-gray-600 mt-1">

              Converta uma conversa no{' '}

              <Link to="/platform/inbox" className="text-brand-400 hover:underline">

                Inbox

              </Link>{' '}

              usando o ícone de ticket.

            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-600 border-b border-gray-800">

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

                    className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors"

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

                      <p className="text-gray-200 truncate max-w-[160px]">{t.contactName}</p>

                      <p className="text-[11px] text-gray-600 truncate max-w-[160px]">

                        {formatContactIdentifier(t.contactIdentifier, t.contactName)}

                      </p>

                    </td>

                    <td className="px-4 py-3">

                      <TicketStatusBadge status={t.ticketStatus} size="sm" />

                      {ticketIsOpen(t.ticketStatus) && (

                        <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />

                      )}

                    </td>

                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell truncate max-w-[120px]">

                      {t.departmentName ?? '—'}

                    </td>

                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell truncate max-w-[120px]">

                      {t.assignedUserName ?? '—'}

                    </td>

                    <td className="px-4 py-3 text-gray-600 text-xs tabular-nums whitespace-nowrap">

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

