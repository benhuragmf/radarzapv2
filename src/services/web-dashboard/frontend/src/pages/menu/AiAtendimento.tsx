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
  Hand,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { InboxStatsRow } from '../../components/inbox/InboxStatsRow'
import { AiModelPicker, type AiModelOption } from '../../components/ai/AiModelPicker'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState } from '@/design-system'

const textareaClsAi = `${textareaCls} min-h-[120px]`

type TabId =
  | 'geral'
  | 'saudacoes'
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
  { id: 'saudacoes', label: 'Saudações' },
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
    agentName: string
    greetingKnown: string
    greetingUnknown: string
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
  knowledgeBase: Array<{
    id: string
    title: string
    content: string
    category?: string
    active: boolean
    keywords?: string[]
    links?: Array<{ label: string; url: string; openInNewTab?: boolean }>
    showAsQuickReply?: boolean
    quickReplyLabel?: string
  }>
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
    defaultAgentName: string
    defaultGreetingKnown: string
    defaultGreetingUnknown: string
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
          ...data.prompt,
          learnMemoryEnabled: data.prompt?.learnMemoryEnabled ?? true,
        },
      })
    }
  }, [data])

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch<AiPayload>('/platform/ai/settings', payload),
    onSuccess: (res: AiPayload) => {
      setForm(res)
      qc.setQueryData(['ai-settings'], res)
      setApiKeyInput('')
    },
    onError: mutationError,
  })

  const removeKey = useMutation({
    mutationFn: () => api.delete<AiPayload>('/platform/ai/key'),
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
      <PlatformPage title="IA de Atendimento">
        <p className="text-[var(--rz-text-muted)]">Sem permissão para configurar IA.</p>
      </PlatformPage>
    )
  }

  if (isLoading || !form) {
    return (
      <PlatformPage title="IA de Atendimento">
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
    <PlatformPage
      title="IA de Atendimento"
      description="Configure triagem inteligente, base de conhecimento, skills e regras de transferência para humano."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/platform/inbox" className="inline-flex items-center gap-1 text-sm text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]">
          <ArrowLeft className="w-4 h-4" /> Voltar à caixa de entrada
        </Link>
        <span className="inline-flex items-center gap-2 text-sm text-brand-400">
          <Sparkles className="w-4 h-4" /> Assistente virtual WhatsApp e site
        </span>
      </div>

      <InboxStatsRow
        items={[
          {
            label: 'Status da IA',
            value: form.settings.mode === 'disabled' ? 'Desligada' : 'Ativa',
            icon: Sparkles,
            colorClass: form.settings.mode === 'disabled' ? 'text-[var(--rz-text-muted)]' : 'text-emerald-400',
            description:
              form.settings.mode === 'radarzap'
                ? 'Modo RadarZap'
                : form.settings.mode === 'company'
                  ? 'Chave da empresa'
                  : 'Bot fixo',
          },
          {
            label: 'Uso diário',
            value: `${form.usage.dailyUsed}/${form.usage.dailyLimit}`,
            icon: BarChart3,
            colorClass: 'text-blue-400',
            description: 'Chamadas hoje',
            alert: form.usage.dailyUsed >= form.usage.dailyLimit * 0.9,
          },
          {
            label: 'Uso mensal',
            value: `${form.usage.monthlyUsed}/${form.usage.monthlyLimit}`,
            icon: BarChart3,
            colorClass: 'text-violet-400',
            description: 'Chamadas no mês',
          },
          {
            label: 'Skills pendentes',
            value: (form.skills ?? []).filter(s => s.status === 'pending').length,
            icon: Brain,
            colorClass: 'text-amber-400',
            description: 'Aguardando aprovação',
            alert: (form.skills ?? []).some(s => s.status === 'pending'),
          },
          {
            label: 'Memórias pendentes',
            value: (form.memories ?? []).filter(m => m.status === 'pending').length,
            icon: MessageSquare,
            colorClass: 'text-amber-400',
            description: 'Aguardando aprovação',
          },
          {
            label: 'Base ativa',
            value: form.knowledgeBase.filter(k => k.active).length,
            icon: BookOpen,
            colorClass: 'text-brand-400',
            description: `${form.knowledgeBase.length} itens no total`,
          },
        ]}
      />

      {form.blueprintInfo && (
        <Card className="p-4 mb-4 border-brand-800/40 bg-brand-950/20">
          <p className="text-sm text-[var(--rz-text-secondary)]">
            O <strong>assistente virtual já vem pré-configurado</strong> pela RadarZap — personalidade,
            triagem, tom de voz e fluxo de atendimento funcionam assim que você ativar a IA. Você só
            precisa alimentar o conhecimento da <em>sua</em> empresa:{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('kb')}>
              Base de conhecimento
            </button>
            ,{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('skills')}>
              Skills
            </button>{' '}
            e{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('memory')}>
              Memória
            </button>
            . Opcionalmente ajuste o <strong>nome do assistente</strong> (aba Geral), as{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('saudacoes')}>
              saudações
            </button>{' '}
            e as{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('regras')}>
              regras da empresa
            </button>
            .
          </p>
        </Card>
      )}

      <div className="rounded-xl bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)]/80 overflow-hidden">
        <div className="flex gap-1 p-1 overflow-x-auto scrollbar-thin">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                  : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] border border-transparent hover:bg-[var(--rz-surface-muted)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'geral' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Modo de operação
          </h2>
          {form.blueprintInfo && (
            <div className="rounded-lg border border-[var(--rz-border)] p-4 space-y-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] block mb-1">
                  Nome do assistente virtual
                </label>
                <input
                  className={inputCls}
                  value={form.prompt.agentName ?? ''}
                  onChange={e => patchPrompt({ agentName: e.target.value })}
                  placeholder={form.blueprintInfo.defaultAgentName || 'Assistente'}
                />
                <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                  Nome que o cliente vê nas mensagens. Vazio usa o padrão RadarZap (
                  <em>{form.blueprintInfo.defaultAgentName}</em>). Saudações ficam na aba{' '}
                  <button
                    type="button"
                    className="text-brand-400 hover:underline"
                    onClick={() => setTab('saudacoes')}
                  >
                    Saudações
                  </button>
                  .
                </p>
              </div>
            </div>
          )}
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
          <p className="text-xs text-[var(--rz-text-muted)]">
            Uso hoje: {form.usage.dailyUsed}/{form.usage.dailyLimit} diário ·{' '}
            {form.usage.monthlyUsed}/{form.usage.monthlyLimit} mensal
          </p>
        </Card>
      )}

      {tab === 'saudacoes' && form.blueprintInfo && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Hand className="w-5 h-5" /> Saudações da IA
          </h2>
          <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 text-sm text-[var(--rz-text-secondary)]">
            <p>
              Primeira mensagem automática quando a IA assume o atendimento no <strong>WhatsApp</strong>.
              No chat do site, a conversa segue o fluxo da triagem (nome já vem do formulário).
            </p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-2">
              Variáveis: {'{companyName}'}, {'{agentName}'}, {'{customerName}'} (apenas no cliente
              conhecido). Deixe em branco para usar o padrão RadarZap.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] block mb-1">
                Cliente com nome no cadastro
              </label>
              <textarea
                className={`${textareaCls} min-h-[100px] text-sm`}
                value={form.prompt.greetingKnown ?? ''}
                onChange={e => patchPrompt({ greetingKnown: e.target.value })}
                placeholder={form.blueprintInfo.defaultGreetingKnown}
              />
              <button
                type="button"
                className="text-xs text-brand-400 hover:underline mt-1"
                onClick={() => patchPrompt({ greetingKnown: '' })}
              >
                Usar padrão RadarZap
              </button>
            </div>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] block mb-1">
                Cliente sem nome no cadastro
              </label>
              <textarea
                className={`${textareaCls} min-h-[100px] text-sm`}
                value={form.prompt.greetingUnknown ?? ''}
                onChange={e => patchPrompt({ greetingUnknown: e.target.value })}
                placeholder={form.blueprintInfo.defaultGreetingUnknown}
              />
              <button
                type="button"
                className="text-xs text-brand-400 hover:underline mt-1"
                onClick={() => patchPrompt({ greetingUnknown: '' })}
              >
                Usar padrão RadarZap
              </button>
            </div>
          </div>
        </Card>
      )}

      {tab === 'provedor' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium">Provedor e modelo</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--rz-text-muted)]">Provedor</label>
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
              <label className="text-xs text-[var(--rz-text-muted)] mb-2 block">Modelo e preço (por 1M tokens)</label>
              <AiModelPicker
                models={form.modelCatalog}
                selectedId={form.settings.model}
                onSelect={selectModel}
                disabled={form.settings.mode !== 'company'}
                dailyLimit={form.settings.dailyLimit}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)]">Temperature ({form.settings.temperature})</label>
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
              <label className="text-xs text-[var(--rz-text-muted)]">Max tokens</label>
              <input
                type="number"
                min={400}
                max={4096}
                className={inputCls}
                value={form.settings.maxTokens}
                onChange={e => patch({ maxTokens: Math.max(400, Number(e.target.value)) })}
              />
              <p className="text-xs text-[var(--rz-text-muted)] mt-1">Mínimo 400 — valores baixos truncam a resposta (ex.: &quot;Here&quot;).</p>
            </div>
          </div>
          {form.settings.mode === 'company' && (
            <div className="border-t border-[var(--rz-border)] pt-4 space-y-3">
              <p className="text-sm text-[var(--rz-text-muted)]">
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
              {testResult && <p className="text-sm text-[var(--rz-text-secondary)]">{testResult}</p>}
            </div>
          )}
        </Card>
      )}

      {tab === 'regras' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Shield className="w-5 h-5" /> Economia de créditos e regras da empresa
          </h2>
          <p className="text-xs text-[var(--rz-text-muted)]">
            O assistente já vem com triagem e comportamento padrão da RadarZap. Aqui você ajusta
            economia de créditos e regras específicas do seu negócio (horários, produtos, o que não
            oferecer).
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
            <label className="text-xs text-[var(--rz-text-muted)] block mb-1">
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
          <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 space-y-3 text-sm text-[var(--rz-text-secondary)]">
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">Para que serve</p>
              <p className="mt-1">
                <strong>Skills</strong> são <em>receitas de solução</em>: quando o cliente descreve um problema
                recorrente, a IA segue o passo a passo que você cadastrou — muitas vezes <strong>sem chamar
                atendente</strong> e sem gastar créditos extras de IA.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">O que colocar aqui</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>
                  <strong>Título:</strong> nome curto do problema — ex. &quot;Rastreador offline&quot;, &quot;App não
                  conecta&quot;.
                </li>
                <li>
                  <strong>Gatilhos:</strong> palavras que o cliente costuma usar — ex. &quot;offline, sem sinal,
                  parou de atualizar, gps&quot;.
                </li>
                <li>
                  <strong>Solução:</strong> instruções claras em ordem — ex. reiniciar equipamento, conferir
                  cabo, reinstalar app.
                </li>
              </ul>
            </div>
            <p className="text-xs text-[var(--rz-text-muted)]">
              <strong>Diferença:</strong> use Skills para <em>resolver um problema</em>. Use a{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('kb')}>
                Base de conhecimento
              </button>{' '}
              para informações gerais (preços, planos, políticas) e{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('memory')}>
                Memória
              </button>{' '}
              para fatos curtos que valem em qualquer conversa. Itens <em>pendentes</em> podem surgir do
              aprendizado após atendimentos — você aprova ou rejeita antes de entrarem no ar.
            </p>
          </div>
          {(form.skills ?? []).length === 0 && (
            <p className="text-sm text-[var(--rz-text-muted)]">Nenhuma skill ainda. A IA pode propor após atendimentos.</p>
          )}
          {(form.skills ?? []).map((skill, idx) => (
            <div
              key={skill.id || idx}
              className={`border rounded-lg p-4 space-y-2 ${
                skill.status === 'pending'
                  ? 'border-amber-700/50 bg-amber-950/20'
                  : skill.status === 'rejected'
                    ? 'border-[var(--rz-border)] opacity-60'
                    : 'border-[var(--rz-border)]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs uppercase tracking-wide text-[var(--rz-text-muted)]">
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
                placeholder="Ex.: Rastreador offline / App não conecta"
              />
              <input
                className={inputCls}
                value={skill.triggers}
                onChange={e => {
                  const skills = [...(form.skills ?? [])]
                  skills[idx] = { ...skills[idx], triggers: e.target.value }
                  setForm(f => (f ? { ...f, skills } : f))
                }}
                placeholder="Ex.: offline, sem sinal, parou, não atualiza, gps"
              />
              <textarea
                className={textareaClsAi}
                value={skill.solution}
                onChange={e => {
                  const skills = [...(form.skills ?? [])]
                  skills[idx] = { ...skills[idx], solution: e.target.value }
                  setForm(f => (f ? { ...f, skills } : f))
                }}
                placeholder="Passo a passo para o cliente seguir. Ex.: 1) Desligue o rastreador por 30s. 2) Verifique se o LED pisca verde. 3) Abra o app e atualize a posição."
              />
              {skill.sourceProblem && (
                <p className="text-xs text-[var(--rz-text-muted)]">Problema origem: {skill.sourceProblem}</p>
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
          <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 space-y-3 text-sm text-[var(--rz-text-secondary)]">
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">Para que serve</p>
              <p className="mt-1">
                <strong>Memória</strong> guarda <em>fatos curtos e permanentes</em> que a IA deve lembrar em
                qualquer atendimento — regras internas, exceções, promoções vigentes ou decisões da empresa.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">O que colocar aqui</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>
                  <strong>Título:</strong> rótulo do fato — ex. &quot;Promoção março&quot;, &quot;Plano VIP&quot;.
                </li>
                <li>
                  <strong>Tags:</strong> palavras para a IA achar o fato — ex. &quot;promoção, desconto,
                  vip, plano anual&quot;.
                </li>
                <li>
                  <strong>Conteúdo:</strong> o fato em 1–3 frases — ex. &quot;Em março o plano anual tem 20%
                  de desconto&quot; ou &quot;Não vendemos mais o plano Básico 2019&quot;.
                </li>
              </ul>
            </div>
            <p className="text-xs text-[var(--rz-text-muted)]">
              <strong>Diferença:</strong> Memória é um <em>lembrete rápido</em>, não um tutorial (isso é{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('skills')}>
                Skill
              </button>
              ) nem um artigo longo (isso é{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('kb')}>
                Base de conhecimento
              </button>
              ). Sugestões aprendidas em atendimentos ficam <em>pendentes</em> até você aprovar.
            </p>
          </div>
          {(form.memories ?? []).length === 0 && (
            <p className="text-sm text-[var(--rz-text-muted)]">Nenhuma memória ainda.</p>
          )}
          {(form.memories ?? []).map((mem, idx) => (
            <div
              key={mem.id || idx}
              className={`border rounded-lg p-4 space-y-2 ${
                mem.status === 'pending'
                  ? 'border-amber-700/50 bg-amber-950/20'
                  : mem.status === 'rejected'
                    ? 'border-[var(--rz-border)] opacity-60'
                    : 'border-[var(--rz-border)]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs uppercase tracking-wide text-[var(--rz-text-muted)]">
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
                placeholder="Ex.: Promoção março / Plano VIP / Horário especial"
              />
              <input
                className={inputCls}
                value={mem.tags}
                onChange={e => {
                  const memories = [...(form.memories ?? [])]
                  memories[idx] = { ...memories[idx], tags: e.target.value }
                  setForm(f => (f ? { ...f, memories } : f))
                }}
                placeholder="Ex.: promoção, desconto, vip, plano anual"
              />
              <textarea
                className={textareaClsAi}
                value={mem.content}
                onChange={e => {
                  const memories = [...(form.memories ?? [])]
                  memories[idx] = { ...memories[idx], content: e.target.value }
                  setForm(f => (f ? { ...f, memories } : f))
                }}
                placeholder="Fato em poucas frases. Ex.: Em março o plano anual tem 20% de desconto. / Clientes VIP têm suporte prioritário."
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
                          {
                            id: '',
                            title: 'Novo item',
                            content: '',
                            category: 'Geral',
                            active: true,
                            keywords: [],
                            links: [],
                            showAsQuickReply: false,
                          },
                        ],
                      }
                    : f,
                )
              }
            >
              Adicionar
            </Button>
          </div>
          <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 space-y-3 text-sm text-[var(--rz-text-secondary)]">
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">Para que serve</p>
              <p className="mt-1">
                A <strong>Base de conhecimento</strong> é o <em>FAQ oficial</em> da sua empresa: produtos,
                serviços, preços, horários, políticas, promoções e qualquer informação que o cliente possa
                perguntar. A IA busca os itens mais relevantes na mensagem e responde com base neles.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">O que colocar aqui</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>
                  <strong>Título:</strong> tema da pergunta — ex. &quot;Planos e preços&quot;, &quot;Horário de
                  atendimento&quot;, &quot;Como contratar&quot;.
                </li>
                <li>
                  <strong>Categoria:</strong> agrupa artigos no botão <strong>FAQ</strong> do chat do site — ex.
                  &quot;Planos&quot;, &quot;Suporte&quot;, &quot;Contratação&quot;.
                </li>
                <li>
                  <strong>Conteúdo:</strong> texto completo e oficial — valores, condições, passos de
                  contratação, o que está incluso em cada plano, links úteis.
                </li>
              </ul>
            </div>
            <p className="text-xs text-[var(--rz-text-muted)]">
              <strong>Diferença:</strong> use a base para <em>informar</em> (o que vendemos, quanto custa, como
              funciona). Use{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('skills')}>
                Skills
              </button>{' '}
              para <em>resolver problemas</em> com passo a passo e{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('memory')}>
                Memória
              </button>{' '}
              para fatos curtos que valem em qualquer conversa. Só itens <strong>ativos</strong> entram na
              busca — desative os desatualizados em vez de apagar.
            </p>
          </div>
          {form.knowledgeBase.length === 0 && (
            <p className="text-sm text-[var(--rz-text-muted)]">
              Nenhum item ainda. Comece pelos temas que os clientes mais perguntam: planos, preços, suporte e
              como contratar.
            </p>
          )}
          {form.knowledgeBase.map((item, idx) => (
            <div key={item.id || idx} className="border border-[var(--rz-border)] rounded-lg p-4 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={inputCls}
                  value={item.category ?? 'Geral'}
                  list="kb-category-suggestions"
                  onChange={e => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = { ...kb[idx], category: e.target.value }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                  placeholder="Categoria — ex.: Planos, Suporte, Contratação"
                />
                <p className="text-xs text-[var(--rz-text-muted)] self-center sm:text-right">
                  Agrupa no botão FAQ do chat do site
                </p>
              </div>
              <input
                className={inputCls}
                value={item.title}
                onChange={e => {
                  const kb = [...form.knowledgeBase]
                  kb[idx] = { ...kb[idx], title: e.target.value }
                  setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                }}
                placeholder="Ex.: Planos e preços / Horário de atendimento / Promoções vigentes"
              />
              <textarea
                className={textareaClsAi}
                value={item.content}
                onChange={e => {
                  const kb = [...form.knowledgeBase]
                  kb[idx] = { ...kb[idx], content: e.target.value }
                  setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                }}
                placeholder="Texto oficial com todas as informações. Ex.: Oferecemos planos Mensal (R$ 49), Anual (R$ 490 com 2 meses grátis) e VIP (R$ 99/mês com suporte prioritário). Horário comercial: seg–sex 8h–18h."
              />
              <input
                className={inputCls}
                value={(item.keywords ?? []).join(', ')}
                onChange={e => {
                  const kb = [...form.knowledgeBase]
                  kb[idx] = {
                    ...kb[idx],
                    keywords: e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean),
                  }
                  setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                }}
                placeholder="Palavras-chave (separadas por vírgula): rastreio, pedido, entrega"
              />
              <div className="space-y-2">
                <p className="text-xs text-[var(--rz-text-muted)]">Links no chat (rótulo + URL https)</p>
                {(item.links ?? []).map((link, linkIdx) => (
                  <div key={linkIdx} className="flex flex-col sm:flex-row gap-2">
                    <input
                      className={inputCls}
                      value={link.label}
                      placeholder="Rótulo — ex.: Acompanhar pedido"
                      onChange={e => {
                        const kb = [...form.knowledgeBase]
                        const links = [...(kb[idx].links ?? [])]
                        links[linkIdx] = { ...links[linkIdx], label: e.target.value }
                        kb[idx] = { ...kb[idx], links }
                        setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                      }}
                    />
                    <input
                      className={inputCls}
                      value={link.url}
                      placeholder="https://…"
                      onChange={e => {
                        const kb = [...form.knowledgeBase]
                        const links = [...(kb[idx].links ?? [])]
                        links[linkIdx] = { ...links[linkIdx], url: e.target.value }
                        kb[idx] = { ...kb[idx], links }
                        setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const kb = [...form.knowledgeBase]
                        const links = [...(kb[idx].links ?? [])]
                        links.splice(linkIdx, 1)
                        kb[idx] = { ...kb[idx], links }
                        setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = {
                      ...kb[idx],
                      links: [...(kb[idx].links ?? []), { label: '', url: '', openInNewTab: true }],
                    }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                >
                  Adicionar link
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(item.showAsQuickReply)}
                  onChange={e => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = { ...kb[idx], showAsQuickReply: e.target.checked }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                />
                Sugestão rápida no chat do site
              </label>
              {item.showAsQuickReply && (
                <input
                  className={inputCls}
                  value={item.quickReplyLabel ?? ''}
                  onChange={e => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = { ...kb[idx], quickReplyLabel: e.target.value }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                  placeholder="Texto do botão (opcional — usa o título se vazio)"
                />
              )}
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
          <datalist id="kb-category-suggestions">
            {[...new Set(form.knowledgeBase.map(k => (k.category?.trim() || 'Geral')))]
              .sort((a, b) => a.localeCompare(b, 'pt-BR'))
              .map(cat => (
                <option key={cat} value={cat} />
              ))}
          </datalist>
        </Card>
      )}

      {tab === 'limites' && (
        <Card className="p-6 grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Limite diário</label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.dailyLimit}
              onChange={e => patch({ dailyLimit: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Limite mensal</label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.monthlyLimit}
              onChange={e => patch({ monthlyLimit: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Por conversa</label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.perConversationLimit}
              onChange={e => patch({ perConversationLimit: Number(e.target.value) })}
            />
          </div>
          <p className="md:col-span-3 text-xs text-[var(--rz-text-muted)]">
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
            <label className="text-xs text-[var(--rz-text-muted)]">Limiar confiança</label>
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
              <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                <div className="text-2xl font-semibold">{usageDetail.totals.calls}</div>
                <div className="text-xs text-[var(--rz-text-muted)]">chamadas (30d)</div>
              </div>
              <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                <div className="text-2xl font-semibold">{usageDetail.totals.tokens}</div>
                <div className="text-xs text-[var(--rz-text-muted)]">tokens</div>
              </div>
              <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                <div className="text-2xl font-semibold">
                  US$ {usageDetail.totals.cost.toFixed(4)}
                </div>
                <div className="text-xs text-[var(--rz-text-muted)]">custo est.</div>
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === 'testar' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium">Testar conexão com o provedor</h2>
          <Button type="button" onClick={() => testConn.mutate(undefined)} disabled={testConn.isPending}>
            Ping no provedor
          </Button>
          {testResult && <p className="text-sm">{testResult}</p>}
        </Card>
      )}

      {tab !== 'testar' && tab !== 'logs' && (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button type="button" onClick={handleSave} disabled={save.isPending} className="shadow-lg">
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? 'Salvando…' : 'Salvar configurações'}
          </Button>
        </div>
      )}
      </div>
    </PlatformPage>
  )
}
