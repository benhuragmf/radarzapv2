import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Save, RotateCcw, Sparkles } from 'lucide-react'
import { RadarPageShell, PageHeader, LoadingState, inputCls, textareaCls } from '@/design-system'

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

const textareaClsBlueprint = `${textareaCls} min-h-[280px] font-mono text-xs leading-relaxed`

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
      <RadarPageShell maxWidth="wide">
        <LoadingState rows={5} className="pt-8" />
      </RadarPageShell>
    )
  }

  const active = TABS.find(t => t.id === tab)!

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Blueprint IA (RadarZap)"
        subtitle={
          <>
            Cérebro padrão aplicado a todos os tenants (modo RadarZap ou IA própria). Clientes
            cadastram base de conhecimento, aprovam skills/memórias e regras leves — não editam
            IDENTITY/SOUL/AGENTS.
            <span className="block text-xs text-[var(--rz-text-muted)] mt-1">
              Versão {form.version} · variáveis: {'{agentName}'}, {'{companyName}'}, {'{customerName}'}…
            </span>
          </>
        }
        actions={
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
        }
      />

      <Card className="p-4 flex flex-wrap gap-2 items-center">
        <Sparkles className="w-4 h-4 text-[var(--rz-primary)]" />
        <label className="text-sm text-[var(--rz-text-secondary)]">Nome padrão do agente:</label>
        <input
          className={`${inputCls} max-w-xs`}
          value={form.agentName}
          onChange={e => setForm(f => (f ? { ...f, agentName: e.target.value } : f))}
        />
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-[var(--rz-border)] pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              tab === t.id
                ? 'bg-[var(--rz-primary)] text-white'
                : 'text-[var(--rz-text-muted)] hover:bg-[var(--rz-surface-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-medium text-[var(--rz-primary)]">{active.label}</h2>
        {tab === 'greetings' ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] block mb-1">Cliente conhecido</label>
              <textarea
                className={textareaClsBlueprint}
                value={form.greetingKnown}
                onChange={e => setForm(f => (f ? { ...f, greetingKnown: e.target.value } : f))}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] block mb-1">Cliente novo</label>
              <textarea
                className={textareaClsBlueprint}
                value={form.greetingUnknown}
                onChange={e => setForm(f => (f ? { ...f, greetingUnknown: e.target.value } : f))}
              />
            </div>
          </div>
        ) : (
          <textarea
            className={textareaClsBlueprint}
            value={String(form[active.field] ?? '')}
            onChange={e =>
              setForm(f => (f ? { ...f, [active.field]: e.target.value } : f))
            }
          />
        )}
      </Card>
    </RadarPageShell>
  )
}
