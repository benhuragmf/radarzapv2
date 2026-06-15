import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import { ScrollText, ChevronDown, ChevronRight } from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'
import { DISCORD_LOG_SERVICES, PIPELINE_STAGES } from '../lib/discordRoutes'
import { RadarPageShell, PageHeader, FilterBar, EmptyState, LoadingState, logLineMetaCls } from '@/design-system'
import { inputCls, selectCls } from '@/design-system/formClasses'

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

const stageVariant: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple'> = {
  capture: 'blue',
  skip: 'yellow',
  queue: 'purple',
  render: 'blue',
  send: 'purple',
  send_ok: 'green',
  send_fail: 'red',
  error: 'red',
}

function stageFromLog(log: Log): string | undefined {
  const meta = log.metadata?.stage
  if (typeof meta === 'string') return meta
  const m = log.message.match(/^(CAPTURE|SKIP|QUEUE|RENDER|SEND OK|SEND FAIL|SEND|ERROR):/i)
  if (!m) return undefined
  const raw = m[1].toLowerCase().replace(/\s+/g, '_')
  if (raw === 'send') return log.message.startsWith('SEND OK') ? 'send_ok' : 'send'
  return raw
}

interface Props {
  scope?: 'all' | 'discord' | 'tenant'
  serviceFilter?: string
}

export default function Logs({ scope = 'all', serviceFilter }: Props) {
  const { hash } = useLocation()
  const isDiscord = scope === 'discord'
  const isTenant = scope === 'tenant'
  const isHistoryView = hash === '#historico'
  const [level, setLevel]     = useState('')
  const [service, setService] = useState(serviceFilter ?? (isDiscord ? '' : ''))
  const [stage, setStage]     = useState('')
  const [search, setSearch]   = useState(isDiscord ? 'pipeline' : '')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: logs = [], isLoading } = useQuery<Log[]>({
    queryKey: ['logs', level, service, stage, search, isDiscord, isTenant],
    queryFn: () => {
      const params = new URLSearchParams()
      if (level)   params.set('level', level)
      if (service) params.set('service', service)
      if (stage)   params.set('stage', stage)
      if (search)  params.set('q', search)
      if (isDiscord) params.set('discord', '1')
      if (isTenant) params.set('tenant', '1')
      params.set('limit', isDiscord ? '200' : '100')
      return api.get(`/logs?${params}`)
    },
    refetchInterval: isDiscord ? 5_000 : 15_000,
  })

  const body = (
    <div className="space-y-4">
      {isTenant && (
        <p className="text-sm text-[var(--rz-text-muted)]">
          Apenas logs da sua empresa (filtro por tenant).
        </p>
      )}
      {isHistoryView && !isDiscord && !isTenant && (
        <p className="text-sm text-[var(--rz-text-muted)]">
          Histórico de envios manuais e agendados.
        </p>
      )}
      {isDiscord && (
        <>
          <p className="text-sm text-[var(--rz-text-muted)]">
            Pipeline: <span className="text-[var(--rz-text-secondary)]">CAPTURE → RENDER → QUEUE → SEND → SEND OK</span>.
            Filtre por etapa ou busque <code className="text-brand-400">send</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            {DISCORD_LOG_SERVICES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setService(service === s ? '' : s)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  service === s
                    ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                    : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(stage === s ? '' : s)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  stage === s
                    ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                    : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
                }`}
              >
                {s === 'send_ok' ? 'send ✓' : s}
              </button>
            ))}
          </div>
        </>
      )}
      <FilterBar
        actions={<span className="text-xs text-[var(--rz-text-muted)] self-center">{logs.length} registros</span>}
      >
        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className={selectCls}
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
          placeholder="Serviço..."
          className={`${inputCls} w-48`}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={isDiscord ? 'Buscar (tenantSender, skulks, trace…)…' : 'Buscar mensagem…'}
          className={`${inputCls} flex-1 min-w-[12rem]`}
        />
      </FilterBar>

      {isLoading && <LoadingState rows={5} className="pt-6" />}

      {!isLoading && logs.length === 0 && (
        <EmptyState icon={ScrollText} title="Nenhum log encontrado" />
      )}

      <div className="space-y-1.5">
        {logs.map((log) => {
          const st = stageFromLog(log)
          return (
          <div
            key={log._id}
            className="bg-[var(--rz-surface)] border border-[var(--rz-border)] rounded-lg overflow-hidden"
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--rz-surface-muted)]/50 transition-colors"
              onClick={() => setExpanded(expanded === log._id ? null : log._id)}
            >
              {expanded === log._id
                ? <ChevronDown size={14} className="text-[var(--rz-text-muted)] shrink-0" />
                : <ChevronRight size={14} className="text-[var(--rz-text-muted)] shrink-0" />
              }
              <Badge label={log.level} variant={levelVariant[log.level]} />
              {st && (
                <Badge
                  label={st === 'send_ok' ? 'SEND' : st.toUpperCase()}
                  variant={stageVariant[st] ?? 'gray'}
                />
              )}
              <span className="text-xs text-[var(--rz-text-muted)] shrink-0">
                {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
              </span>
              <span className={`text-xs shrink-0 ${logLineMetaCls.service}`}>{log.service}</span>
              <span className="text-sm text-[var(--rz-text-secondary)] truncate flex-1 min-w-0">
                {log.message}
                {typeof log.metadata?.preview === 'string' && (
                  <span className="text-[var(--rz-text-muted)]"> — {log.metadata.preview as string}</span>
                )}
                {typeof log.metadata?.tenantSender === 'string' && (
                  <span className={logLineMetaCls.tenant}> [{log.metadata.tenantSender as string}]</span>
                )}
                {typeof log.metadata?.discordPosterTag === 'string' && (
                  <span className={logLineMetaCls.poster}> {log.metadata.discordPosterTag as string}</span>
                )}
                {typeof log.metadata?.streamer === 'string' && (
                  <span className={logLineMetaCls.live}> live:{log.metadata.streamer as string}</span>
                )}
              </span>
              {typeof log.metadata?.template === 'string' && (
                <span className="text-[10px] text-[var(--rz-text-muted)] shrink-0">{log.metadata.template as string}</span>
              )}
            </button>

            {expanded === log._id && (
              <div className="px-4 pb-3 border-t border-[var(--rz-border)]">
                <p className="text-xs text-[var(--rz-text-muted)] mt-2 mb-1">traceId: <code className="text-[var(--rz-text-secondary)]">{log.traceId}</code></p>
                {Object.keys(log.metadata ?? {}).length > 0 && (
                  <pre className="text-xs text-[var(--rz-text-secondary)] bg-[var(--rz-surface-muted)] rounded p-2 overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )})}
      </div>
    </div>
  )

  if (isDiscord) {
    return (
      <DiscordPage description="Pipeline Discord → WhatsApp (captura, fila, envio).">
        {body}
      </DiscordPage>
    )
  }

  const title = isTenant ? 'Logs da empresa' : isHistoryView ? 'Histórico de envios' : 'Logs do sistema'

  return (
    <RadarPageShell>
      <PageHeader title={title} />
      {body}
    </RadarPageShell>
  )
}
