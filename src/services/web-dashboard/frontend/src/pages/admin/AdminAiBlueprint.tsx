import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Brain, Save, RotateCcw, Sparkles } from 'lucide-react'

type BlueprintTab =
  | 'identity'
  | 'soul'
  | 'agents'
  | 'tools'
  | 'memory'
  | 'skills'
  | 'knowledge'
  | 'final'
  | 'greetings'

interface BlueprintPayload {
  agentName: string
  identity: string
  soul: string
  agents: string
  tools: string
  memoryGuide: string
  skillsGuide: string
  knowledgeGuide: string
  finalRules: string
  greetingKnown: string
  greetingUnknown: string
  version: number
  updatedAt: string
}

const TABS: { id: BlueprintTab; label: string; field: keyof BlueprintPayload }[] = [
  { id: 'identity', label: 'IDENTITY', field: 'identity' },
  { id: 'soul', label: 'SOUL', field: 'soul' },
  { id: 'agents', label: 'AGENTS', field: 'agents' },
  { id: 'tools', label: 'TOOLS', field: 'tools' },
  { id: 'memory', label: 'MEMORY', field: 'memoryGuide' },
  { id: 'skills', label: 'SKILLS', field: 'skillsGuide' },
  { id: 'knowledge', label: 'KNOWLEDGE', field: 'knowledgeGuide' },
  { id: 'final', label: 'Regra final', field: 'finalRules' },
  { id: 'greetings', label: 'Saudações', field: 'greetingKnown' },
]

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'
const textareaCls = `${inputCls} min-h-[280px] resize-y font-mono text-xs leading-relaxed`

export default function AdminAiBlueprint() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<BlueprintTab>('identity')
  const [form, setForm] = useState<BlueprintPayload | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ai-blueprint'],
    queryFn: () => api.get<BlueprintPayload>('/admin/ai-blueprint'),
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: (payload: BlueprintPayload) => api.patch('/admin/ai-blueprint', payload),
    onSuccess: res => {
      setForm(res)
      qc.setQueryData(['admin-ai-blueprint'], res)
    },
  })

  const reset = useMutation({
    mutationFn: () => api.post<BlueprintPayload>('/admin/ai-blueprint/reset', {}),
    onSuccess: res => {
      setForm(res)
      qc.setQueryData(['admin-ai-blueprint'], res)
    },
  })

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={32} />
      </div>
    )
  }

  const active = TABS.find(t => t.id === tab)!

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Brain size={20} /> Blueprint IA (RadarZap)
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Cérebro padrão aplicado a todos os tenants (modo RadarZap ou IA própria). Clientes
            cadastram base de conhecimento, aprovam skills/memórias e regras leves — não editam
            IDENTITY/SOUL/AGENTS.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Versão {form.version} · variáveis: {'{agentName}'}, {'{companyName}'}, {'{customerName}'}…
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
          </Button>
          <Button type="button" onClick={() => save.mutate(form)} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-1" /> Salvar blueprint
          </Button>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-2 items-center">
        <Sparkles className="w-4 h-4 text-brand-400" />
        <label className="text-sm text-gray-400">Nome padrão do agente:</label>
        <input
          className={`${inputCls} max-w-xs`}
          value={form.agentName}
          onChange={e => setForm(f => (f ? { ...f, agentName: e.target.value } : f))}
        />
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              tab === t.id ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-medium text-brand-400">{active.label}</h2>
        {tab === 'greetings' ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cliente conhecido</label>
              <textarea
                className={textareaCls}
                value={form.greetingKnown}
                onChange={e => setForm(f => (f ? { ...f, greetingKnown: e.target.value } : f))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cliente novo</label>
              <textarea
                className={textareaCls}
                value={form.greetingUnknown}
                onChange={e => setForm(f => (f ? { ...f, greetingUnknown: e.target.value } : f))}
              />
            </div>
          </div>
        ) : (
          <textarea
            className={textareaCls}
            value={String(form[active.field] ?? '')}
            onChange={e =>
              setForm(f => (f ? { ...f, [active.field]: e.target.value } : f))
            }
          />
        )}
      </Card>
    </div>
  )
}
