import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { inputCls, LoadingState, EmptyState } from '@/design-system'

interface ApiKeyRow {
  _id: string
  name: string
  keyPrefix: string
  active: boolean
  lastUsedAt?: string
  createdAt: string
}

export function ApiKeysPanel() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: keys = [], isLoading } = useQuery<ApiKeyRow[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/integrations/api-keys'),
  })

  const create = useMutation({
    mutationFn: () => api.post<{ key: string; name: string; keyPrefix: string }>('/integrations/api-keys', { name: name.trim() || 'Integração' }),
    onSuccess: data => {
      setNewKey(data.key)
      setName('')
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: mutationError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const copyKey = async () => {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--rz-text-muted)]">
        Use o header <code className="text-[var(--rz-text-secondary)]">X-API-Key</code> em chamadas server-to-server.
        A chave completa só é exibida uma vez ao criar.
      </p>

      {newKey && (
        <Card className="border-brand-700/50 bg-brand-950/20 space-y-2">
          <p className="text-sm text-brand-200 font-medium">Chave criada — copie agora</p>
          <code className="block text-xs break-all text-gray-300 bg-gray-900 p-2 rounded">{newKey}</code>
          <Button size="sm" variant="secondary" onClick={copyKey}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome da integração (ex.: ERP, CRM)"
          className={`${inputCls} flex-1 min-w-[200px]`}
        />
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? <Spinner size={14} /> : <Plus size={14} />}
          Gerar chave
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={3} className="py-2" />
      ) : keys.length === 0 ? (
        <EmptyState title="Nenhuma chave cadastrada" description="Gere uma chave para integrações server-to-server." />
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <Card key={k._id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-200 flex items-center gap-2">
                  <Key size={14} className="text-brand-500" />
                  {k.name}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{k.keyPrefix}…</p>
              </div>
              <button
                type="button"
                onClick={() => window.confirm('Revogar esta chave?') && remove.mutate(k._id)}
                className="p-2 text-gray-500 hover:text-red-400"
                title="Revogar"
              >
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
