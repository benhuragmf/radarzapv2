import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useGuild } from '../lib/guildContext'
import { DiscordPage } from '../components/discord/DiscordPage'
import { Card, CardTitle, CardValue } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
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

  const { data: destinations = [], isLoading } = useQuery<Destination[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
    refetchInterval: 30_000,
  })

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
          <CardTitle>Grupos cadastrados</CardTitle>
          <CardValue>{groupsCount}</CardValue>
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
        <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus size={12} /> Novo contato
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-brand-700/60">
          <p className="text-sm font-medium text-brand-400 mb-3">Cadastrar contato</p>
          <p className="text-xs text-gray-500 mb-3">
            Grupos não podem ser digitados manualmente — importe em{' '}
            <Link to={`${prefix}/grupos`} className="text-brand-400 hover:underline">
              Grupos
            </Link>
            .
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
              disabled={!form.identifier.trim() || !form.name.trim() || add.isPending}
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
            />
          ))}
        </div>
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
