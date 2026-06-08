import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { History, MessageSquare } from 'lucide-react'
import { api } from '../../lib/api'
import { Spinner } from '../ui/Spinner'
import { InboxMessageBubble, formatInboxMsgTime, type InboxMessageView } from './InboxMessageBubble'

export interface PreviousConversation {
  _id: string
  status: string
  ticketRef?: string
  departmentName?: string
  createdAt: string
  resolvedAt?: string
  lastMessageAt: string
  messageCount: number
}

export interface ContactStats {
  totalConversations: number
  totalMessages: number
}

interface Props {
  contactStats?: ContactStats
  previousConversations?: PreviousConversation[]
  selectedHistoryId: string | null
  onSelectHistory: (id: string | null) => void
  currentConversationId: string
}

const STATUS_PT: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Fila',
  in_progress: 'Atendimento',
  resolved: 'Finalizado',
  closed: 'Encerrado',
}

export function InboxContactSidebar({
  contactStats,
  previousConversations = [],
  selectedHistoryId,
  onSelectHistory,
  currentConversationId,
}: Props) {
  const historyId = selectedHistoryId && selectedHistoryId !== currentConversationId
    ? selectedHistoryId
    : null

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['inbox-history', historyId],
    queryFn: () =>
      api.get<{
        messages: InboxMessageView[]
        status: string
        ticketRef?: string
        createdAt: string
      }>(`/inbox/conversations/${historyId}/history`),
    enabled: Boolean(historyId),
  })

  const visits = contactStats?.totalConversations ?? 0
  const msgs = contactStats?.totalMessages ?? 0

  return (
    <aside className="w-full xl:w-[300px] shrink-0 flex flex-col border-t xl:border-t-0 xl:border-l border-gray-800/80 bg-gray-950/30 min-h-[200px] xl:min-h-0">
      <div className="p-3 border-b border-gray-800/80 shrink-0">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <History size={14} />
          Histórico do contato
        </h3>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-lg bg-gray-900/60 border border-gray-800 px-2.5 py-2">
            <p className="text-[10px] text-gray-600">Atendimentos</p>
            <p className="text-lg font-semibold text-brand-400 tabular-nums">{visits}</p>
          </div>
          <div className="rounded-lg bg-gray-900/60 border border-gray-800 px-2.5 py-2">
            <p className="text-[10px] text-gray-600">Mensagens</p>
            <p className="text-lg font-semibold text-gray-200 tabular-nums">{msgs}</p>
          </div>
        </div>
      </div>

      <div className="shrink-0 max-h-[180px] overflow-y-auto border-b border-gray-800/60">
        <p className="px-3 py-2 text-[10px] text-gray-600 uppercase tracking-wider">
          Conversas anteriores ({previousConversations.length})
        </p>
        {previousConversations.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-gray-600">Primeiro atendimento deste contato.</p>
        ) : (
          previousConversations.map(c => {
            const active = historyId === c._id
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => onSelectHistory(active ? null : c._id)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-800/40 hover:bg-gray-800/40 transition-colors ${
                  active ? 'bg-brand-500/[0.08] border-l-2 border-l-brand-500' : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300">
                    {formatInboxMsgTime(c.createdAt, false)}
                  </span>
                  <span className="text-[10px] text-gray-600">{STATUS_PT[c.status] ?? c.status}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                  {c.ticketRef ? (
                    <Link
                      to={`/platform/inbox/tickets/${c.ticketRef}`}
                      className="font-mono text-amber-500/80 hover:underline"
                    >
                      {c.ticketRef}
                    </Link>
                  ) : null}
                  {c.ticketRef ? ' · ' : ''}
                  {c.messageCount} msg
                  {c.departmentName ? ` · ${c.departmentName}` : ''}
                </p>
              </button>
            )
          })
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <p className="px-3 py-2 text-[10px] text-gray-600 shrink-0 flex items-center gap-1">
          <MessageSquare size={12} />
          {historyId ? 'Mensagens do atendimento selecionado' : 'Conversa atual no centro'}
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-2">
          {historyId ? (
            loadingHistory ? (
              <div className="flex justify-center py-8">
                <Spinner size={20} />
              </div>
            ) : (historyData?.messages ?? []).length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">Sem mensagens.</p>
            ) : (
              (historyData?.messages ?? []).map(m => <InboxMessageBubble key={m._id} message={m} />)
            )
          ) : (
            <p className="text-xs text-gray-600 text-center py-6 px-2">
              Selecione um atendimento anterior para revisar o chat com data e hora completas.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
