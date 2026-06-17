import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Globe, MessageSquare, Plus, Copy, Trash2, Send, XCircle, Save, ExternalLink } from 'lucide-react'
import { notifySuccess, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState } from '@/design-system'
import { useWebChatSocket } from '../../hooks/useWebChatSocket'

interface WebChatWidgetRow {
  id: string
  name: string
  publicKey: string
  active: boolean
  allowedDomains: string[]
  appearance: {
    primaryColor: string
    position: 'left' | 'right'
    title: string
    subtitle: string
    greeting: string
    askName: boolean
    askEmail: boolean
  }
}

interface WebChatConversationRow {
  id: string
  status: 'open' | 'closed'
  visitorName?: string
  visitorEmail?: string
  pageUrl?: string
  lastMessageAt?: string
  lastMessagePreview?: string
  unreadCount?: number
  widgetName?: string
}

interface WebChatMessageRow {
  id: string
  direction: 'inbound' | 'outbound' | 'system'
  body: string
  createdAt: string
  senderName?: string
}

type Tab = 'chats' | 'widgets'
type ChatFilter = 'open' | 'closed'

function embedSnippet(publicKey: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://SEU-PAINEL'
  return `<script src="${origin}/webchat/widget.js" data-widget-key="${publicKey}" async></script>`
}

export default function WebChat() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('chats')
  const [chatFilter, setChatFilter] = useState<ChatFilter>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newWidgetName, setNewWidgetName] = useState('Site principal')

  const { data: me } = useQuery<AuthUser | null>({ queryKey: ['auth-me'], queryFn: getMe })
  const canView = can(me ?? null, 'webchat:view')
  const canManage = can(me ?? null, 'webchat:manage')
  const canReply = can(me ?? null, 'webchat:reply')

  useWebChatSocket(canView)

  const { data: widgets, isLoading: loadingWidgets } = useQuery({
    queryKey: ['webchat-widgets'],
    queryFn: () => api.get<WebChatWidgetRow[]>('/webchat/widgets'),
    enabled: canManage,
  })

  const { data: stats } = useQuery({
    queryKey: ['webchat-stats'],
    queryFn: () => api.get<{ openCount: number; unreadCount: number }>('/webchat/stats'),
    enabled: canView,
    refetchInterval: 30_000,
  })

  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['webchat-conversations', chatFilter],
    queryFn: () =>
      api.get<WebChatConversationRow[]>(`/webchat/conversations?status=${chatFilter}`),
    enabled: canView,
    refetchInterval: 30_000,
  })

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['webchat-conversation', selectedId],
    queryFn: () =>
      api.get<{ conversation: WebChatConversationRow; messages: WebChatMessageRow[] }>(
        `/webchat/conversations/${selectedId}`,
      ),
    enabled: canView && !!selectedId,
  })

  useEffect(() => {
    setSelectedId(null)
  }, [chatFilter])

  useEffect(() => {
    if (!selectedId && conversations?.length) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations, selectedId])

  const createWidget = useMutation({
    mutationFn: () => api.post<WebChatWidgetRow>('/webchat/widgets', { name: newWidgetName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifySuccess('Widget criado')
      setTab('widgets')
    },
    onError: mutationError,
  })

  const deleteWidget = useMutation({
    mutationFn: (id: string) => api.delete(`/webchat/widgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifySuccess('Widget removido')
    },
    onError: mutationError,
  })

  const sendMessage = useMutation({
    mutationFn: (body: string) => api.post(`/webchat/conversations/${selectedId}/messages`, { body }),
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['webchat-conversation', selectedId] })
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
    },
    onError: mutationError,
  })

  const closeChat = useMutation({
    mutationFn: () => api.post(`/webchat/conversations/${selectedId}/close`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-conversation', selectedId] })
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
      notifySuccess('Conversa encerrada')
    },
    onError: mutationError,
  })

  const selected = detail?.conversation
  const messages = detail?.messages ?? []

  const sortedConversations = useMemo(
    () => [...(conversations ?? [])].sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return tb - ta
    }),
    [conversations],
  )

  if (!canView) {
    return (
      <PlatformPage title="Chat do site" icon={Globe}>
        <Card className="p-6 text-sm text-[var(--rz-text-muted)]">
          Você não tem permissão para acessar o chat do site.
        </Card>
      </PlatformPage>
    )
  }

  return (
    <PlatformPage
      title="Chat do site"
      icon={Globe}
      description="Widget embedável para o seu website — atenda visitantes em tempo real pelo painel."
    >
      <Card className="mb-4 p-3 text-sm text-[var(--rz-text-muted)]">
        Teste local:{' '}
        <a className="text-[var(--rz-primary)] hover:underline" href="/webchat/widget.html" target="_blank" rel="noreferrer">
          /webchat/widget.html
        </a>
        {' · '}
        <a className="text-[var(--rz-primary)] hover:underline" href="/webchat/demo.html" target="_blank" rel="noreferrer">
          demo.html?key=…
        </a>
      </Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant={tab === 'chats' ? 'primary' : 'secondary'}
          onClick={() => setTab('chats')}
          type="button"
        >
          <MessageSquare className="h-4 w-4" />
          Conversas
        </Button>
        {canManage && (
          <Button
            variant={tab === 'widgets' ? 'primary' : 'secondary'}
            onClick={() => setTab('widgets')}
            type="button"
          >
            <Globe className="h-4 w-4" />
            Widgets
          </Button>
        )}
      </div>

      {tab === 'widgets' && canManage && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--rz-text)]">Novo widget</h3>
            <div className="flex flex-wrap gap-2">
              <input
                className={inputCls}
                value={newWidgetName}
                onChange={e => setNewWidgetName(e.target.value)}
                placeholder="Nome do widget"
              />
              <Button type="button" onClick={() => createWidget.mutate()} disabled={createWidget.isPending}>
                <Plus className="h-4 w-4" />
                Criar
              </Button>
            </div>
          </Card>

          {loadingWidgets ? (
            <LoadingState label="Carregando widgets..." />
          ) : (
            <div className="space-y-3">
              {(widgets ?? []).map(w => (
                <WidgetEditorCard
                  key={w.id}
                  widget={w}
                  onDelete={() => deleteWidget.mutate(w.id)}
                  deleting={deleteWidget.isPending}
                />
              ))}
              {!widgets?.length && (
                <Card className="p-6 text-sm text-[var(--rz-text-muted)]">
                  Nenhum widget ainda. Crie um e cole o script no HTML do seu site.
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'chats' && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rz-border)] px-4 py-3">
              <div className="text-sm font-semibold">
                {(stats?.unreadCount ?? 0) > 0 && (
                  <span className="mr-2 rounded-full bg-[var(--rz-primary)] px-2 py-0.5 text-xs text-white">
                    {stats!.unreadCount} nova(s)
                  </span>
                )}
                {chatFilter === 'open' ? 'Abertas' : 'Encerradas'} ({sortedConversations.length})
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={chatFilter === 'open' ? 'primary' : 'secondary'}
                  onClick={() => setChatFilter('open')}
                >
                  Abertas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={chatFilter === 'closed' ? 'primary' : 'secondary'}
                  onClick={() => setChatFilter('closed')}
                >
                  Encerradas
                </Button>
              </div>
            </div>
            {loadingConversations ? (
              <LoadingState label="Carregando..." />
            ) : (
              <ul className="max-h-[60vh] overflow-auto">
                {sortedConversations.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={
                        'w-full border-b border-[var(--rz-border)] px-4 py-3 text-left transition hover:bg-[var(--rz-surface-hover)] ' +
                        (selectedId === c.id ? 'bg-[var(--rz-surface-hover)]' : '')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--rz-text)]">
                          {c.visitorName || c.visitorEmail || 'Visitante'}
                        </span>
                        {(c.unreadCount ?? 0) > 0 && (
                          <span className="rounded-full bg-[var(--rz-primary)] px-2 py-0.5 text-xs text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-[var(--rz-text-muted)]">
                        {c.lastMessagePreview || 'Sem mensagens'}
                      </div>
                    </button>
                  </li>
                ))}
                {!sortedConversations.length && (
                  <li className="px-4 py-6 text-sm text-[var(--rz-text-muted)]">
                    {chatFilter === 'open' ? 'Nenhuma conversa aberta.' : 'Nenhuma conversa encerrada.'}
                  </li>
                )}
              </ul>
            )}
          </Card>

          <Card className="flex min-h-[60vh] flex-col overflow-hidden p-0">
            {!selectedId ? (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--rz-text-muted)]">
                Selecione uma conversa
              </div>
            ) : loadingDetail ? (
              <LoadingState label="Carregando conversa..." />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-[var(--rz-border)] px-4 py-3">
                  <div>
                    <div className="font-semibold text-[var(--rz-text)]">
                      {selected?.visitorName || selected?.visitorEmail || 'Visitante'}
                      {selected?.status === 'closed' && (
                        <span className="ml-2 text-xs font-normal text-[var(--rz-text-muted)]">(encerrada)</span>
                      )}
                    </div>
                    {selected?.pageUrl && (
                      <a
                        href={selected.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--rz-primary)] hover:underline"
                      >
                        Página de origem
                      </a>
                    )}
                  </div>
                  {canReply && selected?.status === 'open' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => closeChat.mutate()}
                      disabled={closeChat.isPending}
                    >
                      <XCircle className="h-4 w-4" />
                      Encerrar
                    </Button>
                  )}
                </div>

                <div className="flex-1 space-y-2 overflow-auto p-4">
                  {messages.map(m => (
                    <div
                      key={m.id}
                      className={
                        'flex ' + (m.direction === 'outbound' ? 'justify-end' : 'justify-start')
                      }
                    >
                      <div
                        className={
                          'max-w-[85%] rounded-2xl px-3 py-2 text-sm ' +
                          (m.direction === 'system'
                            ? 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]'
                            : m.direction === 'outbound'
                              ? 'bg-[var(--rz-primary)] text-white'
                              : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text)]')
                        }
                      >
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div className="mt-1 text-[10px] opacity-70">
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {canReply && selected?.status === 'open' && (
                  <form
                    className="flex gap-2 border-t border-[var(--rz-border)] p-3"
                    onSubmit={e => {
                      e.preventDefault()
                      if (!draft.trim()) return
                      sendMessage.mutate(draft.trim())
                    }}
                  >
                    <input
                      className={inputCls}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      placeholder="Responder visitante..."
                    />
                    <Button type="submit" disabled={sendMessage.isPending || !draft.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </PlatformPage>
  )
}

function WidgetEditorCard({
  widget,
  onDelete,
  deleting,
}: {
  widget: WebChatWidgetRow
  onDelete: () => void
  deleting: boolean
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState(widget)

  useEffect(() => {
    setForm(widget)
  }, [widget])

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/webchat/widgets/${widget.id}`, {
        name: form.name,
        active: form.active,
        allowedDomains: form.allowedDomains,
        appearance: form.appearance,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifySuccess('Widget atualizado')
    },
    onError: mutationError,
  })

  const snippet = embedSnippet(widget.publicKey)
  const demoUrl = `/webchat/demo.html?key=${encodeURIComponent(widget.publicKey)}`

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-[var(--rz-text)]">{widget.name}</div>
          <div className="mt-1 text-xs text-[var(--rz-text-muted)]">Chave: {widget.publicKey}</div>
        </div>
        <div className="flex gap-2">
          <a href={demoUrl} target="_blank" rel="noreferrer">
            <Button type="button" variant="secondary" size="sm">
              <ExternalLink className="h-4 w-4" />
              Testar
            </Button>
          </a>
          <Button variant="danger" size="sm" type="button" onClick={onDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          Nome interno
          <input
            className={inputCls + ' mt-1'}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 pt-5 text-sm text-[var(--rz-text)]">
          <input
            type="checkbox"
            checked={form.active}
            onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
          />
          Widget ativo
        </label>
        <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
          Domínios permitidos (um por linha; vazio = qualquer)
          <textarea
            className={textareaCls + ' mt-1 font-mono text-xs'}
            rows={2}
            value={form.allowedDomains.join('\n')}
            onChange={e =>
              setForm(f => ({
                ...f,
                allowedDomains: e.target.value
                  .split(/[\n,]/)
                  .map(s => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="meusite.com.br&#10;*.loja.com"
          />
        </label>
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          Título
          <input
            className={inputCls + ' mt-1'}
            value={form.appearance.title}
            onChange={e =>
              setForm(f => ({ ...f, appearance: { ...f.appearance, title: e.target.value } }))
            }
          />
        </label>
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          Subtítulo
          <input
            className={inputCls + ' mt-1'}
            value={form.appearance.subtitle}
            onChange={e =>
              setForm(f => ({ ...f, appearance: { ...f.appearance, subtitle: e.target.value } }))
            }
          />
        </label>
        <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
          Saudação (mensagem de boas-vindas)
          <textarea
            className={textareaCls + ' mt-1'}
            rows={2}
            value={form.appearance.greeting}
            onChange={e =>
              setForm(f => ({ ...f, appearance: { ...f.appearance, greeting: e.target.value } }))
            }
          />
        </label>
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          Cor principal
          <input
            type="color"
            className="mt-1 h-10 w-full cursor-pointer rounded border border-[var(--rz-border)]"
            value={form.appearance.primaryColor}
            onChange={e =>
              setForm(f => ({ ...f, appearance: { ...f.appearance, primaryColor: e.target.value } }))
            }
          />
        </label>
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          Posição do botão
          <select
            className={inputCls + ' mt-1'}
            value={form.appearance.position}
            onChange={e =>
              setForm(f => ({
                ...f,
                appearance: { ...f.appearance, position: e.target.value as 'left' | 'right' },
              }))
            }
          >
            <option value="right">Direita</option>
            <option value="left">Esquerda</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="checkbox"
            checked={form.appearance.askName}
            onChange={e =>
              setForm(f => ({ ...f, appearance: { ...f.appearance, askName: e.target.checked } }))
            }
          />
          Pedir nome antes do chat
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="checkbox"
            checked={form.appearance.askEmail}
            onChange={e =>
              setForm(f => ({ ...f, appearance: { ...f.appearance, askEmail: e.target.checked } }))
            }
          />
          Pedir e-mail antes do chat
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4" />
          Salvar alterações
        </Button>
      </div>

      <label className="mt-4 block text-xs font-medium text-[var(--rz-text-muted)]">
        Código para colar no site
      </label>
      <div className="mt-1 flex gap-2">
        <textarea className={textareaCls + ' font-mono text-xs'} readOnly rows={3} value={snippet} />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            navigator.clipboard.writeText(snippet)
            notifySuccess('Código copiado')
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
