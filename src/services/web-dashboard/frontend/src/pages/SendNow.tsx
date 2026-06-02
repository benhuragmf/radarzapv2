import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import {
  Send,
  CheckCircle,
  XCircle,
  Smartphone,
  AlertCircle,
  Calendar,
  Clock,
  Users,
  Hash,
  Search,
  Plus,
  RefreshCw,
} from 'lucide-react'

interface Destination {
  _id: string
  name: string
  identifier: string
  type: 'contact' | 'group'
}

interface Session {
  clientId: string
  status: string
  phoneNumber?: string
  profileName?: string
}

interface WAGroup {
  id: string
  name: string
  participantsCount: number
}

type Priority = 'high' | 'medium' | 'low'

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

const labelCls = 'text-xs text-gray-500 mb-1 block'

function defaultScheduleLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SendNow() {
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'contact' | 'group'>('all')
  const [priority, setPriority] = useState<Priority>('medium')
  const [delayBetweenMs, setDelayBetweenMs] = useState(3000)
  const [requireConnected, setRequireConnected] = useState(true)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [sendAtLocal, setSendAtLocal] = useState(defaultScheduleLocal)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showGroups, setShowGroups] = useState(false)

  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
  })

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
    refetchInterval: 10_000,
  })

  const connected = sessions.find(s => s.status === 'connected')

  const { data: waGroups = [], isLoading: loadingGroups, refetch: refetchGroups } = useQuery<WAGroup[]>({
    queryKey: ['wa-groups', connected?.clientId],
    queryFn: () =>
      connected ? api.get(`/sessions/${connected.clientId}/groups`) : Promise.resolve([]),
    enabled: showGroups && !!connected,
  })

  const filteredDest = useMemo(() => {
    const q = search.trim().toLowerCase()
    return destinations.filter(d => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        d.identifier.toLowerCase().includes(q)
      )
    })
  }, [destinations, search, typeFilter])

  const toggleDest = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      filteredDest.forEach(d => next.add(d._id))
      return next
    })
  }

  const importGroup = useMutation({
    mutationFn: (g: WAGroup) =>
      api.post('/destinations', { type: 'group', identifier: g.id, name: g.name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['destinations'] }),
    onError: (err: Error) => alert(err.message),
  })

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        title: title.trim() || undefined,
        message: message.trim(),
        destinationIds: Array.from(selectedIds),
        priority,
        delayBetweenMs,
        requireConnected,
      }
      if (scheduleMode) {
        body.sendAt = new Date(sendAtLocal).toISOString()
      }
      return api.post<{ ok: boolean; message?: string }>('/campaigns', body)
    },
    onSuccess: data => {
      setResult({ success: true, message: data?.message ?? 'Campanha criada com sucesso!' })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      if (!scheduleMode) {
        setMessage('')
        setSelectedIds(new Set())
      }
    },
    onError: (err: Error) =>
      setResult({ success: false, message: err.message ?? 'Erro ao enviar.' }),
  })

  return (
    <div className="max-w-4xl space-y-4">
      {!connected && (
        <Card className="flex items-start gap-3 border-amber-800/50 bg-amber-950/20">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-200">WhatsApp desconectado</p>
            <p className="text-xs text-gray-500 mt-1">
              Reconecte para enviar agora. Agendamentos futuros podem ser criados e serão
              enviados quando o WhatsApp estiver online (se a opção estiver ativa).
            </p>
            <Link to="/sessions" className="text-xs text-brand-400 hover:underline mt-2 inline-block">
              Ir para Conexão WhatsApp
            </Link>
          </div>
        </Card>
      )}

      {connected && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Smartphone size={14} className="text-brand-500" />
          Sessão ativa:{' '}
          <Badge
            label={connected.phoneNumber ?? connected.profileName ?? 'Conectado'}
            variant="green"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <h2 className="text-sm font-medium text-gray-300 mb-3">1. Destinatários</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar nome ou número..."
                    className={`${inputCls} pl-9`}
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                >
                  <option value="all">Todos</option>
                  <option value="contact">Contatos</option>
                  <option value="group">Grupos</option>
                </select>
                <Button variant="ghost" size="sm" onClick={selectAllFiltered}>
                  Marcar visíveis
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Limpar
                </Button>
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {selectedIds.size} selecionado(s) · {destinations.length} cadastrado(s)
              </p>

              <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-2">
                {filteredDest.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">
                    Nenhum destino.{' '}
                    <Link to="/destinations" className="text-brand-400 hover:underline">
                      Cadastrar destinos
                    </Link>
                  </p>
                ) : (
                  filteredDest.map(d => (
                    <label
                      key={d._id}
                      className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedIds.has(d._id) ? 'bg-brand-600/15 border border-brand-600/30' : 'hover:bg-gray-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d._id)}
                        onChange={() => toggleDest(d._id)}
                        className="rounded border-gray-600"
                      />
                      {d.type === 'group' ? (
                        <Hash size={14} className="text-brand-500 shrink-0" />
                      ) : (
                        <Users size={14} className="text-blue-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{d.name}</p>
                        <p className="text-[11px] text-gray-500 font-mono truncate">{d.identifier}</p>
                      </div>
                      <Badge label={d.type === 'group' ? 'grupo' : 'contato'} variant={d.type === 'group' ? 'green' : 'blue'} />
                    </label>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowGroups(v => !v)}
                className="text-xs text-brand-400 hover:underline mt-3 flex items-center gap-1"
              >
                <Plus size={12} />
                {showGroups ? 'Ocultar grupos do WhatsApp' : 'Importar grupos do WhatsApp'}
              </button>

              {showGroups && (
                <div className="mt-3 border border-gray-800 rounded-lg p-3 space-y-2">
                  {!connected ? (
                    <p className="text-xs text-gray-500">Conecte o WhatsApp para listar grupos.</p>
                  ) : loadingGroups ? (
                    <div className="flex justify-center py-4">
                      <Spinner size={20} />
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{waGroups.length} grupos na sessão</span>
                        <button
                          type="button"
                          onClick={() => refetchGroups()}
                          className="text-gray-500 hover:text-white"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {waGroups.map(g => {
                          const exists = destinations.some(d => d.identifier === g.id)
                          return (
                            <div
                              key={g.id}
                              className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-gray-800/50"
                            >
                              <span className="truncate">{g.name}</span>
                              {exists ? (
                                <span className="text-gray-600 shrink-0">Já cadastrado</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={importGroup.isPending}
                                  onClick={() => importGroup.mutate(g)}
                                  className="text-brand-400 hover:underline shrink-0"
                                >
                                  Adicionar
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-gray-300 mb-3">2. Mensagem</h2>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Título interno (opcional)</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Promoção março"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Texto da mensagem *</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Digite a mensagem que será enviada no WhatsApp..."
                    className={`${inputCls} resize-none`}
                  />
                  <p className="text-[11px] text-gray-600 mt-1 text-right">{message.length} / 4096</p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-gray-300 mb-3">3. Quando e como enviar</h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleMode(false)}
                    className={`flex-1 py-2.5 rounded-lg text-sm border transition-colors ${
                      !scheduleMode
                        ? 'border-brand-500 bg-brand-600/20 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Send size={14} className="inline mr-1.5" />
                    Enviar agora
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleMode(true)}
                    className={`flex-1 py-2.5 rounded-lg text-sm border transition-colors ${
                      scheduleMode
                        ? 'border-brand-500 bg-brand-600/20 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Calendar size={14} className="inline mr-1.5" />
                    Agendar
                  </button>
                </div>

                {scheduleMode && (
                  <div>
                    <label className={labelCls}>Data e horário</label>
                    <input
                      type="datetime-local"
                      value={sendAtLocal}
                      onChange={e => setSendAtLocal(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Prioridade na fila</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value as Priority)}
                      className={inputCls}
                    >
                      <option value="high">Alta</option>
                      <option value="medium">Média</option>
                      <option value="low">Baixa</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Intervalo entre destinos</label>
                    <select
                      value={delayBetweenMs}
                      onChange={e => setDelayBetweenMs(Number(e.target.value))}
                      className={inputCls}
                    >
                      <option value={0}>Sem intervalo</option>
                      <option value={3000}>3 segundos</option>
                      <option value={5000}>5 segundos</option>
                      <option value={10000}>10 segundos</option>
                      <option value={30000}>30 segundos</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-start gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireConnected}
                    onChange={e => setRequireConnected(e.target.checked)}
                    className="mt-0.5 rounded border-gray-600"
                  />
                  <span>
                    Só enviar se o WhatsApp estiver conectado no horário programado
                    <span className="block text-xs text-gray-600 mt-0.5">
                      Recomendado para agendamentos — evita falha se o servidor reiniciar.
                    </span>
                  </span>
                </label>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Card className="sticky top-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Resumo</h2>
              <ul className="text-xs text-gray-500 space-y-2 mb-4">
                <li>
                  <strong className="text-gray-400">Destinos:</strong>{' '}
                  {selectedIds.size || '—'}
                </li>
                <li>
                  <strong className="text-gray-400">Modo:</strong>{' '}
                  {scheduleMode ? `Agendado (${sendAtLocal})` : 'Imediato'}
                </li>
                <li>
                  <strong className="text-gray-400">Intervalo:</strong>{' '}
                  {delayBetweenMs === 0 ? 'nenhum' : `${delayBetweenMs / 1000}s`}
                </li>
              </ul>

              <Button
                onClick={() => {
                  setResult(null)
                  submit.mutate()
                }}
                disabled={
                  !message.trim() ||
                  selectedIds.size === 0 ||
                  submit.isPending ||
                  (!scheduleMode && !connected) ||
                  message.length > 4096
                }
                className="w-full justify-center"
              >
                {submit.isPending ? <Spinner size={14} /> : scheduleMode ? <Calendar size={14} /> : <Send size={14} />}
                {submit.isPending
                  ? 'Processando...'
                  : scheduleMode
                    ? 'Agendar envio'
                    : `Enviar para ${selectedIds.size} destino(s)`}
              </Button>

              {!scheduleMode && !connected && (
                <p className="text-[11px] text-amber-500/90 mt-2 text-center">
                  Conecte o WhatsApp para envio imediato
                </p>
              )}
            </Card>

            {result && (
              <Card
                className={`flex items-start gap-3 ${result.success ? 'border-green-800' : 'border-red-800'}`}
              >
                {result.success ? (
                  <CheckCircle size={18} className="text-green-400 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-red-400 shrink-0" />
                )}
                <p className="text-sm">{result.message}</p>
              </Card>
            )}

            <Card className="text-xs text-gray-600 space-y-1">
              <p className="flex items-center gap-1.5 text-gray-500">
                <Clock size={12} /> Dicas
              </p>
              <p>• Contatos em Destinos → Contatos; grupos só por importação em Grupos.</p>
              <p>• Use intervalo entre envios para reduzir bloqueios.</p>
              <p>• Regras automáticas do Discord ficam na aba Discord → Regras.</p>
            </Card>
          </div>
        </div>
    </div>
  )
}
