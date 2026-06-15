import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useGuild } from '../lib/guildContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Link } from 'react-router-dom'
import { Hash, Plus, Trash2, ToggleLeft, ToggleRight, ChevronRight, BookOpen } from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../lib/notify'
import { MetricCard, LoadingState } from '@/design-system'

interface Channel {
  _id: string
  guildId: string
  channelId: string
  channelName: string
  guildName: string
  isActive: boolean
  filters: { keywords: string[] }
}

interface Guild {
  id: string
  name: string
  icon: string | null
}

interface DiscordChannel {
  id: string
  name: string
  type: number
}

export default function Channels() {
  const qc = useQueryClient()
  const { guildId } = useGuild()
  const [showForm, setShowForm] = useState(false)
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<DiscordChannel | null>(null)
  const [step, setStep] = useState<'guild' | 'channel'>('guild')

  const { data: channels = [], isLoading } = useQuery<Channel[]>({
    queryKey: ['channels', guildId],
    queryFn: () => api.get(`/channels${guildId ? `?guildId=${guildId}` : ''}`),
    refetchInterval: 30_000,
  })

  const { data: guilds = [], isLoading: loadingGuilds } = useQuery<Guild[]>({
    queryKey: ['discord-guilds'],
    queryFn: () => api.get('/discord/guilds'),
    enabled: showForm,
  })

  const { data: guildChannels = [], isLoading: loadingChannels } = useQuery<DiscordChannel[]>({
    queryKey: ['discord-channels', selectedGuild?.id],
    queryFn: () => api.get(`/discord/guilds/${selectedGuild!.id}/channels`),
    enabled: !!selectedGuild && step === 'channel',
  })

  const add = useMutation({
    mutationFn: () => api.post('/channels', {
      guildId:     selectedGuild!.id,
      channelId:   selectedChannel!.id,
      channelName: selectedChannel!.name,
      guildName:   selectedGuild!.name,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] })
      setShowForm(false)
      setSelectedGuild(null)
      setSelectedChannel(null)
      setStep('guild')
    },
    onError: mutationError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/channels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  })

  const toggle = useMutation({
    mutationFn: (id: string) => api.post(`/channels/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  })

  const alreadyAdded = (channelId: string) =>
    channels.some(c => c.channelId === channelId)

  const activeCount = channels.filter(c => c.isActive).length

  return (
    <DiscordPage
      description="Monitore canais do Discord selecionado. Novas mensagens nos canais ativos disparam as regras configuradas."
      actions={
        <Button size="sm" onClick={() => { setShowForm(v => !v); setStep('guild') }}>
          <Plus size={12} /> Adicionar canal
        </Button>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard title="Monitorados" value={channels.length} icon={Hash} />
        <MetricCard title="Ativos" value={activeCount} icon={ToggleRight} />
        <Card className="col-span-2 sm:col-span-1 flex items-center">
          <Link
            to="/discord/rules"
            className="text-xs text-brand-400 hover:underline flex items-center gap-1"
          >
            <BookOpen size={12} /> Configurar regras
          </Link>
        </Card>
      </div>

      {/* ── Picker form ── */}
      {showForm && (
        <Card className="border-brand-700">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
            <button
              onClick={() => { setStep('guild'); setSelectedChannel(null) }}
              className={step === 'guild' ? 'text-brand-400 font-medium' : 'hover:text-white'}
            >
              Discord
            </button>
            {selectedGuild && (
              <>
                <ChevronRight size={12} />
                <button
                  onClick={() => setStep('channel')}
                  className={step === 'channel' ? 'text-brand-400 font-medium' : 'hover:text-white'}
                >
                  {selectedGuild.name}
                </button>
              </>
            )}
            {selectedChannel && (
              <>
                <ChevronRight size={12} />
                <span className="text-brand-400 font-medium">#{selectedChannel.name}</span>
              </>
            )}
          </div>

          {/* Step 1 — choose guild */}
          {step === 'guild' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300 mb-3">Selecione o servidor</p>
              {loadingGuilds && <LoadingState rows={2} className="py-2" />}
              {guilds.map(g => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGuild(g); setStep('channel') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
                >
                  {g.icon
                    ? <img src={g.icon} alt={g.name} className="w-8 h-8 rounded-full" />
                    : <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
                        {g.name[0]}
                      </div>
                  }
                  <span className="text-sm font-medium">{g.name}</span>
                  <ChevronRight size={14} className="ml-auto text-gray-600" />
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — choose channel */}
          {step === 'channel' && selectedGuild && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300 mb-3">
                Selecione o canal em <span className="text-brand-400">{selectedGuild.name}</span>
              </p>
              {loadingChannels && <LoadingState rows={2} className="py-2" />}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {guildChannels.map(ch => {
                  const added = alreadyAdded(ch.id)
                  return (
                    <button
                      key={ch.id}
                      onClick={() => !added && setSelectedChannel(
                        selectedChannel?.id === ch.id ? null : ch
                      )}
                      disabled={added}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm ${
                        added
                          ? 'opacity-40 cursor-not-allowed bg-gray-800'
                          : selectedChannel?.id === ch.id
                            ? 'bg-brand-600 text-white'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      <Hash size={13} className="shrink-0" />
                      <span className="truncate">{ch.name}</span>
                      {added && <Badge label="já adicionado" variant="gray" />}
                    </button>
                  )
                })}
              </div>

              {selectedChannel && (
                <div className="flex gap-2 pt-3 border-t border-gray-800">
                  <Button onClick={() => add.mutate()} disabled={add.isPending}>
                    {add.isPending ? <Spinner size={12} /> : <Plus size={12} />}
                    Adicionar #{selectedChannel.name}
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedChannel(null)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {isLoading && <LoadingState rows={4} className="pt-6" />}

      {!isLoading && channels.length === 0 && !showForm && (
        <Card className="text-center py-12 text-gray-500">
          <Hash size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum canal monitorado</p>
          <p className="text-sm mt-1 mb-4">Adicione canais de texto para iniciar a automação.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={12} /> Adicionar canal
          </Button>
        </Card>
      )}

      <div className="space-y-2">
        {channels.map(ch => (
          <Card key={ch._id}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
                <Hash size={18} className="text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">
                    {ch.channelName ? `#${ch.channelName}` : ch.channelId}
                  </span>
                  <Badge label={ch.isActive ? 'Ativo' : 'Inativo'} variant={ch.isActive ? 'green' : 'gray'} />
                </div>
                <p className="text-xs text-gray-500">
                  {ch.guildName || ch.guildId}
                  {' · '}
                  <span className="font-mono text-gray-600">{ch.channelId}</span>
                </p>
                {ch.filters?.keywords?.length > 0 && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Keywords: {ch.filters.keywords.join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggle.mutate(ch._id)}
                  disabled={toggle.isPending}
                  className="text-gray-400 hover:text-white transition-colors"
                  title={ch.isActive ? 'Desativar' : 'Ativar'}
                >
                  {ch.isActive
                    ? <ToggleRight size={22} className="text-brand-500" />
                    : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => { if (window.confirm('Remover este canal?')) remove.mutate(ch._id) }}
                  disabled={remove.isPending}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </DiscordPage>
  )
}
