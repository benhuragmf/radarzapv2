import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { can, getMe } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import {
  ClipboardCopy,
  ExternalLink,
  FileInput,
  MessageSquare,
  Phone,
  Plus,
  Search,
  UserPlus,
} from 'lucide-react'
import { notifySuccess, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState, EmptyState, searchFieldIconCls } from '@/design-system'
import type { LeadCaptureListItem, LeadCaptureStatus } from '@radarzap-types/lead-form'
import { LEAD_CAPTURE_STATUS_LABEL } from '@radarzap-types/lead-form'

type LeadFormRow = {
  id: string
  name: string
  publicKey: string
  active: boolean
  allowedDomains: string[]
  appearance: {
    title: string
    description: string
    buttonText: string
    successMessage: string
    primaryColor: string
    askEmail: boolean
    requireEmail: boolean
    askMessage: boolean
    requireMessage: boolean
  }
  redirectUrl?: string
}

function embedSnippet(publicKey: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://SEU-PAINEL'
  return `<script src="${origin}/leads/form.js" data-form-key="${publicKey}" async></script>`
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}`
}

export default function Leads() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'captures' | 'forms'>('captures')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadCaptureStatus | ''>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingFormId, setEditingFormId] = useState<string | null>(null)

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe })
  const canManage = can(me ?? null, 'send:destination:manage')
  const canView = can(me ?? null, 'consent:view')
  const canReply = can(me ?? null, 'inbox:reply')

  const captureQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set('search', search.trim())
    if (statusFilter) p.set('status', statusFilter)
    p.set('limit', '50')
    return p.toString()
  }, [search, statusFilter])

  const { data: capturesData, isLoading: loadingCaptures } = useQuery({
    queryKey: ['leads-captures', captureQuery],
    queryFn: () =>
      api.get<{ items: LeadCaptureListItem[]; total: number }>(`/leads/captures?${captureQuery}`),
    enabled: canView && tab === 'captures',
  })

  const { data: forms = [], isLoading: loadingForms } = useQuery<LeadFormRow[]>({
    queryKey: ['leads-forms'],
    queryFn: () => api.get('/leads/forms'),
    enabled: canManage && tab === 'forms',
  })

  const selected = useMemo(
    () => capturesData?.items.find(c => c.id === selectedId) ?? null,
    [capturesData, selectedId],
  )

  const editingForm = useMemo(
    () => forms.find(f => f.id === editingFormId) ?? null,
    [forms, editingFormId],
  )

  const createForm = useMutation({
    mutationFn: (name: string) => api.post<LeadFormRow>('/leads/forms', { name }),
    onSuccess: data => {
      void qc.invalidateQueries({ queryKey: ['leads-forms'] })
      setEditingFormId(data.id)
      setTab('forms')
      notifySuccess('Formulário criado')
    },
    onError: mutationError,
  })

  const updateCapture = useMutation({
    mutationFn: (payload: { id: string; status?: LeadCaptureStatus; internalNotes?: string }) =>
      api.patch<LeadCaptureListItem>(`/leads/captures/${payload.id}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads-captures'] })
      notifySuccess('Lead atualizado')
    },
    onError: mutationError,
  })

  const openInbox = useMutation({
    mutationFn: (captureId: string) =>
      api.post<{ conversationId: string; created: boolean; assigned: boolean }>(
        `/leads/captures/${captureId}/open-inbox`,
        {},
      ),
    onSuccess: data => {
      void qc.invalidateQueries({ queryKey: ['leads-captures'] })
      notifySuccess(data.created ? 'Conversa iniciada no Inbox' : 'Conversa aberta no Inbox')
      navigate(`/platform/inbox?conv=${encodeURIComponent(data.conversationId)}`)
    },
    onError: mutationError,
  })

  const updateForm = useMutation({
    mutationFn: (payload: Partial<LeadFormRow> & { id: string }) =>
      api.patch(`/leads/forms/${payload.id}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads-forms'] })
      notifySuccess('Formulário salvo')
    },
    onError: mutationError,
  })

  if (!canView) {
    return (
      <PlatformPage title="Leads">
        <EmptyState title="Sem permissão" description="Você não pode visualizar leads nesta conta." />
      </PlatformPage>
    )
  }

  return (
    <PlatformPage
      title="Leads"
      description="Capturas de formulários embeddados no site da empresa."
    >
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('captures')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${
            tab === 'captures'
              ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 text-[var(--rz-primary)]'
              : 'border-[var(--rz-border)] text-[var(--rz-text-secondary)]'
          }`}
        >
          Capturas
        </button>
        {canManage && (
          <button
            type="button"
            onClick={() => setTab('forms')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              tab === 'forms'
                ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 text-[var(--rz-primary)]'
                : 'border-[var(--rz-border)] text-[var(--rz-text-secondary)]'
            }`}
          >
            Formulários
          </button>
        )}
      </div>

      {tab === 'captures' && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search size={16} className={searchFieldIconCls} />
              <input
                className={inputCls + ' pl-9'}
                placeholder="Buscar nome, telefone ou e-mail…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className={inputCls}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as LeadCaptureStatus | '')}
            >
              <option value="">Todos os status</option>
              {(Object.keys(LEAD_CAPTURE_STATUS_LABEL) as LeadCaptureStatus[]).map(s => (
                <option key={s} value={s}>
                  {LEAD_CAPTURE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>

            {loadingCaptures ? (
              <LoadingState rows={5} />
            ) : !capturesData?.items.length ? (
              <EmptyState
                icon={UserPlus}
                title="Nenhum lead ainda"
                description="Crie um formulário e incorpore no site para começar a capturar."
              />
            ) : (
              <ul className="space-y-2">
                {capturesData.items.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedId === item.id
                          ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/5'
                          : 'border-[var(--rz-border)] hover:border-[var(--rz-primary)]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-[var(--rz-text-muted)] truncate">{item.phone}</p>
                        </div>
                        <Badge label={LEAD_CAPTURE_STATUS_LABEL[item.status]} variant="gray" />
                      </div>
                      <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">
                        {new Date(item.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3">
            {!selected ? (
              <Card>
                <p className="text-sm text-[var(--rz-text-muted)]">
                  Selecione um lead para ver detalhes e alterar status.
                </p>
              </Card>
            ) : (
              <LeadDetail
                item={selected}
                canManage={canManage}
                canReply={canReply}
                onUpdate={(patch) => updateCapture.mutate({ id: selected.id, ...patch })}
                onOpenInbox={() => openInbox.mutate(selected.id)}
                openingInbox={openInbox.isPending}
                pending={updateCapture.isPending}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'forms' && canManage && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                const name = window.prompt('Nome do formulário', 'Formulário principal')
                if (name?.trim()) createForm.mutate(name.trim())
              }}
              disabled={createForm.isPending}
            >
              <Plus size={16} /> Novo formulário
            </Button>
          </div>

          {loadingForms ? (
            <LoadingState rows={3} />
          ) : !forms.length ? (
            <EmptyState
              icon={FileInput}
              title="Nenhum formulário"
              description="Crie um formulário para gerar o código de incorporação."
            />
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {forms.map(form => (
                <Card key={form.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">{form.name}</h3>
                    <Badge label={form.active ? 'Ativo' : 'Inativo'} variant={form.active ? 'green' : 'gray'} />
                  </div>
                  <p className="text-xs text-[var(--rz-text-muted)] font-mono">{form.publicKey}</p>
                  <Button variant="secondary" size="sm" onClick={() => setEditingFormId(form.id)}>
                    Configurar / código embed
                  </Button>
                </Card>
              ))}
            </div>
          )}

          {editingForm && (
            <FormEditor
              form={editingForm}
              onClose={() => setEditingFormId(null)}
              onSave={patch => updateForm.mutate({ id: editingForm.id, ...patch })}
              pending={updateForm.isPending}
            />
          )}
        </div>
      )}
    </PlatformPage>
  )
}

function LeadDetail({
  item,
  canManage,
  canReply,
  onUpdate,
  onOpenInbox,
  openingInbox,
  pending,
}: {
  item: LeadCaptureListItem
  canManage: boolean
  canReply: boolean
  onUpdate: (patch: { status?: LeadCaptureStatus; internalNotes?: string }) => void
  onOpenInbox: () => void
  openingInbox: boolean
  pending: boolean
}) {
  const [notes, setNotes] = useState(item.internalNotes ?? '')

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{item.name}</h2>
        <p className="text-sm text-[var(--rz-text-muted)]">
          {item.formName} · {new Date(item.createdAt).toLocaleString('pt-BR')}
        </p>
      </div>

      <dl className="grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[var(--rz-text-muted)]">Telefone</dt>
          <dd className="font-medium">{item.phone}</dd>
        </div>
        {item.email && (
          <div>
            <dt className="text-[var(--rz-text-muted)]">E-mail</dt>
            <dd>{item.email}</dd>
          </div>
        )}
        {item.sourceUrl && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--rz-text-muted)]">Origem</dt>
            <dd className="truncate">{item.sourceUrl}</dd>
          </div>
        )}
        {item.message && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--rz-text-muted)]">Mensagem</dt>
            <dd className="whitespace-pre-wrap">{item.message}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        {canReply && (
          item.inboxConversationId ? (
            <Link
              to={`/platform/inbox?conv=${encodeURIComponent(item.inboxConversationId)}`}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 text-[var(--rz-primary)] hover:bg-[var(--rz-primary)]/15"
            >
              <MessageSquare size={14} /> Continuar no Inbox
            </Link>
          ) : (
            <Button
              size="sm"
              disabled={openingInbox}
              onClick={onOpenInbox}
            >
              <UserPlus size={14} /> Iniciar atendimento
            </Button>
          )
        )}
        <a
          href={waLink(item.phone)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)] hover:border-[var(--rz-primary)]"
        >
          <MessageSquare size={14} /> WhatsApp
        </a>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)]"
          onClick={() => {
            void navigator.clipboard.writeText(item.phone)
            notifySuccess('Telefone copiado')
          }}
        >
          <Phone size={14} /> Copiar telefone
        </button>
        {item.destinationId && (
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)]"
          >
            <ExternalLink size={14} /> Ver contato
          </Link>
        )}
        <Link
          to={`/platform/inbox?search=${encodeURIComponent(item.phone)}`}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)] hover:border-[var(--rz-primary)]"
        >
          <Search size={14} /> Buscar no Inbox
        </Link>
      </div>

      {canManage && (
        <>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Status</label>
            <select
              className={inputCls + ' mt-1'}
              value={item.status}
              disabled={pending}
              onChange={e => onUpdate({ status: e.target.value as LeadCaptureStatus })}
            >
              {(Object.keys(LEAD_CAPTURE_STATUS_LABEL) as LeadCaptureStatus[]).map(s => (
                <option key={s} value={s}>
                  {LEAD_CAPTURE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Observações internas</label>
            <textarea
              className={textareaCls + ' mt-1'}
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <Button
              size="sm"
              className="mt-2"
              disabled={pending}
              onClick={() => onUpdate({ internalNotes: notes })}
            >
              Salvar observações
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

function FormEditor({
  form,
  onClose,
  onSave,
  pending,
}: {
  form: LeadFormRow
  onClose: () => void
  onSave: (patch: Partial<LeadFormRow>) => void
  pending: boolean
}) {
  const [draft, setDraft] = useState(form)
  const snippet = embedSnippet(form.publicKey)

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Configurar: {form.name}</h3>
        <button type="button" className="text-sm text-[var(--rz-text-muted)]" onClick={onClose}>
          Fechar
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))}
        />
        Formulário ativo
      </label>

      <input
        className={inputCls}
        placeholder="Título"
        value={draft.appearance.title}
        onChange={e =>
          setDraft(d => ({ ...d, appearance: { ...d.appearance, title: e.target.value } }))
        }
      />
      <textarea
        className={textareaCls}
        rows={2}
        placeholder="Descrição"
        value={draft.appearance.description}
        onChange={e =>
          setDraft(d => ({ ...d, appearance: { ...d.appearance, description: e.target.value } }))
        }
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="Texto do botão"
          value={draft.appearance.buttonText}
          onChange={e =>
            setDraft(d => ({ ...d, appearance: { ...d.appearance, buttonText: e.target.value } }))
          }
        />
        <input
          className={inputCls}
          type="color"
          title="Cor primária"
          value={draft.appearance.primaryColor}
          onChange={e =>
            setDraft(d => ({ ...d, appearance: { ...d.appearance, primaryColor: e.target.value } }))
          }
        />
      </div>
      <textarea
        className={textareaCls}
        rows={2}
        placeholder="Mensagem de sucesso"
        value={draft.appearance.successMessage}
        onChange={e =>
          setDraft(d => ({
            ...d,
            appearance: { ...d.appearance, successMessage: e.target.value },
          }))
        }
      />

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.appearance.askEmail}
            onChange={e =>
              setDraft(d => ({ ...d, appearance: { ...d.appearance, askEmail: e.target.checked } }))
            }
          />
          Campo e-mail
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.appearance.askMessage}
            onChange={e =>
              setDraft(d => ({
                ...d,
                appearance: { ...d.appearance, askMessage: e.target.checked },
              }))
            }
          />
          Campo mensagem
        </label>
      </div>

      <div>
        <p className="text-xs text-[var(--rz-text-muted)] mb-2">Código para colar no site</p>
        <pre className="text-xs p-3 rounded-lg bg-[var(--rz-surface-muted)] overflow-x-auto">{snippet}</pre>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => {
            void navigator.clipboard.writeText(snippet)
            notifySuccess('Código copiado')
          }}
        >
          <ClipboardCopy size={14} /> Copiar embed
        </Button>
      </div>

      <Button disabled={pending} onClick={() => onSave(draft)}>
        Salvar formulário
      </Button>
    </Card>
  )
}
