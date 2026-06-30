import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useGuild } from '../lib/guildContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Link } from 'react-router-dom'
import {
  Hash, Plus, Trash2, ToggleLeft, ToggleRight, ChevronRight, BookOpen,
  Mic, Users, Settings2, X, Check, History,
} from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'
import { MonitorHistoryPanel } from '../components/discord/MonitorHistoryPanel'
import { mutationError } from '../lib/notify'
import { MetricCard, LoadingState, inputCls } from '@/design-system'
import {
  type DiscordMonitorType,
  MONITOR_LABELS,
  discordChannelTypeLabel,
} from '../lib/discordMonitor'

interface Channel {
  _id: string
  guildId: string
  channelId: string
  channelName: string
  guildName: string
  isActive: boolean
  monitorType?: DiscordMonitorType
  eventCooldownSec?: number | null
  filters: {
    keywords: string[]
    excludeKeywords?: string[]
    allowBots?: boolean
    allowedBotIds?: string[]
    allowedUserIds?: string[]
    requireLink?: boolean
    requireImage?: boolean
    requireEmbed?: boolean
  }
}

interface Guild {
  id: string
  name: string
  icon: string | null
}

interface DiscordChannelOption {
  id: string
  name: string
  type: number
  typeLabel?: string
}

const MONITOR_ICONS = {
  text: Hash,
  voice: Mic,
  guild: Users,
} as const

export default function Channels() {
  const qc = useQueryClient()
  const { guildId } = useGuild()
  const [showForm, setShowForm] = useState(false)
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<DiscordChannelOption | null>(null)
  const [monitorType, setMonitorType] = useState<DiscordMonitorType>('text')
  const [step, setStep] = useState<'guild' | 'channel'>('guild')
  const [editingFilters, setEditingFilters] = useState<Channel | null>(null)
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)
  const [filterForm, setFilterForm] = useState({
    keywords: '',
    excludeKeywords: '',
    allowBots: true,
    allowedBotIds: '',
    allowedUserIds: '',
    requireLink: false,
    requireImage: false,
    requireEmbed: false,
    eventCooldownSec: '',
  })

  const { data: channels = [], isLoading } = useQuery<Channel[]>({
    queryKey: ['channels', guildId],
    queryFn: () => api.get(`/channels${guildId ? `?guildId=${guildId}` : ''}`),
    refetchInterval: 30_000,
  })

  const { data: summary } = useQuery({
    queryKey: ['discord-monitor-summary', guildId],
    queryFn: () => api.get<{ text: number; voice: number; guild: number; eventRules: number }>(
      `/discord/monitor-summary${guildId ? `?guildId=${guildId}` : ''}`,
    ),
    enabled: Boolean(guildId),
  })

  const { data: guilds = [], isLoading: loadingGuilds } = useQuery<Guild[]>({
    queryKey: ['discord-guilds'],
    queryFn: () => api.get('/discord/guilds'),
    enabled: showForm,
  })

  const channelQueryType = monitorType === 'voice' ? 'voice' : 'text'

  const { data: guildChannels = [], isLoading: loadingChannels } = useQuery<DiscordChannelOption[]>({
    queryKey: ['discord-channels', selectedGuild?.id, channelQueryType],
    queryFn: () =>
      api.get(`/discord/guilds/${selectedGuild!.id}/channels?type=${channelQueryType}`),
    enabled: !!selectedGuild && step === 'channel' && monitorType !== 'guild',
  })

  const add = useMutation({
    mutationFn: () => {
      if (monitorType === 'guild') {
        return api.post('/channels', {
          guildId: selectedGuild!.id,
          channelId: selectedGuild!.id,
          channelName: 'Eventos do servidor',
          guildName: selectedGuild!.name,
          monitorType: 'guild',
        })
      }
      return api.post('/channels', {
        guildId: selectedGuild!.id,
        channelId: selectedChannel!.id,
        channelName: selectedChannel!.name,
        guildName: selectedGuild!.name,
        monitorType,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] })
      qc.invalidateQueries({ queryKey: ['discord-monitor-summary'] })
      setShowForm(false)
      setSelectedGuild(null)
      setSelectedChannel(null)
      setMonitorType('text')
      setStep('guild')
    },
    onError: mutationError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/channels/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] })
      qc.invalidateQueries({ queryKey: ['discord-monitor-summary'] })
    },
  })

  const toggle = useMutation({
    mutationFn: (id: string) => api.patch(`/channels/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  })

  const saveFilters = useMutation({
    mutationFn: () =>
      api.patch(`/channels/${editingFilters!._id}/filters`, {
        keywords: filterForm.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        excludeKeywords: filterForm.excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        allowBots: filterForm.allowBots,
        allowedBotIds: filterForm.allowedBotIds.split(',').map(k => k.trim()).filter(Boolean),
        allowedUserIds: filterForm.allowedUserIds.split(',').map(k => k.trim()).filter(Boolean),
        requireLink: filterForm.requireLink,
        requireImage: filterForm.requireImage,
        requireEmbed: filterForm.requireEmbed,
        eventCooldownSec: filterForm.eventCooldownSec.trim()
          ? Math.max(0, parseInt(filterForm.eventCooldownSec, 10) || 0)
          : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] })
      setEditingFilters(null)
    },
    onError: mutationError,
  })

  const alreadyAdded = (channelId: string, type: DiscordMonitorType) =>
    channels.some(c => c.channelId === channelId && (c.monitorType ?? 'text') === type)

  const guildEventsAdded = selectedGuild
    ? channels.some(c => c.guildId === selectedGuild.id && c.monitorType === 'guild')
    : false

  const activeCount = channels.filter(c => c.isActive).length

  const openFilters = (ch: Channel) => {
    setEditingFilters(ch)
    setFilterForm({
      keywords: (ch.filters?.keywords ?? []).join(', '),
      excludeKeywords: (ch.filters?.excludeKeywords ?? []).join(', '),
      allowBots: ch.filters?.allowBots ?? true,
      allowedBotIds: (ch.filters?.allowedBotIds ?? []).join(', '),
      allowedUserIds: (ch.filters?.allowedUserIds ?? []).join(', '),
      requireLink: ch.filters?.requireLink ?? false,
      requireImage: ch.filters?.requireImage ?? false,
      requireEmbed: ch.filters?.requireEmbed ?? false,
      eventCooldownSec:
        ch.eventCooldownSec != null && ch.eventCooldownSec >= 0
          ? String(ch.eventCooldownSec)
          : '',
    })
  }

  const monitorBadge = (type?: DiscordMonitorType) => {
    const t = type ?? 'text'
    return <Badge label={MONITOR_LABELS[t]} variant={t === 'text' ? 'blue' : t === 'voice' ? 'purple' : 'yellow'} />
  }

  return (
    <DiscordPage
      description="Monitore canais de texto, chamadas de voz e eventos do servidor. Configure regras em Regras e filtros para enviar alertas ao WhatsApp."
      actions={
        <Button size="sm" onClick={() => { setShowForm(v => !v); setStep('guild') }}>
          <Plus size={12} /> Adicionar monitor
        </Button>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard title="Monitorados" value={channels.length} icon={Hash} />
        <MetricCard title="Ativos" value={activeCount} icon={ToggleRight} />
        <MetricCard title="Voz" value={summary?.voice ?? 0} icon={Mic} />
        <MetricCard title="Eventos servidor" value={summary?.guild ?? 0} icon={Users} />
      </div>

      <Card className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-[var(--rz-text-muted)]">Regras de evento ativas:</span>
        <span className="font-medium text-[var(--rz-text-primary)]">{summary?.eventRules ?? 0}</span>
        <Link to="/discord/rules" className="text-brand-400 hover:underline flex items-center gap-1 ml-auto">
          <BookOpen size={12} /> Configurar regras de voz e membros
        </Link>
      </Card>

      {showForm && (
        <Card className="border-brand-700">
          <div className="flex flex-wrap gap-2 mb-4">
            {(['text', 'voice', 'guild'] as const).map(t => {
              const Icon = MONITOR_ICONS[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setMonitorType(t)
                    setSelectedChannel(null)
                    if (t === 'guild' && selectedGuild) setStep('channel')
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    monitorType === t
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-brand-600/50'
                  }`}
                >
                  <Icon size={13} /> {MONITOR_LABELS[t]}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-[var(--rz-text-muted)] mb-4">
            {monitorType === 'text' && 'Encaminha novas mensagens do canal (inclui threads e fóruns se o canal pai estiver monitorado).'}
            {monitorType === 'voice' && 'Alerta quando alguém entra ou sai de um canal de voz (exige regra voice_join / voice_leave).'}
            {monitorType === 'guild' && 'Monitora entrada, saída, kick e ban de membros no servidor inteiro.'}
          </p>

          <div className="flex items-center gap-2 text-xs text-[var(--rz-text-muted)] mb-4">
            <button
              onClick={() => { setStep('guild'); setSelectedChannel(null) }}
              className={step === 'guild' ? 'text-brand-400 font-medium' : 'hover:text-[var(--rz-text-primary)]'}
            >
              Discord
            </button>
            {selectedGuild && (
              <>
                <ChevronRight size={12} />
                <button
                  onClick={() => setStep('channel')}
                  className={step === 'channel' ? 'text-brand-400 font-medium' : 'hover:text-[var(--rz-text-primary)]'}
                >
                  {selectedGuild.name}
                </button>
              </>
            )}
          </div>

          {step === 'guild' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">Selecione o servidor</p>
              {loadingGuilds && <LoadingState rows={2} className="py-2" />}
              {guilds.map(g => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGuild(g); setStep('channel') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-[var(--rz-surface-muted)] hover:bg-[var(--rz-surface-muted)]/80 rounded-lg transition-colors text-left"
                >
                  {g.icon
                    ? <img src={g.icon} alt={g.name} className="w-8 h-8 rounded-full" />
                    : <div className="w-8 h-8 rounded-full bg-[var(--rz-surface-muted)] flex items-center justify-center text-xs font-bold text-[var(--rz-text-muted)]">
                        {g.name[0]}
                      </div>}
                  <span className="text-sm font-medium">{g.name}</span>
                  <ChevronRight size={14} className="ml-auto text-[var(--rz-text-muted)]" />
                </button>
              ))}
            </div>
          )}

          {step === 'channel' && selectedGuild && monitorType === 'guild' && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--rz-text-secondary)]">
                Ativar monitor de <strong>eventos de membros</strong> em{' '}
                <span className="text-brand-400">{selectedGuild.name}</span>
              </p>
              {guildEventsAdded && <Badge label="já configurado" variant="gray" />}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => add.mutate()}
                  disabled={add.isPending || guildEventsAdded}
                >
                  {add.isPending ? <Spinner size={12} /> : <Users size={12} />}
                  Ativar eventos do servidor
                </Button>
                <Button variant="ghost" onClick={() => setStep('guild')}>Voltar</Button>
              </div>
            </div>
          )}

          {step === 'channel' && selectedGuild && monitorType !== 'guild' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">
                Canal de {monitorType === 'voice' ? 'voz' : 'texto'} em{' '}
                <span className="text-brand-400">{selectedGuild.name}</span>
              </p>
              {loadingChannels && <LoadingState rows={2} className="py-2" />}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {guildChannels.map(ch => {
                  const added = alreadyAdded(ch.id, monitorType)
                  return (
                    <button
                      key={ch.id}
                      onClick={() => !added && setSelectedChannel(
                        selectedChannel?.id === ch.id ? null : ch,
                      )}
                      disabled={added}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm ${
                        added
                          ? 'opacity-40 cursor-not-allowed bg-[var(--rz-surface-muted)]'
                          : selectedChannel?.id === ch.id
                            ? 'bg-brand-600 text-white'
                            : 'bg-[var(--rz-surface-muted)] hover:bg-[var(--rz-surface-muted)]/80 text-[var(--rz-text-secondary)]'
                      }`}
                    >
                      {monitorType === 'voice' ? <Mic size={13} /> : <Hash size={13} />}
                      <span className="truncate">{ch.name}</span>
                      <Badge
                        label={ch.typeLabel ?? discordChannelTypeLabel(ch.type)}
                        variant="gray"
                      />
                      {added && <Badge label="já adicionado" variant="gray" />}
                    </button>
                  )
                })}
              </div>
              {selectedChannel && (
                <div className="flex gap-2 pt-3 border-t border-[var(--rz-border)]">
                  <Button onClick={() => add.mutate()} disabled={add.isPending}>
                    {add.isPending ? <Spinner size={12} /> : <Plus size={12} />}
                    Adicionar {selectedChannel.name}
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedChannel(null)}>Cancelar</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {editingFilters && (
        <Card className="border-amber-700/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Settings2 size={14} /> Filtros — {editingFilters.channelName || editingFilters.channelId}
            </p>
            <button onClick={() => setEditingFilters(null)} className="text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]">
              <X size={16} />
            </button>
          </div>
          {(editingFilters.monitorType ?? 'text') === 'text' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Keywords (vírgula)</label>
                <input className={inputCls} value={filterForm.keywords}
                  onChange={e => setFilterForm(f => ({ ...f, keywords: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Excluir keywords</label>
                <input className={inputCls} value={filterForm.excludeKeywords}
                  onChange={e => setFilterForm(f => ({ ...f, excludeKeywords: e.target.value }))} />
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                {[
                  ['allowBots', 'Permitir bots'],
                  ['requireLink', 'Exigir link'],
                  ['requireImage', 'Exigir imagem'],
                  ['requireEmbed', 'Exigir embed'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterForm[key as keyof typeof filterForm] as boolean}
                      onChange={e => setFilterForm(f => ({ ...f, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">
                  IDs de bots permitidos (vírgula, vazio = todos)
                </label>
                <input
                  className={inputCls}
                  placeholder="123456789012345678"
                  value={filterForm.allowedBotIds}
                  onChange={e => setFilterForm(f => ({ ...f, allowedBotIds: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">
                  IDs de usuários permitidos (vírgula, vazio = todos)
                </label>
                <input
                  className={inputCls}
                  placeholder="123456789012345678"
                  value={filterForm.allowedUserIds}
                  onChange={e => setFilterForm(f => ({ ...f, allowedUserIds: e.target.value }))}
                />
              </div>
            </div>
          )}
          {(editingFilters.monitorType ?? 'text') !== 'text' && (
            <p className="text-xs text-[var(--rz-text-muted)] mb-3">
              Filtros de mensagem não se aplicam. Configure regras em{' '}
              <Link to="/discord/rules" className="text-brand-400 hover:underline">Regras</Link>.
            </p>
          )}
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">
              Cooldown por usuário (segundos)
            </label>
            <input
              className={inputCls}
              type="number"
              min={0}
              placeholder="Padrão: voz 60s · membros 30s"
              value={filterForm.eventCooldownSec}
              onChange={e => setFilterForm(f => ({ ...f, eventCooldownSec: e.target.value }))}
            />
            <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">
              Evita spam em reconexões rápidas na chamada. Vazio = padrão do sistema.
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={() => saveFilters.mutate()} disabled={saveFilters.isPending}>
              {saveFilters.isPending ? <Spinner size={12} /> : <Check size={12} />} Salvar
            </Button>
          </div>
        </Card>
      )}

      {isLoading && <LoadingState rows={4} className="pt-6" />}

      {!isLoading && channels.length === 0 && !showForm && (
        <Card className="text-center py-12 text-[var(--rz-text-muted)]">
          <Hash size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum monitor configurado</p>
          <p className="text-sm mt-1 mb-4">Texto, voz ou eventos do servidor — escolha o tipo ao adicionar.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={12} /> Adicionar monitor
          </Button>
        </Card>
      )}

      <div className="space-y-2">
        {channels.map(ch => {
          const type = ch.monitorType ?? 'text'
          const Icon = MONITOR_ICONS[type]
          return (
            <Card key={ch._id}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[var(--rz-surface-muted)] rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-medium text-sm">
                      {type === 'guild'
                        ? ch.channelName || 'Eventos do servidor'
                        : ch.channelName ? `#${ch.channelName}` : ch.channelId}
                    </span>
                    {monitorBadge(type)}
                    <Badge label={ch.isActive ? 'Ativo' : 'Inativo'} variant={ch.isActive ? 'green' : 'gray'} />
                  </div>
                  <p className="text-xs text-[var(--rz-text-muted)]">
                    {ch.guildName || ch.guildId}
                    {type !== 'guild' && (
                      <>
                        {' · '}
                        <span className="font-mono">{ch.channelId}</span>
                      </>
                    )}
                  </p>
                  {ch.filters?.keywords?.length > 0 && (
                    <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">
                      Keywords: {ch.filters.keywords.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openFilters(ch)}
                    className="text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]"
                    title="Configurações"
                  >
                    <Settings2 size={16} />
                  </button>
                  {(type === 'voice' || type === 'guild' || type === 'text') && (
                    <button
                      onClick={() => setHistoryOpenId(historyOpenId === ch._id ? null : ch._id)}
                      className="text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]"
                      title="Histórico"
                    >
                      <History size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => toggle.mutate(ch._id)}
                    disabled={toggle.isPending}
                    className="text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]"
                    title={ch.isActive ? 'Desativar' : 'Ativar'}
                  >
                    {ch.isActive
                      ? <ToggleRight size={22} className="text-brand-500" />
                      : <ToggleLeft size={22} />}
                  </button>
                  <button
                    onClick={() => { if (window.confirm('Remover este monitor?')) remove.mutate(ch._id) }}
                    disabled={remove.isPending}
                    className="text-[var(--rz-text-muted)] hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {historyOpenId === ch._id && (
                <MonitorHistoryPanel monitorId={ch._id} />
              )}
            </Card>
          )
        })}
      </div>
    </DiscordPage>
  )
}
