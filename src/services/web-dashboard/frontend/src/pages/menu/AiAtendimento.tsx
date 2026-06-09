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
} from 'lucide-react'
import { AiModelPicker, type AiModelOption } from '../../components/ai/AiModelPicker'

type TabId =
  | 'geral'
  | 'provedor'
  | 'prompt'
  | 'coleta'
  | 'kb'
  | 'limites'
  | 'transferencia'
  | 'logs'
  | 'testar'

const TABS: { id: TabId; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'provedor', label: 'Provedor' },
  { id: 'prompt', label: 'Prompt da IA' },
  { id: 'coleta', label: 'Dados a coletar' },
  { id: 'kb', label: 'Base de conhecimento' },
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
    systemPrompt: string
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
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'
const textareaCls = `${inputCls} min-h-[120px] resize-y`

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
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch('/platform/ai/settings', payload),
    onSuccess: (res: AiPayload) => {
      setForm(res)
      qc.setQueryData(['ai-settings'], res)
      setApiKeyInput('')
    },
  })

  const removeKey = useMutation({
    mutationFn: () => api.delete('/platform/ai/key'),
    onSuccess: (res: AiPayload) => {
      setForm(res)
      qc.setQueryData(['ai-settings'], res)
    },
  })

  const testConn = useMutation({
    mutationFn: (apiKey?: string) =>
      api.post<{ ok: boolean; message: string }>('/platform/ai/test', apiKey ? { apiKey } : {}),
    onSuccess: r => setTestResult(r.ok ? `OK: ${r.message}` : `Falha: ${r.message}`),
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
        <Spinner />
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
                className={inputCls}
                value={form.settings.maxTokens}
                onChange={e => patch({ maxTokens: Number(e.target.value) })}
              />
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

      {tab === 'prompt' && (
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Prompt do sistema
          </h2>
          <p className="text-xs text-gray-500">Use {'{companyName}'} para o nome da empresa.</p>
          <textarea
            className={textareaCls}
            value={form.prompt.systemPrompt}
            onChange={e => patchPrompt({ systemPrompt: e.target.value })}
          />
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
                className={textareaCls}
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
