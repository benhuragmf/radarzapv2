import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { DiscordPage } from '../components/discord/DiscordPage'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DestinationRow, type Destination } from '../lib/destinationUi'
import { avatarLabel, formatWaSessionLabel } from '../lib/destinationFormat'
import { Plus, RefreshCw, Search, Smartphone, Users, AlertCircle } from 'lucide-react'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../lib/notify'
import { inputCls, EmptyState, LoadingState, RadarPageShell, PageHeader, MetricCard } from '@/design-system'

interface WAGroup {
  id: string
  name: string
  participantsCount: number
  isAdmin: boolean
}

interface Session {
  clientId: string
  status: string
  profileName?: string
  phoneNumber?: string
}

export default function WhatsAppGroups() {
  const qc = useQueryClient()
  const isDiscord = useLocation().pathname.startsWith('/discord')
  const [search, setSearch] = useState('')

  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
    refetchInterval: 30_000,
  })

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
  })

  const connectedSession = sessions.find(s => s.status === 'connected')

  const { data: waGroups = [], isLoading: loadingGroups, refetch: refetchGroups } = useQuery<WAGroup[]>({
    queryKey: ['wa-groups', connectedSession?.clientId],
    queryFn: () =>
      connectedSession
        ? api.get(`/sessions/${connectedSession.clientId}/groups`)
        : Promise.resolve([]),
    enabled: !!connectedSession,
  })

  const addGroup = useMutation({
    mutationFn: (g: WAGroup) =>
      api.post('/destinations', { type: 'group', identifier: g.id, name: g.name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['destinations'] }),
    onError: mutationError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/destinations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['destinations'] }),
  })

  const registeredIds = useMemo(
    () => new Set(destinations.map(d => d.identifier)),
    [destinations],
  )

  const q = search.trim().toLowerCase()
  const groups = useMemo(
    () =>
      destinations
        .filter(d => d.type === 'group')
        .filter(
          d =>
            !q ||
            d.name.toLowerCase().includes(q) ||
            d.identifier.toLowerCase().includes(q),
        ),
    [destinations, q],
  )

  const prefix = isDiscord ? '/discord' : ''

  const body = (
    <>
      <p className="text-sm text-gray-400">
        Grupos só podem ser adicionados importando da sua sessão WhatsApp conectada — não há cadastro
        manual por ID.
      </p>

      {!connectedSession && (
        <Card className="flex items-start gap-3 border-amber-800/50 bg-amber-950/20">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-200">WhatsApp desconectado</p>
            <Link to="/sessions" className="text-xs text-brand-400 hover:underline mt-2 inline-block">
              Ir para Conexão WhatsApp
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <MetricCard title="Grupos cadastrados" value={groups.length} icon={Users} />
        <MetricCard title="Na sessão WA" value={waGroups.length} icon={Smartphone} />
      </div>

      {connectedSession && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone size={18} className="text-brand-500" />
              <h2 className="text-sm font-semibold text-white">Importar do WhatsApp</h2>
            </div>
            <button
              type="button"
              onClick={() => refetchGroups()}
              className="text-gray-500 hover:text-white flex items-center gap-1 text-xs"
            >
              <RefreshCw size={13} /> Atualizar lista
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Sessão:{' '}
            {formatWaSessionLabel({
              phoneNumber: connectedSession.phoneNumber,
              profileName: connectedSession.profileName,
              fallback: 'Conectada',
            })}
          </p>

          {loadingGroups && <LoadingState rows={3} className="py-4" />}

          {!loadingGroups && waGroups.length === 0 && (
            <EmptyState
              title="Nenhum grupo encontrado"
              description="Nenhum grupo encontrado nesta sessão WhatsApp."
            />
          )}

          {!loadingGroups && waGroups.length > 0 && (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {waGroups.map(g => {
                const added = registeredIds.has(g.id)
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-4 py-3 px-4 rounded-lg bg-gray-800/30 border border-gray-800"
                  >
                    <img src={avatarLabel(g.name)} alt="" className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        {g.isAdmin && <Badge label="admin" variant="yellow" />}
                      </div>
                      <p className="text-xs text-gray-500">{g.participantsCount} participantes</p>
                    </div>
                    {added ? (
                      <Badge label="cadastrado" variant="green" />
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addGroup.mutate(g)}
                        disabled={addGroup.isPending}
                      >
                        <Plus size={11} /> Adicionar
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-brand-500" />
          <h2 className="text-sm font-semibold text-white">Grupos já cadastrados</h2>
        </div>
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar grupo..."
            className={`${inputCls} pl-9`}
          />
        </div>
        {groups.length === 0 ? (
          <EmptyState
            title="Nenhum grupo cadastrado"
            description="Importe da lista acima quando o WhatsApp estiver conectado."
          />
        ) : (
          <div className="space-y-2">
            {groups.map(d => (
              <DestinationRow
                key={d._id}
                d={d}
                removing={remove.isPending}
                onRemove={() => remove.mutate(d._id)}
              />
            ))}
          </div>
        )}
      </section>

      <Link to={`${prefix}/contact`} className="text-xs text-brand-400 hover:underline">
        ← Voltar para Contatos
      </Link>
    </>
  )

  if (isDiscord) {
    return (
      <DiscordPage description="Grupos do WhatsApp para usar nas regras do Discord. Importe da sessão conectada.">
        {body}
      </DiscordPage>
    )
  }

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Grupos WhatsApp"
        subtitle="Importe grupos da sessão conectada para usar em campanhas e automações."
      />
      {body}
    </RadarPageShell>
  )
}
