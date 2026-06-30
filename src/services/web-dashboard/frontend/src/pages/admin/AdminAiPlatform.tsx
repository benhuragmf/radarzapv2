import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useUrlHashTab } from '@/lib/useUrlHashTab'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import {
  Save,
  Sparkles,
  Key,
  BarChart3,
  Zap,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import {
  RadarPageShell,
  PageHeader,
  LoadingState,
  inputCls,
} from '@/design-system'
import { AiModelPicker } from '../../components/ai/AiModelPicker'
import AdminOpsHubLink from './AdminOpsHubLink'

type AdminTab = 'credentials' | 'usage'

type CredentialsPayload = {
  provider: 'openai' | 'gemini'
  llmModel: string
  hasOpenAiKey: boolean
  hasGeminiKey: boolean
  openAiKeyMasked: string | null
  geminiKeyMasked: string | null
  activeKeySource: 'database' | 'env' | 'none'
  envFallbackAvailable: boolean
  modelCatalog: Array<{
    id: string
    label: string
    description: string
    inputUsdPer1M: number
    outputUsdPer1M: number
    tier: string
    recommended?: boolean
    deprecated?: boolean
  }>
  modelCatalogs: {
    openai: CredentialsPayload['modelCatalog']
    gemini: CredentialsPayload['modelCatalog']
  }
  version: number
  updatedAt: string
}

type UsagePayload = {
  period: { from: string; to: string }
  totals: {
    calls: number
    tokens: number
    cost: number
    credits: number
    byKind: {
      premium_assistant: { calls: number; credits: number }
      basic_triage: { calls: number; credits: number }
    }
  }
  byClient: Array<{
    clientId: string
    clientName: string
    plan: string
    calls: number
    tokens: number
    cost: number
    credits: number
  }>
  rows: Array<{
    id: string
    createdAt: string
    clientId: string
    clientName: string
    usageKindLabel: string
    creditWeight: number
    llmModel: string
    totalTokens: number
    estimatedCost: number
  }>
}

function formatCredits(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

function keySourceLabel(source: CredentialsPayload['activeKeySource']): string {
  if (source === 'database') return 'Painel admin (criptografada)'
  if (source === 'env') return 'Variável .env no servidor'
  return 'Não configurada'
}

const TABS: { id: AdminTab; label: string; icon: typeof Key }[] = [
  { id: 'credentials', label: 'Credenciais', icon: Key },
  { id: 'usage', label: 'Relatório de uso', icon: BarChart3 },
]

export default function AdminAiPlatform() {
  const qc = useQueryClient()
  const [tab, setTab] = useUrlHashTab(['credentials', 'usage'] as const, 'credentials')
  const [form, setForm] = useState<CredentialsPayload | null>(null)
  const [openAiKeyInput, setOpenAiKeyInput] = useState('')
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [usageDays, setUsageDays] = useState(30)

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['admin-ai-platform-credentials'],
    queryFn: () => api.get<CredentialsPayload>('/admin/ai-platform/credentials'),
  })

  useEffect(() => {
    if (credentials) setForm(credentials)
  }, [credentials])

  const usageQuery = useQuery({
    queryKey: ['admin-ai-platform-usage', usageDays],
    enabled: tab === 'usage',
    queryFn: () => {
      const to = new Date()
      const from = new Date(to.getTime() - usageDays * 24 * 60 * 60 * 1000)
      return api.get<UsagePayload>(
        `/admin/ai-platform/usage?from=${from.toISOString()}&to=${to.toISOString()}&limit=200`,
      )
    },
  })

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch<CredentialsPayload>('/admin/ai-platform/credentials', payload),
    onSuccess: res => {
      setForm(res)
      setOpenAiKeyInput('')
      setGeminiKeyInput('')
      qc.setQueryData(['admin-ai-platform-credentials'], res)
    },
  })

  const removeKey = useMutation({
    mutationFn: (target: 'openai' | 'gemini') =>
      api.delete<CredentialsPayload>(`/admin/ai-platform/credentials/keys/${target}`),
    onSuccess: res => {
      setForm(res)
      qc.setQueryData(['admin-ai-platform-credentials'], res)
    },
  })

  const testConn = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ ok: boolean; message: string; model: string; keySource: string }>(
        '/admin/ai-platform/credentials/test',
        body,
      ),
    onSuccess: res => {
      setTestResult(res.ok ? `OK — ${res.message} (${res.model})` : `Falha: ${res.message}`)
    },
  })

  const modelOptions = useMemo(() => {
    if (!form) return []
    const catalog = form.modelCatalogs[form.provider] ?? form.modelCatalog
    return catalog.map(m => ({
      ...m,
      typicalTurnCostUsd:
        (m.inputUsdPer1M * 800) / 1_000_000 + (m.outputUsdPer1M * 200) / 1_000_000,
    }))
  }, [form])

  if (isLoading || !form) {
    return (
      <RadarPageShell maxWidth="wide">
        <LoadingState rows={5} className="pt-8" />
      </RadarPageShell>
    )
  }

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      provider: form.provider,
      llmModel: form.llmModel,
    }
    if (openAiKeyInput.trim()) payload.openAiApiKey = openAiKeyInput.trim()
    if (geminiKeyInput.trim()) payload.geminiApiKey = geminiKeyInput.trim()
    save.mutate(payload)
  }

  const activeKeyMasked =
    form.provider === 'gemini' ? form.geminiKeyMasked : form.openAiKeyMasked

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="IA da plataforma (Radar Chat)"
        subtitle={
          <>
            Chave, modelo e relatório de consumo da IA usada pelos clientes no modo{' '}
            <strong>Radar Chat</strong>. Comportamento global do assistente em{' '}
            <Link to="/admin/ai-blueprint" className="text-brand-400 hover:underline inline-flex items-center gap-1">
              Modelo global de IA <ExternalLink className="w-3 h-3" />
            </Link>
            .
          </>
        }
        actions={
          tab === 'credentials' ? (
            <Button type="button" onClick={handleSave} disabled={save.isPending}>
              <Save className="w-4 h-4 mr-1" /> Salvar credenciais
            </Button>
          ) : null
        }
      />

      <AdminOpsHubLink
        tab="ai"
        label="Visão consolidada de IA no dashboard Ops:"
      />

      <div className="flex flex-wrap gap-2 border-b border-[var(--rz-border)] pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
              tab === t.id
                ? 'bg-[var(--rz-primary)] text-white'
                : 'text-[var(--rz-text-muted)] hover:bg-[var(--rz-surface-muted)]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'credentials' && (
        <div className="space-y-4">
          {form.activeKeySource === 'none' && !form.envFallbackAvailable && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 flex gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <strong>Nenhuma chave ativa.</strong> Clientes com provedor Radar Chat não conseguirão
                usar IA até configurar a chave aqui ou no <code className="text-xs">.env</code> do
                servidor.
              </div>
            </div>
          )}

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Motor LLM padrão
            </h2>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Todos os tenants em modo <strong>Radar Chat</strong> usam este provedor e modelo. A chave
              ativa: <strong>{keySourceLabel(form.activeKeySource)}</strong>
              {activeKeyMasked ? ` · ${activeKeyMasked}` : ''}.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Provedor</label>
                <select
                  className={inputCls}
                  value={form.provider}
                  onChange={e => {
                    const provider = e.target.value as 'openai' | 'gemini'
                    const catalog = form.modelCatalogs[provider]
                    const recommended =
                      catalog.find(m => m.recommended)?.id ?? catalog[0]?.id ?? form.llmModel
                    setForm(f =>
                      f ? { ...f, provider, llmModel: recommended, modelCatalog: catalog } : f,
                    )
                  }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-[var(--rz-text-muted)] mb-2 block">
                  Modelo padrão (chave Radar Chat)
                </label>
                <AiModelPicker
                  models={modelOptions}
                  selectedId={form.llmModel}
                  onSelect={id => setForm(f => (f ? { ...f, llmModel: id } : f))}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Key className="w-5 h-5" /> Chaves de API
            </h2>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Salvas criptografadas no banco. Se vazias, o servidor usa{' '}
              <code className="text-[10px]">RADARCHAT_AI_OPENAI_KEY</code> /{' '}
              <code className="text-[10px]">RADARCHAT_AI_GEMINI_KEY</code> (ou{' '}
              <code className="text-[10px]">OPENAI_API_KEY</code> /{' '}
              <code className="text-[10px]">GEMINI_API_KEY</code>) do <code className="text-[10px]">.env</code>.
            </p>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-3 border border-[var(--rz-border)] rounded-lg p-4">
                <h3 className="text-sm font-medium">OpenAI</h3>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Salva: {form.hasOpenAiKey ? form.openAiKeyMasked : 'nenhuma'}
                </p>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="sk-proj-… (nova chave)"
                  value={openAiKeyInput}
                  onChange={e => setOpenAiKeyInput(e.target.value)}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!form.hasOpenAiKey}
                  onClick={() => removeKey.mutate('openai')}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Remover do painel
                </Button>
              </div>

              <div className="space-y-3 border border-[var(--rz-border)] rounded-lg p-4">
                <h3 className="text-sm font-medium">Google Gemini</h3>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Salva: {form.hasGeminiKey ? form.geminiKeyMasked : 'nenhuma'}
                </p>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="AIza… (nova chave)"
                  value={geminiKeyInput}
                  onChange={e => setGeminiKeyInput(e.target.value)}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!form.hasGeminiKey}
                  onClick={() => removeKey.mutate('gemini')}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Remover do painel
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--rz-border)]">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  testConn.mutate({
                    provider: form.provider,
                    llmModel: form.llmModel,
                    apiKey:
                      form.provider === 'gemini'
                        ? geminiKeyInput || undefined
                        : openAiKeyInput || undefined,
                  })
                }
                disabled={testConn.isPending}
              >
                <Zap className="w-4 h-4 mr-1" /> Testar conexão
              </Button>
              {testResult && (
                <p className="text-sm text-[var(--rz-text-secondary)] self-center">{testResult}</p>
              )}
            </div>

            <p className="text-[10px] text-[var(--rz-text-muted)]">
              Versão {form.version} · atualizado em {new Date(form.updatedAt).toLocaleString('pt-BR')}
            </p>
          </Card>
        </div>
      )}

      {tab === 'usage' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Consumo IA Radar Chat (todos os clientes)
            </h2>
            <select
              className={`${inputCls} w-auto`}
              value={usageDays}
              onChange={e => setUsageDays(Number(e.target.value))}
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>

          {usageQuery.isLoading && <LoadingState rows={3} />}

          {usageQuery.data && (
            <>
              <p className="text-xs text-[var(--rz-text-muted)]">
                Período: {new Date(usageQuery.data.period.from).toLocaleDateString('pt-BR')} —{' '}
                {new Date(usageQuery.data.period.to).toLocaleDateString('pt-BR')}. Apenas chamadas na
                chave Radar Chat (não inclui API própria dos clientes).
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                  <div className="text-2xl font-semibold">{usageQuery.data.totals.calls}</div>
                  <div className="text-xs text-[var(--rz-text-muted)]">Chamadas LLM</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="text-2xl font-semibold">
                    {formatCredits(usageQuery.data.totals.credits)}
                  </div>
                  <div className="text-xs text-[var(--rz-text-muted)]">Créditos (custo real)</div>
                </div>
                <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-4">
                  <div className="text-2xl font-semibold">
                    {usageQuery.data.totals.byKind.premium_assistant.calls}
                  </div>
                  <div className="text-xs text-[var(--rz-text-muted)]">IA Premium</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <div className="text-2xl font-semibold">
                    {usageQuery.data.totals.byKind.basic_triage.calls}
                  </div>
                  <div className="text-xs text-[var(--rz-text-muted)]">IA Básica (LLM)</div>
                </div>
                <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                  <div className="text-2xl font-semibold">{usageQuery.data.totals.tokens}</div>
                  <div className="text-xs text-[var(--rz-text-muted)]">Tokens</div>
                </div>
                <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                  <div className="text-2xl font-semibold">
                    US$ {usageQuery.data.totals.cost.toFixed(4)}
                  </div>
                  <div className="text-xs text-[var(--rz-text-muted)]">Custo est.</div>
                </div>
              </div>

              {usageQuery.data.byClient.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Por cliente (top 50)</h3>
                  <div className="overflow-x-auto rounded-lg border border-[var(--rz-border)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--rz-surface-muted)]/50 text-[var(--rz-text-muted)]">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Cliente</th>
                          <th className="text-left px-3 py-2 font-medium">Plano</th>
                          <th className="text-right px-3 py-2 font-medium">Chamadas</th>
                          <th className="text-right px-3 py-2 font-medium">Créditos</th>
                          <th className="text-right px-3 py-2 font-medium">Custo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageQuery.data.byClient.map(row => (
                          <tr key={row.clientId} className="border-t border-[var(--rz-border)]">
                            <td className="px-3 py-2">{row.clientName}</td>
                            <td className="px-3 py-2 capitalize">{row.plan}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.calls}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCredits(row.credits)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              US$ {row.cost.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {usageQuery.data.rows.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Últimas chamadas</h3>
                  <div className="overflow-x-auto rounded-lg border border-[var(--rz-border)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--rz-surface-muted)]/50 text-[var(--rz-text-muted)]">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Data</th>
                          <th className="text-left px-3 py-2 font-medium">Cliente</th>
                          <th className="text-left px-3 py-2 font-medium">Modo</th>
                          <th className="text-right px-3 py-2 font-medium">Créditos</th>
                          <th className="text-left px-3 py-2 font-medium">Modelo</th>
                          <th className="text-right px-3 py-2 font-medium">Custo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageQuery.data.rows.slice(0, 100).map(row => (
                          <tr key={row.id} className="border-t border-[var(--rz-border)]">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-3 py-2">{row.clientName}</td>
                            <td className="px-3 py-2">{row.usageKindLabel}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.creditWeight > 0 ? formatCredits(row.creditWeight) : '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px]">{row.llmModel}</td>
                            <td className="px-3 py-2 text-right">
                              US$ {row.estimatedCost.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {usageQuery.data.rows.length === 0 && (
                <p className="text-sm text-[var(--rz-text-muted)]">
                  Nenhuma chamada na chave Radar Chat no período selecionado.
                </p>
              )}
            </>
          )}
        </Card>
      )}
    </RadarPageShell>
  )
}
