import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getMe, can, isCompanyOwner, type AuthUser } from '../lib/auth'
import { useGuild } from '../lib/guildContext'
import { DiscordPage } from '../components/discord/DiscordPage'
import { Card, CardTitle, CardValue } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { isUnlimited } from '../lib/limits'
import {
  DestinationRow,
  inputCls,
  type Destination,
} from '../lib/destinationUi'
import {
  Phone,
  Plus,
  Search,
  Hash,
  Send,
  AlertCircle,
  Users,
  BookOpen,
  ListOrdered,
  ScrollText,
  FileText,
} from 'lucide-react'

export default function Destinations() {
  const qc = useQueryClient()
  const { pathname } = useLocation()
  const isDiscord = pathname.startsWith('/discord/destinations')
  const { guildName } = useGuild()
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ identifier: '', name: '' })
  const [historyDestId, setHistoryDestId] = useState<string | null>(null)

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const canManage = can(me ?? null, 'send:destination:manage')
  const canRequestRenewal = can(me ?? null, 'consent:request-renewal')
  const canClearRefusal = isCompanyOwner(me ?? null)
  const canApproveRenewal = isCompanyOwner(me ?? null)

  const { data: destinations = [], isLoading } = useQuery<Destination[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
    refetchInterval: 30_000,
  })

  const { data: billing } = useQuery<{
    limits: { groupsMax: number }
  }>({
    queryKey: ['billing-me'],
    queryFn: () => api.get('/billing/me'),
  })

  const destLimit = billing?.limits.groupsMax
  const atDestLimit =
    destLimit !== undefined &&
    !isUnlimited(destLimit) &&
    destinations.length >= destLimit

  const add = useMutation({
    mutationFn: () =>
      api.post('/destinations', {
        type: 'contact',
        identifier: form.identifier,
        name: form.name,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['destinations'] })
      setShowAddForm(false)
      setForm({ identifier: '', name: '' })
    },
    onError: (err: Error) => alert(err.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/destinations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['destinations'] }),
    onError: (err: Error) => alert(err.message),
  })

  const requestRenewal = useMutation({
    mutationFn: (id: string) =>
      api.post(`/destinations/${id}/consent/request-renewal`, {
        reason: 'Solicitação via painel',
      }),
    onSuccess: () => {
      alert('Solicitação enviada ao dono da empresa para aprovação.')
      qc.invalidateQueries({ queryKey: ['consent-renewals'] })
    },
    onError: (err: Error) => alert(err.message),
  })

  const clearRefusal = useMutation({
    mutationFn: (id: string) => api.post(`/destinations/${id}/consent/clear-refusal`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['destinations'] }),
    onError: (err: Error) => alert(err.message),
  })

  const approveRenewal = useMutation({
    mutationFn: (id: string) => api.post(`/consent/renewals/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consent-renewals'] })
      qc.invalidateQueries({ queryKey: ['destinations'] })
    },
    onError: (err: Error) => alert(err.message),
  })

  const { data: renewals = [] } = useQuery<
    Array<{
      _id: string
      contactName: string
      phone: string
      previousStatus: string
      requestedByUsername: string
      createdAt: string
    }>
  >({
    queryKey: ['consent-renewals'],
    queryFn: () => api.get('/consent/renewals'),
    enabled: canApproveRenewal,
    refetchInterval: 30_000,
  })

  const { data: consentHistory = [] } = useQuery<
    Array<{
      _id: string
      previousStatus: string
      newStatus: string
      origin: string
      replyText?: string
      attemptNumber?: number
      requestedByUsername?: string
      createdAt: string
    }>
  >({
    queryKey: ['consent-history', historyDestId],
    queryFn: () => api.get(`/destinations/${historyDestId}/consent/history`),
    enabled: Boolean(historyDestId),
  })

  const q = search.trim().toLowerCase()
  const contacts = useMemo(
    () =>
      destinations
        .filter(d => d.type === 'contact')
        .filter(
          d =>
            !q ||
            d.name.toLowerCase().includes(q) ||
            d.identifier.toLowerCase().includes(q),
        ),
    [destinations, q],
  )

  const groupsCount = destinations.filter(d => d.type === 'group').length

  const prefix = isDiscord ? '/discord' : ''

  const body = (
    <>
      {isDiscord && (
        <Card className="border-gray-800 bg-gray-900/40 p-3">
          <p className="text-xs text-gray-500 mb-2">Atalhos da automação</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/discord/channels" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              <Hash size={12} /> Canais
            </Link>
            <Link to="/discord/rules" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              <BookOpen size={12} /> Regras
            </Link>
            <Link to="/discord/templates" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              <FileText size={12} /> Formato
            </Link>
            <Link to={`${prefix}/grupos`} className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              <Users size={12} /> Grupos ({groupsCount})
            </Link>
            <Link to="/discord/fila" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              <ListOrdered size={12} /> Fila
            </Link>
            <Link to="/discord/logs" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              <ScrollText size={12} /> Logs
            </Link>
          </div>
        </Card>
      )}

      {!isDiscord && (
        <p className="text-sm text-gray-400">
          Números de WhatsApp para envio manual e API. Grupos são importados pela sessão conectada —{' '}
          <Link to="/grupos" className="text-brand-400 hover:underline">
            ver Grupos
          </Link>
          .
        </p>
      )}

      {isDiscord && guildName && (
        <p className="text-xs text-brand-400/90 flex items-center gap-1.5">
          <Hash size={12} />
          Usados nas regras de <strong>{guildName}</strong> —{' '}
          <Link to="/discord/rules" className="underline hover:text-brand-300">
            configurar regras
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Card>
          <CardTitle>Contatos</CardTitle>
          <CardValue>{contacts.length}</CardValue>
        </Card>
        <Card>
          <CardTitle>Total cadastrado</CardTitle>
          <CardValue>
            {destinations.length}
            {destLimit !== undefined && !isUnlimited(destLimit) && (
              <span className="text-sm text-gray-500 font-normal"> / {destLimit}</span>
            )}
          </CardValue>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nome ou número..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)} disabled={atDestLimit || !canManage}>
          <Plus size={12} /> Novo contato
        </Button>
      </div>

      {canApproveRenewal && renewals.length > 0 && (
        <Card className="border-amber-700/40 bg-amber-950/20">
          <p className="text-sm font-medium text-amber-400 mb-2">
            Solicitações de novo aceite ({renewals.length})
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Apenas você (dono) pode liberar contatos que recusaram. Recusa definitiva (3x) não pode ser liberada.
          </p>
          <div className="space-y-2">
            {renewals.map(r => (
              <div
                key={r._id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 px-3 rounded-lg bg-gray-900/60 border border-gray-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.contactName}</p>
                  <p className="text-xs text-gray-500 font-mono">{r.phone}</p>
                  <p className="text-[11px] text-gray-600">
                    Status: {r.previousStatus} · por {r.requestedByUsername} ·{' '}
                    {new Date(r.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={approveRenewal.isPending || r.previousStatus === 'REFUSED_THREE'}
                  onClick={() => {
                    if (r.previousStatus === 'REFUSED_THREE') {
                      alert('Recusa definitiva (3x) — nem o dono consegue liberar. Contate o suporte RadarZap.')
                      return
                    }
                    if (window.confirm(`Aprovar novo aceite para ${r.contactName}?`)) {
                      approveRenewal.mutate(r._id)
                    }
                  }}
                >
                  Aprovar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {atDestLimit && (
        <p className="text-xs text-amber-500/90">
          Limite de destinos do plano ({destLimit}) atingido. Remova um destino ou faça upgrade em Planos.
        </p>
      )}

      {showAddForm && (
        <Card className="border-brand-700/60">
          <p className="text-sm font-medium text-brand-400 mb-3">Cadastrar contato</p>
          <p className="text-xs text-gray-500 mb-3">
            Novos contatos entram como <strong className="text-yellow-500">Aguardando aceite</strong>.
            Na primeira mensagem, o RadarZap envia automaticamente o pedido de consentimento LGPD.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Número WhatsApp</label>
              <input
                value={form.identifier}
                onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                placeholder="+5511999999999"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nome exibido</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Suporte, João"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => add.mutate()}
              disabled={
                !form.identifier.trim() ||
                !form.name.trim() ||
                add.isPending ||
                atDestLimit
              }
            >
              {add.isPending ? <Spinner size={12} /> : <Plus size={12} />} Salvar
            </Button>
            <Button variant="ghost" onClick={() => setShowAddForm(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : contacts.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <Phone size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum contato cadastrado</p>
          <p className="text-sm mt-1">Adicione um número com DDI, ex: +5511999999999</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {contacts.map(d => (
            <DestinationRow
              key={d._id}
              d={d}
              removing={remove.isPending}
              onRemove={() => remove.mutate(d._id)}
              canDelete={canManage}
              canRequestRenewal={canRequestRenewal}
              canClearRefusal={canClearRefusal}
              requestingRenewal={requestRenewal.isPending}
              clearingRefusal={clearRefusal.isPending}
              onRequestRenewal={() => requestRenewal.mutate(d._id)}
              onClearRefusal={() => {
                if (window.confirm(`Apagar recusa de "${d.name}" e voltar para aguardando aceite?`)) {
                  clearRefusal.mutate(d._id)
                }
              }}
              onShowHistory={() => setHistoryDestId(d._id)}
            />
          ))}
        </div>
      )}

      {historyDestId && (
        <Card className="border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium">Histórico de consentimento</p>
            <Button size="sm" variant="ghost" onClick={() => setHistoryDestId(null)}>
              Fechar
            </Button>
          </div>
          {consentHistory.length === 0 ? (
            <p className="text-xs text-gray-500">Nenhum registro ainda.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {consentHistory.map(h => (
                <li key={h._id} className="text-xs border-b border-gray-800 pb-2">
                  <span className="text-gray-400">{new Date(h.createdAt).toLocaleString('pt-BR')}</span>
                  {' · '}
                  {h.previousStatus} → {h.newStatus}
                  {' · '}
                  <span className="text-gray-500">{h.origin}</span>
                  {h.replyText && <span className="block text-gray-500 mt-0.5">Resposta: {h.replyText}</span>}
                  {h.attemptNumber != null && (
                    <span className="block text-gray-600">Tentativa {h.attemptNumber}</span>
                  )}
                  {h.requestedByUsername && (
                    <span className="block text-gray-600">Por: {h.requestedByUsername}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
        <Link to="/send">
          <Button size="sm" variant="secondary">
            <Send size={12} /> Enviar agora
          </Button>
        </Link>
        <Link to={`${prefix}/grupos`}>
          <Button size="sm" variant="ghost">
            <Users size={12} /> Grupos WhatsApp
          </Button>
        </Link>
      </div>
    </>
  )

  if (isDiscord) {
    return (
      <DiscordPage description="Contatos de WhatsApp usados nas regras do Discord e no envio manual.">
        {body}
      </DiscordPage>
    )
  }

  return <div className="space-y-5 max-w-4xl">{body}</div>
}
