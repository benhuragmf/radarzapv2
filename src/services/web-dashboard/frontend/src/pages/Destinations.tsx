import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getMe, can, isCompanyOwner, type AuthUser } from '../lib/auth'
import { useGuild } from '../lib/guildContext'
import { DiscordPage } from '../components/discord/DiscordPage'
import { Card, CardTitle, CardValue } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { isUnlimited } from '../lib/limits'
import ContactGroupsSidebar, { type ContactGroupItem } from '../components/contacts/ContactGroupsSidebar'
import ContactEditorModal, { type ContactFormData } from '../components/contacts/ContactEditorModal'
import { effectiveConsentStatus, type ConsentStatus } from '../lib/consentUi'
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
  FolderOpen,
  Pencil,
} from 'lucide-react'
import {
  DestinationRow,
  inputCls,
  type Destination,
} from '../lib/destinationUi'

export default function Destinations() {
  const qc = useQueryClient()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const consentFilter = searchParams.get('consent') as
    | 'pending'
    | 'accepted'
    | 'refused'
    | 'blocked'
    | null
  const isDiscord = pathname.startsWith('/discord/contact')
  const basePath = isDiscord ? '/discord/contact' : '/contact'
  const { guildName } = useGuild()
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<
    | { mode: 'create'; initial: ContactFormData }
    | { mode: 'edit'; contact: Destination; initial: ContactFormData }
    | null
  >(null)
  const [historyDestId, setHistoryDestId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const emptyContactForm = (groupIds: string[] = []): ContactFormData => ({
    identifier: '',
    name: '',
    email: '',
    organization: '',
    notes: '',
    contactGroupIds: groupIds,
  })

  const contactToForm = (d: Destination): ContactFormData => ({
    identifier: d.identifier,
    name: d.name,
    email: d.email ?? '',
    organization: d.organization ?? '',
    notes: d.notes ?? '',
    contactGroupIds: (d.contactGroupIds ?? []).map(String),
  })

  const openCreateEditor = () => {
    setEditor({
      mode: 'create',
      initial: emptyContactForm(selectedGroupId ? [selectedGroupId] : []),
    })
  }

  const openEditEditor = (contact: Destination) => {
    setEditor({
      mode: 'edit',
      contact,
      initial: contactToForm(contact),
    })
  }

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

  const { data: contactGroups = [], isLoading: loadingGroups } = useQuery<ContactGroupItem[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
    refetchInterval: 30_000,
  })

  const invalidateContacts = () => {
    qc.invalidateQueries({ queryKey: ['destinations'] })
    qc.invalidateQueries({ queryKey: ['contact-groups'] })
  }

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

  const createContact = useMutation({
    mutationFn: (data: ContactFormData) =>
      api.post<Destination>('/destinations', {
        type: 'contact',
        identifier: data.identifier,
        name: data.name,
        email: data.email || undefined,
        organization: data.organization || undefined,
        notes: data.notes || undefined,
        contactGroupIds: data.contactGroupIds,
      }),
    onSuccess: (_created, variables) => {
      invalidateContacts()
      setEditor(null)
      if (variables.contactGroupIds.length === 0) {
        setSelectedGroupId(null)
      } else if (
        selectedGroupId &&
        !variables.contactGroupIds.includes(selectedGroupId)
      ) {
        setSelectedGroupId(null)
      }
    },
    onError: (err: Error) => alert(err.message),
  })

  const updateContact = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContactFormData }) =>
      api.patch(`/destinations/${id}`, {
        name: data.name,
        email: data.email || undefined,
        organization: data.organization || undefined,
        notes: data.notes || undefined,
        contactGroupIds: data.contactGroupIds,
      }),
    onSuccess: (_res, { data }) => {
      invalidateContacts()
      setEditor(null)
      if (selectedGroupId && !data.contactGroupIds.includes(selectedGroupId)) {
        setSelectedGroupId(null)
      }
    },
    onError: (err: Error) => alert(err.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/destinations/${id}`),
    onSuccess: invalidateContacts,
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
    onSuccess: invalidateContacts,
    onError: (err: Error) => alert(err.message),
  })

  const approveRenewal = useMutation({
    mutationFn: (id: string) => api.post(`/consent/renewals/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consent-renewals'] })
      invalidateContacts()
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

  function matchesConsentFilter(d: Destination): boolean {
    if (!consentFilter) return true
    const st = effectiveConsentStatus(
      d.consentStatus as ConsentStatus | undefined,
      d.consent?.granted,
    )
    if (consentFilter === 'pending') return st === 'PENDING'
    if (consentFilter === 'accepted') return st === 'ACCEPTED'
    if (consentFilter === 'refused') {
      return st === 'REFUSED_FIRST' || st === 'REFUSED_SECOND' || st === 'REFUSED_THREE'
    }
    if (consentFilter === 'blocked') return st === 'MANUALLY_BLOCKED'
    return true
  }

  const consentFilterLabel: Record<string, string> = {
    pending: 'Pendentes',
    accepted: 'Aceitos',
    refused: 'Recusados',
    blocked: 'Bloqueados manualmente',
  }

  const q = search.trim().toLowerCase()
  const allContacts = useMemo(
    () => destinations.filter(d => d.type === 'contact'),
    [destinations],
  )

  const contacts = useMemo(
    () =>
      allContacts
        .filter(matchesConsentFilter)
        .filter(d => {
          if (!selectedGroupId) return true
          return (d.contactGroupIds ?? []).some(gid => String(gid) === selectedGroupId)
        })
        .filter(
          d =>
            !q ||
            d.name.toLowerCase().includes(q) ||
            d.identifier.toLowerCase().includes(q) ||
            (d.organization?.toLowerCase().includes(q) ?? false) ||
            (d.email?.toLowerCase().includes(q) ?? false) ||
            (d.tags?.some(t => t.toLowerCase().includes(q)) ?? false) ||
            (d.secondaryPhone?.toLowerCase().includes(q) ?? false),
        ),
    [allContacts, q, consentFilter, selectedGroupId],
  )

  const groupNameById = useMemo(
    () => new Map(contactGroups.map(g => [g._id, g.name])),
    [contactGroups],
  )

  const selectedGroup = selectedGroupId
    ? contactGroups.find(g => g._id === selectedGroupId)
    : null

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
          Gerencie contatos, organize em grupos (VIP, Clientes…) e use no envio manual e na API.
          Grupos WhatsApp são importados pela sessão —{' '}
          <Link to="/grupos" className="text-brand-400 hover:underline">
            ver Grupos WhatsApp
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
        <Card>
          <CardTitle>Contatos</CardTitle>
          <CardValue>{allContacts.length}</CardValue>
        </Card>
        <Card>
          <CardTitle>Grupos de contato</CardTitle>
          <CardValue>{contactGroups.length}</CardValue>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardTitle>Total cadastrado</CardTitle>
          <CardValue>
            {destinations.length}
            {destLimit !== undefined && !isUnlimited(destLimit) && (
              <span className="text-sm text-gray-500 font-normal"> / {destLimit}</span>
            )}
          </CardValue>
        </Card>
      </div>

      {!isDiscord && consentFilter && (
        <p className="text-xs text-brand-400/90">
          Filtro: <strong>{consentFilterLabel[consentFilter]}</strong>
          {' · '}
          <Link to={basePath} className="underline hover:text-brand-300">
            Ver todos os contatos
          </Link>
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <ContactGroupsSidebar
          groups={contactGroups}
          totalContacts={allContacts.length}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          canManage={canManage}
          loading={loadingGroups}
          onCreate={async data => {
            await api.post('/contact-groups', data)
            invalidateContacts()
          }}
          onUpdate={async (id, data) => {
            await api.patch(`/contact-groups/${id}`, data)
            invalidateContacts()
          }}
          onDelete={async id => {
            await api.delete(`/contact-groups/${id}`)
            invalidateContacts()
          }}
        />

        <div className="flex-1 min-w-0 space-y-4 w-full">
          {selectedGroup && (
            <p className="text-xs text-gray-500">
              Exibindo contatos do grupo <strong className="text-gray-300">{selectedGroup.name}</strong>
              {' · '}
              <button
                type="button"
                onClick={() => setSelectedGroupId(null)}
                className="text-brand-400 hover:underline"
              >
                Ver todos
              </button>
            </p>
          )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nome, número, empresa ou e-mail..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <Button size="sm" onClick={openCreateEditor} disabled={atDestLimit || !canManage}>
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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : allContacts.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <Phone size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum contato cadastrado</p>
          <p className="text-sm mt-1">Adicione um número com DDI, ex: +5511999999999</p>
        </Card>
      ) : contacts.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <FolderOpen size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">
            {selectedGroup ? 'Nenhum contato neste grupo' : 'Nenhum resultado'}
          </p>
          <p className="text-sm mt-1">
            {selectedGroup
              ? 'Edite um contato e marque este grupo, ou cadastre um novo já no grupo.'
              : 'Ajuste a busca ou o filtro de consentimento.'}
          </p>
          {selectedGroup && (
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => setSelectedGroupId(null)}>
              Ver todos os contatos
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {contacts.map(d => {
            const memberGroupIds = (d.contactGroupIds ?? []).map(String)
            return (
            <div key={d._id} className="relative">
              <DestinationRow
                d={d}
                removing={remove.isPending}
                onRemove={() => remove.mutate(d._id)}
                canDelete={canManage}
                canEdit={canManage}
                onEdit={() => openEditEditor(d)}
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
              <div className="flex flex-wrap items-center gap-2 px-4 -mt-1 mb-1">
                {memberGroupIds.some(id => groupNameById.has(id)) && (
                  <div className="flex flex-wrap gap-1">
                    {memberGroupIds.map(id => {
                      const label = groupNameById.get(id)
                      if (!label) return null
                      return (
                      <span
                        key={id}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800/60 text-gray-400"
                      >
                        {label}
                      </span>
                      )
                    })}
                  </div>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => openEditEditor(d)}
                    className="text-[11px] text-brand-400 hover:underline flex items-center gap-1 ml-auto"
                  >
                    <Pencil size={11} /> Editar / grupos
                  </button>
                )}
              </div>
            </div>
            )
          })}
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
        </div>
      </div>

      {editor && (
        <ContactEditorModal
          mode={editor.mode}
          contactName={editor.mode === 'edit' ? editor.contact.name : undefined}
          contactPhone={editor.mode === 'edit' ? editor.contact.identifier : undefined}
          initial={editor.initial}
          groups={contactGroups}
          onClose={() => setEditor(null)}
          onSave={async data => {
            if (editor.mode === 'create') {
              await createContact.mutateAsync(data)
            } else {
              await updateContact.mutateAsync({ id: editor.contact._id, data })
            }
          }}
        />
      )}
    </>
  )

  if (isDiscord) {
    return (
      <DiscordPage description="Contatos WhatsApp, grupos de segmentação e consentimento LGPD para automação Discord.">
        {body}
      </DiscordPage>
    )
  }

  return <div className="space-y-5 max-w-6xl">{body}</div>
}
