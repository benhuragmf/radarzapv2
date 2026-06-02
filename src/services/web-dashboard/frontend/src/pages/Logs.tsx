import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { ScrollText, ChevronDown, ChevronRight } from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'
import { DISCORD_LOG_SERVICES } from '../lib/discordRoutes'

interface Log {
  _id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  service: string
  message: string
  metadata: Record<string, unknown>
  timestamp: string
  traceId: string
}

const levelVariant = {
  info:  'blue',
  warn:  'yellow',
  error: 'red',
  debug: 'gray',
} as const

interface Props {
  scope?: 'all' | 'discord'
}

export default function Logs({ scope = 'all' }: Props) {
  const { hash } = useLocation()
  const isDiscord = scope === 'discord'
  const isHistoryView = hash === '#historico'
  const [level, setLevel]     = useState('')
  const [service, setService] = useState(isDiscord ? 'QueueProcessorService' : '')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: logs = [], isLoading } = useQuery<Log[]>({
    queryKey: ['logs', level, service],
    queryFn: () => {
      const params = new URLSearchParams()
      if (level)   params.set('level', level)
      if (service) params.set('service', service)
      return api.get(`/logs?${params}`)
    },
    refetchInterval: 15_000,
  })

  const body = (
    <div className="space-y-4">
      {isHistoryView && !isDiscord && (
        <p className="text-sm text-gray-400">
          Histórico de envios manuais e agendados.
        </p>
      )}
      {isDiscord && (
        <div className="flex flex-wrap gap-2">
          {DISCORD_LOG_SERVICES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setService(service === s ? '' : s)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                service === s
                  ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                  : 'border-gray-700 text-gray-500 hover:border-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-500"
        >
          <option value="">Todos os níveis</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
        </select>
        <input
          value={service}
          onChange={e => setService(e.target.value)}
          placeholder="Filtrar por serviço..."
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-500 w-48"
        />
        <span className="ml-auto text-xs text-gray-500 self-center">{logs.length} registros</span>
      </div>

      {isLoading && <div className="flex justify-center pt-10"><Spinner size={28} /></div>}

      {!isLoading && logs.length === 0 && (
        <Card className="text-center py-12 text-gray-500">
          <ScrollText size={32} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum log encontrado.</p>
        </Card>
      )}

      <div className="space-y-1.5">
        {logs.map((log) => (
          <div
            key={log._id}
            className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-800/50 transition-colors"
              onClick={() => setExpanded(expanded === log._id ? null : log._id)}
            >
              {expanded === log._id
                ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                : <ChevronRight size={14} className="text-gray-500 shrink-0" />
              }
              <Badge label={log.level} variant={levelVariant[log.level]} />
              <span className="text-xs text-gray-500 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
              </span>
              <span className="text-xs text-blue-400 shrink-0">{log.service}</span>
              <span className="text-sm text-gray-300 truncate">{log.message}</span>
            </button>

            {expanded === log._id && (
              <div className="px-4 pb-3 border-t border-gray-800">
                <p className="text-xs text-gray-500 mt-2 mb-1">traceId: <code className="text-gray-400">{log.traceId}</code></p>
                {Object.keys(log.metadata ?? {}).length > 0 && (
                  <pre className="text-xs text-gray-400 bg-gray-950 rounded p-2 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  if (isDiscord) {
    return (
      <DiscordPage description="Logs de processamento das regras e do bot Discord.">
        {body}
      </DiscordPage>
    )
  }

  return body
}
