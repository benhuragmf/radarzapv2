import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Check, Copy, Key, Plus, Trash2 } from 'lucide-react'
import { mutationError } from '../../lib/notify'
import { EmptyState, InlineNotice, LoadingState, StatusBadge, inputCls } from '@/design-system'

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
    mutationFn: () =>
      api.post<{ key: string; name: string; keyPrefix: string }>('/integrations/api-keys', {
        name: name.trim() || 'Integração',
      }),
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
    onError: mutationError,
  })

  const copyKey = async () => {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <InlineNotice tone="info" title="Chaves para integrações server-to-server">
        Use o header <code className="text-[var(--rz-text-secondary)]">X-API-Key</code>. A chave completa
        só aparece uma vez ao criar.
      </InlineNotice>

      {newKey && (
        <InlineNotice tone="warning" title="Chave criada. Copie agora.">
          <code className="block rounded bg-[var(--rz-surface-muted)] p-2 text-xs text-[var(--rz-text-secondary)] break-all">
            {newKey}
          </code>
          <Button size="sm" variant="secondary" onClick={copyKey} className="mt-2">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </InlineNotice>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome da integração (ex.: ERP, CRM)"
          className={`${inputCls} min-w-[200px] flex-1`}
        />
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? <Spinner size={14} /> : <Plus size={14} />}
          Gerar chave
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={3} className="py-2" label="Carregando chaves de API" />
      ) : keys.length === 0 ? (
        <EmptyState
          title="Nenhuma chave cadastrada"
          description="Gere uma chave apenas para sistemas confiáveis que chamam a API do RadarZap."
          size="sm"
        />
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <Card key={k._id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-[var(--rz-text-primary)]">
                  <Key size={14} className="shrink-0 text-brand-500" />
                  <span className="truncate">{k.name}</span>
                  <StatusBadge
                    status={k.active ? 'success' : 'neutral'}
                    text={k.active ? 'Ativa' : 'Inativa'}
                    size="sm"
                  />
                </p>
                <p className="mt-0.5 font-mono text-xs text-[var(--rz-text-muted)]">{k.keyPrefix}...</p>
              </div>
              <button
                type="button"
                onClick={() => window.confirm('Revogar esta chave?') && remove.mutate(k._id)}
                className="shrink-0 p-2 text-[var(--rz-text-muted)] hover:text-red-400"
                title="Revogar"
                aria-label={`Revogar chave ${k.name}`}
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
