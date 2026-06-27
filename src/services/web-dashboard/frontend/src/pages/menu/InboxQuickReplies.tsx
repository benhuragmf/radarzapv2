import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Zap, Plus, Trash2, Search, MessageSquare } from 'lucide-react'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { notifyConfigSaved, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState, searchFieldIconCls, ConfigSaveFooter } from '@/design-system'

interface QuickReply {
  code: string
  label: string
  template: string
}

interface QuickReplyRow extends QuickReply {
  _key: string
}

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'saudacao', label: 'Saudação' },
  { id: 'dados', label: 'Dados' },
  { id: 'atendimento', label: 'Atendimento' },
  { id: 'encerramento', label: 'Encerramento' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'outro', label: 'Outro' },
] as const

function guessCategory(code: string, label: string): string {
  const c = code.toLowerCase()
  const l = label.toLowerCase()
  if (['bd', 'bt', 'bom'].some(x => c.includes(x)) || l.includes('bom dia') || l.includes('boa')) return 'saudacao'
  if (c.includes('dados') || l.includes('dados')) return 'dados'
  if (c.includes('enc') || c.includes('aus') || c.includes('mais') || l.includes('encerr')) return 'encerramento'
  if (c.includes('ticket') || l.includes('ticket')) return 'ticket'
  if (c.includes('ag') || l.includes('aguarde')) return 'atendimento'
  return 'outro'
}

function newRow(partial?: Partial<QuickReply>): QuickReplyRow {
  return {
    _key: crypto.randomUUID(),
    code: 'nova',
    label: 'Nova resposta',
    template: 'Olá [user], ...',
    ...partial,
  }
}

function renderPreview(template: string, contactName = 'Juliana') {
  const first = contactName.split(/\s+/)[0] || contactName
  return template.replace(/\[user\]/gi, first).replace(/\[nome\]/gi, first)
}

export default function InboxQuickReplies() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [previewIndex, setPreviewIndex] = useState(0)

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })
  const canManage = can(me ?? null, 'inbox:department:manage')

  const { data, isLoading } = useQuery({
    queryKey: ['inbox-quick-replies'],
    queryFn: () => api.get<QuickReply[]>('/inbox/quick-replies'),
    enabled: canManage,
  })

  const [rows, setRows] = useState<QuickReplyRow[]>([])

  useEffect(() => {
    if (data) setRows(data.map(r => newRow(r)))
  }, [data])

  const filteredIndices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const cat = guessCategory(row.code, row.label)
        if (category !== 'all' && cat !== category) return false
        if (!q) return true
        return (
          row.code.toLowerCase().includes(q) ||
          row.label.toLowerCase().includes(q) ||
          row.template.toLowerCase().includes(q)
        )
      })
  }, [rows, search, category])

  const previewRow = filteredIndices[previewIndex]?.row ?? filteredIndices[0]?.row

  const save = useMutation({
    mutationFn: (replies: QuickReplyRow[]) =>
      api.patch('/inbox/quick-replies', {
        replies: replies.map(({ _key: _, ...r }) => r),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-quick-replies'] })
      qc.invalidateQueries({ queryKey: ['inbox-conversation'] })
      notifyConfigSaved()
    },
    onError: mutationError,
  })

  const updateRow = (index: number, patch: Partial<QuickReply>) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows(prev => [...prev, newRow()])
  }

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  if (!canManage) {
    return (
      <PlatformPage title="Respostas rápidas">
        <p className="text-[var(--rz-text-muted)] text-sm">Sem permissão para editar respostas automáticas.</p>
      </PlatformPage>
    )
  }

  return (
    <PlatformPage
      title="Respostas rápidas"
      description="Atalhos digitados no chat ajudam o atendente a responder mais rápido com mensagens padronizadas e precisas."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      {isLoading ? (
        <LoadingState rows={3} className="pt-4" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Card className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <Search size={14} className={searchFieldIconCls} />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar código, rótulo ou mensagem…"
                  className={`${inputCls} pl-9`}
                />
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-thin">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      category === c.id
                        ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                        : 'text-[var(--rz-text-muted)] border border-transparent hover:bg-[var(--rz-surface-muted)]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-[var(--rz-text-muted)]">
                <Zap size={16} className="text-brand-400" />
                {rows.length} atalho(s) · ex.: <code className="text-brand-400">/bd</code>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={addRow}>
                  <Plus size={14} /> Adicionar
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredIndices.length === 0 ? (
                <p className="text-sm text-[var(--rz-text-muted)] text-center py-8">
                  Nenhuma resposta rápida encontrada.
                </p>
              ) : (
                filteredIndices.map(({ row, index: i }, listIdx) => {
                  const cat = guessCategory(row.code, row.label)
                  return (
                    <div
                      key={row._key}
                      onFocus={() => setPreviewIndex(listIdx)}
                      className="grid gap-2 sm:grid-cols-[100px_140px_1fr_auto] items-start p-3 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)]/40 hover:border-brand-500/20 transition-colors"
                    >
                      <div>
                        <label className="text-[10px] text-[var(--rz-text-muted)] uppercase">Código</label>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[var(--rz-text-muted)] text-sm">/</span>
                          <input
                            value={row.code}
                            onChange={e =>
                              updateRow(i, {
                                code: e.currentTarget.value.replace(/\s/g, '').toLowerCase(),
                              })
                            }
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--rz-text-muted)] uppercase">Rótulo</label>
                        <input
                          value={row.label}
                          onChange={e => updateRow(i, { label: e.currentTarget.value })}
                          className={`${inputCls} mt-1`}
                        />
                        <p className="text-[10px] text-[var(--rz-text-muted)] mt-1 capitalize">{cat}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--rz-text-muted)] uppercase">Mensagem</label>
                        <textarea
                          value={row.template}
                          onChange={e => updateRow(i, { template: e.currentTarget.value })}
                          className={`${textareaCls} mt-1`}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-5 sm:mt-6 text-red-400/80"
                        onClick={() => removeRow(i)}
                        aria-label="Remover"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>

            <p className="text-xs text-[var(--rz-text-muted)] border-t border-[var(--rz-border)] pt-3">
              Placeholders: <strong>[user]</strong> ou <strong>[nome]</strong> — primeiro nome do contato.
              Os atalhos de aviso (<code>/aus</code>), pergunta final (<code>/mais</code>) e encerramento
              (<code>/enc</code>, <code>/enc_ok</code>) usam os códigos configurados em Bot → SLA.
              O <code>/enc</code> libera após <code>/aus</code> + tempo ou após <code>/mais</code> + resposta do cliente.
            </p>
          </Card>

          <aside className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">Variáveis disponíveis</h3>
              <ul className="text-xs text-[var(--rz-text-muted)] space-y-2">
                <li><code className="text-brand-400">[user]</code> — primeiro nome do contato</li>
                <li><code className="text-brand-400">[nome]</code> — alias de [user]</li>
              </ul>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--rz-text-primary)] flex items-center gap-2">
                <MessageSquare size={14} /> Prévia no chat
              </h3>
              {previewRow ? (
                <>
                  <p className="text-xs text-[var(--rz-text-muted)]">Atendente digita:</p>
                  <p className="text-sm font-mono text-brand-400">/{previewRow.code}</p>
                  <p className="text-xs text-[var(--rz-text-muted)] mt-2">Mensagem enviada:</p>
                  <div className="rounded-lg bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)] px-3 py-2 text-sm text-[var(--rz-text-secondary)] whitespace-pre-wrap">
                    {renderPreview(previewRow.template)}
                  </div>
                </>
              ) : (
                <p className="text-xs text-[var(--rz-text-muted)]">Selecione um atalho para ver a prévia.</p>
              )}
            </Card>
          </aside>
        </div>
      )}

      {!isLoading && (
        <ConfigSaveFooter
          onSave={() => save.mutate(rows)}
          saving={save.isPending}
          disabled={rows.length === 0}
        />
      )}
    </PlatformPage>
  )
}
