import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { ArrowLeft, Save, Zap, Plus, Trash2 } from 'lucide-react'

interface QuickReply {
  code: string
  label: string
  template: string
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'
const textareaCls = `${inputCls} min-h-[72px] resize-y font-mono text-xs`

export default function InboxQuickReplies() {
  const qc = useQueryClient()
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

  const [rows, setRows] = useState<QuickReply[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setRows(data.map(r => ({ ...r })))
  }, [data])

  const save = useMutation({
    mutationFn: (replies: QuickReply[]) => api.patch('/inbox/quick-replies', { replies }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-quick-replies'] })
      qc.invalidateQueries({ queryKey: ['inbox-conversation'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const updateRow = (index: number, patch: Partial<QuickReply>) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows(prev => [...prev, { code: 'nova', label: 'Nova resposta', template: 'Olá [user], ...' }])
  }

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  if (!canManage) {
    return (
      <PlatformPage title="Respostas rápidas">
        <p className="text-gray-500 text-sm">Sem permissão para editar respostas automáticas.</p>
      </PlatformPage>
    )
  }

  return (
    <PlatformPage
      title="Respostas rápidas do Inbox"
      description="Atalhos digitados no chat (/bd, /bt, /ticket…). Use [user] ou [nome] para o primeiro nome do contato."
    >
      <div className="mb-4">
        <Link to="/platform/inbox" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300">
          <ArrowLeft size={14} /> Voltar ao Inbox
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size={28} />
        </div>
      ) : (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Zap size={16} className="text-brand-400" />
              {rows.length} atalho(s) · ex.: <code className="text-brand-400">/bd</code>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={addRow}>
                <Plus size={14} /> Adicionar
              </Button>
              <Button
                size="sm"
                onClick={() => save.mutate(rows)}
                disabled={save.isPending || rows.length === 0}
              >
                <Save size={14} /> {saved ? 'Salvo!' : 'Salvar'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row, i) => (
              <div
                key={`${row.code}-${i}`}
                className="grid gap-2 sm:grid-cols-[100px_140px_1fr_auto] items-start p-3 rounded-xl border border-gray-800 bg-gray-900/40"
              >
                <div>
                  <label className="text-[10px] text-gray-600 uppercase">Código</label>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-gray-600 text-sm">/</span>
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
                  <label className="text-[10px] text-gray-600 uppercase">Rótulo</label>
                  <input
                    value={row.label}
                    onChange={e => updateRow(i, { label: e.currentTarget.value })}
                    className={`${inputCls} mt-1`}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 uppercase">Mensagem</label>
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
            ))}
          </div>

          <p className="text-xs text-gray-600 border-t border-gray-800 pt-3">
            Placeholders: <strong className="text-gray-500">[user]</strong> ou{' '}
            <strong className="text-gray-500">[nome]</strong> — primeiro nome do contato. A segunda
            mensagem de ausência por inatividade usa o código <code>/enc</code>.
          </p>
        </Card>
      )}
    </PlatformPage>
  )
}
