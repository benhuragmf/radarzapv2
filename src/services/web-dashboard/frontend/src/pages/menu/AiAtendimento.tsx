import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import {
  Sparkles,
  ArrowLeft,
  Save,
  Trash2,
  Zap,
  BookOpen,
  Shield,
  BarChart3,
  MessageSquare,
  Settings2,
  Brain,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { AiModelPicker, type AiModelOption } from '../../components/ai/AiModelPicker'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState } from '@/design-system'

const textareaClsAi = `${textareaCls} min-h-[120px]`

type TabId =
  | 'geral'
  | 'provedor'
  | 'regras'
  | 'coleta'
  | 'kb'
  | 'skills'
  | 'memory'
  | 'limites'
  | 'transferencia'
  | 'logs'
  | 'testar'

const TABS: { id: TabId; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'provedor', label: 'Provedor' },
  { id: 'regras', label: 'Economia e regras' },
  { id: 'coleta', label: 'Dados a coletar' },
  { id: 'kb', label: 'Base de conhecimento' },
  { id: 'skills', label: 'Skills' },
  { id: 'memory', label: 'Memória' },
  { id: 'limites', label: 'Limites de uso' },
  { id: 'transferencia', label: 'Regras de transferência' },
  { id: 'logs', label: 'Logs e custos' },
  { id: 'testar', label: 'Testar IA' },
]

interface AiPayload {
  settings: {
    enabled: boolean
    mode: 'radarzap' | 'company' | 'disabled'
    provider: 'openai' | 'gemini'
    model: string
    temperature: number
    maxTokens: number
    dailyLimit: number
    monthlyLimit: number
    perConversationLimit: number
    transferRules: Record<string, boolean | number>
  }
  prompt: {
    customRules: string
    useSystemContext: boolean
    skipKnownFields: boolean
    autoResolveEnabled: boolean
    learnSkillsEnabled: boolean
    learnMemoryEnabled: boolean
    collectName: boolean
    collectEmail: boolean
    collectProblem: boolean
    collectCpfCnpj: boolean
    collectAddress: boolean
    collectOrderNumber: boolean
    collectUrgency: boolean
    collectAttachments: boolean
  }
  knowledgeBase: Array<{ id: string; title: string; content: string; active: boolean }>
  skills: Array<{
    id: string
    title: string
    triggers: string
    solution: string
    status: 'pending' | 'approved' | 'rejected'
    source: 'learned' | 'manual'
    sourceProblem?: string
    usageCount: number
    updatedAt: string
  }>
  memories: Array<{
    id: string
    title: string
    content: string
    tags: string
    status: 'pending' | 'approved' | 'rejected'
    source: 'learned' | 'manual'
    usageCount: number
    updatedAt: string
  }>
  usage: {
    dailyUsed: number
    monthlyUsed: number
    dailyLimit: number
    monthlyLimit: number
    perConversationLimit: number
  }
  apiKeyMasked: string | null
  hasApiKey: boolean
  planLimits: { radarzapAllowed: boolean; dailyLimit: number; monthlyLimit: number }
  modelCatalog: AiModelOption[]
  modelCatalogs: { gemini: AiModelOption[]; openai: AiModelOption[] }
  selectedModelPricing: AiModelOption | null
  blueprintInfo: {
    managedBy: 'radarzap'
    version: number
    agentName: string
    updatedAt: string
  }
}

export default function AiAtendimento() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabId>('geral')
  const [form, setForm] = useState<AiPayload | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)

  const { data: me } = useQuery<AuthUser | null>({ queryKey: ['auth-me'], queryFn: getMe })
  const canManage = can(me ?? null, 'inbox:ai:manage')

  const { data, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => api.get<AiPayload>('/platform/ai/settings'),
    enabled: canManage,
  })

  const { data: usageDetail } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () =>
      api.get<{ rows: unknown[]; totals: { calls: number; tokens: number; cost: number }; snapshot: unknown }>(
        '/platform/ai/usage',
      ),
    enabled: canManage && tab === 'logs',
  })

  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        skills: data.skills ?? [],
        memories: data.memories ?? [],
        prompt: {
          learnMemoryEnabled: true,
          ...data.prompt,
        },
      })
    }
  }, [data])

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch('/platform/ai/settings', payload),
    onSuccess: (res: AiPayload) => {
      setForm(res)
      qc.setQueryData(['ai-settings'], res)
      setApiKeyInput('')
    },
    onError: mutationError,
  })

  const removeKey = useMutation({
    mutationFn: () => api.delete('/platform/ai/key'),
    onSuccess: (res: AiPayload) => {
      setForm(res)
      qc.setQueryData(['ai-settings'], res)
    },
    onError: mutationError,
  })

  const testConn = useMutation({
    mutationFn: (apiKey?: string) =>
      api.post<{ ok: boolean; message: string }>('/platform/ai/test', apiKey ? { apiKey } : {}),
    onSuccess: r => setTestResult(r.ok ? `OK: ${r.message}` : `Falha: ${r.message}`),
  })

  const approveSkill = useMutation({
    mutationFn: (id: string) => api.post(`/platform/ai/skills/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
    onError: mutationError,
  })

  const rejectSkill = useMutation({
    mutationFn: (id: string) => api.post(`/platform/ai/skills/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
    onError: mutationError,
  })

  const approveMemory = useMutation({
    mutationFn: (id: string) => api.post(`/platform/ai/memory/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
    onError: mutationError,
  })

  const rejectMemory = useMutation({
    mutationFn: (id: string) => api.post(`/platform/ai/memory/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
    onError: mutationError,
  })

  if (!canManage) {
    return (
      <PlatformPage title="IA Atendimento">
        <p className="text-gray-400">Sem permissão para configurar IA.</p>
      </PlatformPage>
    )
  }

  if (isLoading || !form) {
    return (
      <PlatformPage title="IA Atendimento">
        <LoadingState rows={4} className="pt-4" />
      </PlatformPage>
    )
  }

  const patch = (partial: Partial<AiPayload['settings']>) =>
    setForm(f => {
      if (!f) return f
      const next = { ...f.settings, ...partial }
      let catalog = f.modelCatalog
      if (partial.provider && partial.provider !== f.settings.provider) {
        catalog = f.modelCatalogs[partial.provider]
        const first = catalog.find(m => m.recommended) ?? catalog[0]
        if (first) next.model = first.id
      }
      const pricing =
        catalog.find(m => m.id === next.model) ??
        (next.model === f.settings.model ? f.selectedModelPricing : null)
      return {
        ...f,
        settings: next,
        modelCatalog: catalog,
        selectedModelPricing: pricing ?? f.selectedModelPricing,
      }
    })

  const selectModel = (modelId: string) => {
    setForm(f => {
      if (!f) return f
      const pricing = f.modelCatalog.find(m => m.id === modelId) ?? f.selectedModelPricing
      return {
        ...f,
        settings: { ...f.settings, model: modelId },
        selectedModelPricing: pricing ?? f.selectedModelPricing,
      }
    })
  }
  const patchPrompt = (partial: Partial<AiPayload['prompt']>) =>
    setForm(f => (f ? { ...f, prompt: { ...f.prompt, ...partial } } : f))

  const handleSave = () => {
    if (!form) return
    const body: Record<string, unknown> = {
      settings: { ...form.settings },
      prompt: { ...form.prompt },
      knowledgeBase: form.knowledgeBase,
      skills: form.skills,
      memories: form.memories,
    }
    if (apiKeyInput.trim()) {
      ;(body.settings as Record<string, unknown>).apiKey = apiKeyInput.trim()
    }
    save.mutate(body)
  }

  return (
    <PlatformPage title="IA Atendimento" className="max-w-6xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/platform/inbox" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300">
          <ArrowLeft className="w-4 h-4" /> Inbox
        </Link>
        <span className="text-gray-600">|</span>
        <span className="inline-flex items-center gap-2 text-brand-400">
          <Sparkles className="w-5 h-5" /> Triagem inteligente WhatsApp
        </span>
      </div>

      {form.blueprintInfo && (
        <Card className="p-4 mb-4 border-brand-800/40 bg-brand-950/20">
          <p className="text-sm text-gray-300">
            O <strong>agente de atendimento</strong> (IDENTITY, SOUL, AGENTS, TOOLS) é gerenciado pela{' '}
            <strong>RadarZap</strong> — blueprint v{form.blueprintInfo.version}, agente{' '}
            <em>{form.blueprintInfo.agentName}</em>. Você configura a <strong>base de conhecimento</strong>,
            aprova <strong>skills/memórias</strong> aprendidas e regras leves da sua empresa.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-800 pb-2">
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

      {tab === 'geral' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Modo de operação
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={form.settings.mode === 'disabled'}
              onChange={() => patch({ mode: 'disabled', enabled: false })}
            />
            IA desativada — usa bot fixo, fila e humano
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={form.settings.mode === 'radarzap'}
              onChange={() => patch({ mode: 'radarzap', enabled: true })}
              disabled={!form.planLimits.radarzapAllowed}
            />
            IA RadarZap (chave interna, limites do plano)
            {!form.planLimits.radarzapAllowed && (
              <span className="text-amber-500 text-xs">Indisponível no plano Free</span>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={form.settings.mode === 'company'}
              onChange={() => patch({ mode: 'company', enabled: true })}
            />
            IA própria da empresa (sua API Key)
          </label>
          <p className="text-xs text-gray-500">
            Uso hoje: {form.usage.dailyUsed}/{form.usage.dailyLimit} diário ·{' '}
            {form.usage.monthlyUsed}/{form.usage.monthlyLimit} mensal
          </p>
        </Card>
      )}

      {tab === 'provedor' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium">Provedor e modelo</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Provedor</label>
              <select
                className={inputCls}
                value={form.settings.provider}
                onChange={e => patch({ provider: e.target.value as 'openai' | 'gemini' })}
                disabled={form.settings.mode !== 'company'}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-2 block">Modelo e preço (por 1M tokens)</label>
              <AiModelPicker
                models={form.modelCatalog}
                selectedId={form.settings.model}
                onSelect={selectModel}
                disabled={form.settings.mode !== 'company'}
                dailyLimit={form.settings.dailyLimit}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Temperature ({form.settings.temperature})</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={form.settings.temperature}
                onChange={e => patch({ temperature: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Max tokens</label>
              <input
                type="number"
                min={400}
                max={4096}
                className={inputCls}
                value={form.settings.maxTokens}
                onChange={e => patch({ maxTokens: Math.max(400, Number(e.target.value)) })}
              />
              <p className="text-xs text-gray-500 mt-1">Mínimo 400 — valores baixos truncam a resposta (ex.: &quot;Here&quot;).</p>
            </div>
          </div>
          {form.settings.mode === 'company' && (
            <div className="border-t border-gray-800 pt-4 space-y-3">
              <p className="text-sm text-gray-400">
                Chave salva: {form.hasApiKey ? form.apiKeyMasked : 'nenhuma'}
              </p>
              <input
                type="password"
                className={inputCls}
                placeholder="Nova API Key (não exibida após salvar)"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                autoComplete="off"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => testConn.mutate(apiKeyInput || undefined)}>
                  <Zap className="w-4 h-4 mr-1" /> Testar conexão
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => removeKey.mutate()}
                  disabled={!form.hasApiKey}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Remover chave
                </Button>
              </div>
              {testResult && <p className="text-sm text-gray-300">{testResult}</p>}
            </div>
          )}
        </Card>
      )}

      {tab === 'regras' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Shield className="w-5 h-5" /> Economia de créditos e regras da empresa
          </h2>
          <p className="text-xs text-gray-500">
            O comportamento do agente vem do blueprint RadarZap. Aqui você só ajusta economia de tokens e
            regras específicas do seu negócio.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                ['useSystemContext', 'Usar dados do cadastro (nome, e-mail, tickets)'],
                ['skipKnownFields', 'Não pedir dados que já existem no contato'],
                ['autoResolveEnabled', 'Resolver com base de conhecimento antes da IA (sem gastar crédito)'],
                ['learnSkillsEnabled', 'Aprender skills ao escalar (dono aprova depois)'],
                ['learnMemoryEnabled', 'Aprender memória curada ao escalar (dono aprova depois)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.prompt[key]}
                  onChange={e => patchPrompt({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Regras adicionais da sua empresa (opcional)
            </label>
            <textarea
              className={textareaClsAi}
              placeholder="Ex.: Não oferecer desconto. Horário 8h–18h. Produto principal: rastreador veicular."
              value={form.prompt.customRules}
              onChange={e => patchPrompt({ customRules: e.target.value })}
            />
          </div>
        </Card>
      )}

      {tab === 'coleta' && (
        <Card className="p-6 grid sm:grid-cols-2 gap-3">
          {(
            [
              ['collectName', 'Nome'],
              ['collectEmail', 'E-mail'],
              ['collectProblem', 'Problema'],
              ['collectCpfCnpj', 'CPF/CNPJ'],
              ['collectAddress', 'Endereço'],
              ['collectOrderNumber', 'Número do pedido'],
              ['collectUrgency', 'Urgência'],
              ['collectAttachments', 'Anexos / fotos'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.prompt[key]}
                onChange={e => patchPrompt({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </Card>
      )}

      {tab === 'skills' && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Brain className="w-5 h-5" /> Skills da empresa
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setForm(f =>
                  f
                    ? {
                        ...f,
                        skills: [
                          ...f.skills,
                          {
                            id: '',
                            title: 'Nova skill',
                            triggers: '',
                            solution: '',
                            status: 'approved',
                            source: 'manual',
                            usageCount: 0,
                            updatedAt: new Date().toISOString(),
                          },
                        ],
                      }
                    : f,
                )
              }
            >
              Adicionar manual
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Skills aprovadas entram no atendimento automático. Itens <em>pendentes</em> vêm do aprendizado
            após escalações — o dono aprova ou rejeita.
          </p>
          {(form.skills ?? []).length === 0 && (
            <p className="text-sm text-gray-500">Nenhuma skill ainda. A IA pode propor após atendimentos.</p>
          )}
          {(form.skills ?? []).map((skill, idx) => (
            <div
              key={skill.id || idx}
              className={`border rounded-lg p-4 space-y-2 ${
                skill.status === 'pending'
                  ? 'border-amber-700/50 bg-amber-950/20'
                  : skill.status === 'rejected'
                    ? 'border-gray-800 opacity-60'
                    : 'border-gray-800'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  {skill.status === 'pending' && 'Pendente aprovação'}
                  {skill.status === 'approved' && 'Aprovada'}
                  {skill.status === 'rejected' && 'Rejeitada'}
                  {skill.source === 'learned' && ' · aprendida'}
                  {skill.usageCount > 0 && ` · ${skill.usageCount} usos`}
                </span>
                {skill.status === 'pending' && skill.id && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => approveSkill.mutate(skill.id)}
                      disabled={approveSkill.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => rejectSkill.mutate(skill.id)}
                      disabled={rejectSkill.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
              <input
                className={inputCls}
                value={skill.title}
                onChange={e => {
                  const skills = [...(form.skills ?? [])]
                  skills[idx] = { ...skills[idx], title: e.target.value }
                  setForm(f => (f ? { ...f, skills } : f))
                }}
                placeholder="Título"
              />
              <input
                className={inputCls}
                value={skill.triggers}
                onChange={e => {
                  const skills = [...(form.skills ?? [])]
                  skills[idx] = { ...skills[idx], triggers: e.target.value }
                  setForm(f => (f ? { ...f, skills } : f))
                }}
                placeholder="Gatilhos / palavras-chave"
              />
              <textarea
                className={textareaClsAi}
                value={skill.solution}
                onChange={e => {
                  const skills = [...(form.skills ?? [])]
                  skills[idx] = { ...skills[idx], solution: e.target.value }
                  setForm(f => (f ? { ...f, skills } : f))
                }}
                placeholder="Solução passo a passo para o cliente"
              />
              {skill.sourceProblem && (
                <p className="text-xs text-gray-500">Problema origem: {skill.sourceProblem}</p>
              )}
            </div>
          ))}
        </Card>
      )}

      {tab === 'memory' && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <MessageSquare className="w-5 h-5" /> Memória curada (MEMORY)
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setForm(f =>
                  f
                    ? {
                        ...f,
                        memories: [
                          ...(f.memories ?? []),
                          {
                            id: '',
                            title: 'Novo fato',
                            content: '',
                            tags: '',
                            status: 'approved',
                            source: 'manual',
                            usageCount: 0,
                            updatedAt: new Date().toISOString(),
                          },
                        ],
                      }
                    : f,
                )
              }
            >
              Adicionar manual
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Fatos duráveis da empresa — equivalente ao MEMORY.md do OpenClaw. Aprendidas ficam pendentes até
            o dono aprovar.
          </p>
          {(form.memories ?? []).length === 0 && (
            <p className="text-sm text-gray-500">Nenhuma memória ainda.</p>
          )}
          {(form.memories ?? []).map((mem, idx) => (
            <div
              key={mem.id || idx}
              className={`border rounded-lg p-4 space-y-2 ${
                mem.status === 'pending'
                  ? 'border-amber-700/50 bg-amber-950/20'
                  : mem.status === 'rejected'
                    ? 'border-gray-800 opacity-60'
                    : 'border-gray-800'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  {mem.status === 'pending' && 'Pendente aprovação'}
                  {mem.status === 'approved' && 'Aprovada'}
                  {mem.status === 'rejected' && 'Rejeitada'}
                  {mem.source === 'learned' && ' · aprendida'}
                </span>
                {mem.status === 'pending' && mem.id && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => approveMemory.mutate(mem.id)}
                      disabled={approveMemory.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => rejectMemory.mutate(mem.id)}
                      disabled={rejectMemory.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
              <input
                className={inputCls}
                value={mem.title}
                onChange={e => {
                  const memories = [...(form.memories ?? [])]
                  memories[idx] = { ...memories[idx], title: e.target.value }
                  setForm(f => (f ? { ...f, memories } : f))
                }}
                placeholder="Título"
              />
              <input
                className={inputCls}
                value={mem.tags}
                onChange={e => {
                  const memories = [...(form.memories ?? [])]
                  memories[idx] = { ...memories[idx], tags: e.target.value }
                  setForm(f => (f ? { ...f, memories } : f))
                }}
                placeholder="Tags / palavras-chave"
              />
              <textarea
                className={textareaClsAi}
                value={mem.content}
                onChange={e => {
                  const memories = [...(form.memories ?? [])]
                  memories[idx] = { ...memories[idx], content: e.target.value }
                  setForm(f => (f ? { ...f, memories } : f))
                }}
                placeholder="Fato ou decisão que a IA deve lembrar"
              />
            </div>
          ))}
        </Card>
      )}

      {tab === 'kb' && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Base de conhecimento
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setForm(f =>
                  f
                    ? {
                        ...f,
                        knowledgeBase: [
                          ...f.knowledgeBase,
                          { id: '', title: 'Novo item', content: '', active: true },
                        ],
                      }
                    : f,
                )
              }
            >
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Itens ativos são buscados por relevância na mensagem do cliente — só os mais pertinentes vão
            no prompt (economia de tokens).
          </p>
          {form.knowledgeBase.map((item, idx) => (
            <div key={item.id || idx} className="border border-gray-800 rounded-lg p-4 space-y-2">
              <input
                className={inputCls}
                value={item.title}
                onChange={e => {
                  const kb = [...form.knowledgeBase]
                  kb[idx] = { ...kb[idx], title: e.target.value }
                  setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                }}
                placeholder="Título"
              />
              <textarea
                className={textareaClsAi}
                value={item.content}
                onChange={e => {
                  const kb = [...form.knowledgeBase]
                  kb[idx] = { ...kb[idx], content: e.target.value }
                  setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                }}
                placeholder="Conteúdo"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={e => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = { ...kb[idx], active: e.target.checked }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                />
                Ativo
              </label>
            </div>
          ))}
        </Card>
      )}

      {tab === 'limites' && (
        <Card className="p-6 grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500">Limite diário</label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.dailyLimit}
              onChange={e => patch({ dailyLimit: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Limite mensal</label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.monthlyLimit}
              onChange={e => patch({ monthlyLimit: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Por conversa</label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.perConversationLimit}
              onChange={e => patch({ perConversationLimit: Number(e.target.value) })}
            />
          </div>
          <p className="md:col-span-3 text-xs text-gray-500">
            Plano: máx. RadarZap {form.planLimits.dailyLimit}/dia · {form.planLimits.monthlyLimit}/mês
          </p>
        </Card>
      )}

      {tab === 'transferencia' && (
        <Card className="p-6 grid sm:grid-cols-2 gap-3">
          <h2 className="sm:col-span-2 text-lg font-medium flex items-center gap-2">
            <Shield className="w-5 h-5" /> Quando transferir para humano
          </h2>
          {(
            [
              ['onHumanRequest', 'Cliente pedir atendente'],
              ['onAngryClient', 'Cliente irritado'],
              ['onCancellation', 'Cancelamento'],
              ['onLegal', 'Assunto jurídico'],
              ['onLowConfidence', 'Baixa confiança'],
              ['onRepeatedQuestion', 'Pergunta repetida'],
              ['onMinDataCollected', 'Dados mínimos coletados'],
              ['onSensitiveMessage', 'Mensagem sensível'],
              ['onUninterpretableMedia', 'Mídia não interpretável'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.settings.transferRules[key])}
                onChange={e =>
                  patch({
                    transferRules: { ...form.settings.transferRules, [key]: e.target.checked },
                  })
                }
              />
              {label}
            </label>
          ))}
          <div>
            <label className="text-xs text-gray-500">Limiar confiança</label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className={inputCls}
              value={Number(form.settings.transferRules.lowConfidenceThreshold ?? 0.45)}
              onChange={e =>
                patch({
                  transferRules: {
                    ...form.settings.transferRules,
                    lowConfidenceThreshold: Number(e.target.value),
                  },
                })
              }
            />
          </div>
        </Card>
      )}

      {tab === 'logs' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Uso e custos estimados
          </h2>
          {usageDetail && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-2xl font-semibold">{usageDetail.totals.calls}</div>
                <div className="text-xs text-gray-500">chamadas (30d)</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-2xl font-semibold">{usageDetail.totals.tokens}</div>
                <div className="text-xs text-gray-500">tokens</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-2xl font-semibold">
                  US$ {usageDetail.totals.cost.toFixed(4)}
                </div>
                <div className="text-xs text-gray-500">custo est.</div>
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === 'testar' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium">Testar conexão com o provedor</h2>
          <Button type="button" onClick={() => testConn.mutate()} disabled={testConn.isPending}>
            Ping no provedor
          </Button>
          {testResult && <p className="text-sm">{testResult}</p>}
        </Card>
      )}

      {tab !== 'testar' && tab !== 'logs' && (
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={handleSave} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      )}
    </PlatformPage>
  )
}
