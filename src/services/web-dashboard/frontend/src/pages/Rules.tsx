import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useGuild } from '../lib/guildContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { BookOpen, ToggleLeft, ToggleRight, Trash2, Plus, Pencil, X, Check, Hash, AlertTriangle } from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'
import DestinationMultiSelect from '../components/discord/DestinationMultiSelect'
import { discordNavAlertsQueryKey } from '../lib/useDiscordNavAlerts'
import { LoadingState, MetricCard, EmptyState, inputCls } from '@/design-system'

interface Rule {
  _id: string
  name: string
  isActive: boolean
  matchCount: number
  conditions: { channelIds?: string[]; requireKeywords?: string[] }
  action: { templateName: string; priority: string; destinationIds: string[] }
  executionBlock?: {
    reason: string | null
    blockedGroupNames: string[]
  }
}

interface Destination {
  _id: string
  name: string
  identifier: string
  type: string
}

interface Template {
  _id: string
  name: string
  discordKind?: string
}

interface Channel {
  _id: string
  channelId: string
  channelName: string
  guildName: string
}

// ── Form state ────────────────────────────────────────────────────────────────
interface RuleForm {
  name: string
  priority: 'high' | 'medium' | 'low'
  templateName: string
  keywords: string
  destinationIdentifiers: string[]
  channelIds: string[]
}

const emptyForm: RuleForm = {
  name: '',
  priority: 'medium',
  templateName: 'dw-padrao',
  keywords: '',
  destinationIdentifiers: [],
  channelIds: [],
}

function ruleToForm(r: Rule, destinations: Destination[]): RuleForm {
  const destIds = new Set(r.action.destinationIds)
  const identifiers = destinations
    .filter(d => destIds.has(d._id))
    .map(d => d.identifier)
  return {
    name: r.name,
    priority: r.action.priority as 'high' | 'medium' | 'low',
    templateName: r.action.templateName,
    keywords: (r.conditions.requireKeywords ?? []).join(', '),
    destinationIdentifiers: identifiers,
    channelIds: r.conditions.channelIds ?? [],
  }
}

// ── Inline form component ─────────────────────────────────────────────────────
function RuleFormPanel({
  initial,
  destinations,
  templates,
  channels,
  onSave,
  onCancel,
  saving,
}: {
  initial: RuleForm
  destinations: Destination[]
  templates: Template[]
  channels: Channel[]
  onSave: (f: RuleForm) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<RuleForm>(initial)
  const set = (k: keyof RuleForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const labelCls = 'text-xs text-gray-500 mb-1 block'

  const toggleChannel = (channelId: string) => {
    setForm(f => ({
      ...f,
      channelIds: f.channelIds.includes(channelId)
        ? f.channelIds.filter(id => id !== channelId)
        : [...f.channelIds, channelId],
    }))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Name */}
        <div className="md:col-span-2">
          <label className={labelCls}>Nome da regra *</label>
          <input value={form.name} onChange={e => set('name', e.currentTarget.value)}
            placeholder="Ex: Promoções do canal #ofertas"
            className={inputCls} />
        </div>

        {/* Priority */}
        <div>
          <label className={labelCls}>Prioridade</label>
          <select value={form.priority} onChange={e => set('priority', e.currentTarget.value)}
            className={inputCls}>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>

        {/* Template */}
        <div>
          <label className={labelCls}>Template</label>
          <select value={form.templateName} onChange={e => set('templateName', e.currentTarget.value)}
            className={inputCls}>
            <option value="dw-padrao">dw-padrao (automático — recomendado)</option>
            <optgroup label="Discord → WhatsApp">
              {templates
                .filter(t => t.name.startsWith('dw-') && t.name !== 'dw-padrao')
                .map(t => (
                  <option key={t._id} value={t.name}>
                    {t.name}
                    {t.discordKind ? ` — ${t.discordKind}` : ''}
                  </option>
                ))}
            </optgroup>
            {templates.some(t => !t.name.startsWith('dw-')) && (
              <optgroup label="Legado">
                {templates
                  .filter(t => !t.name.startsWith('dw-'))
                  .map(t => (
                    <option key={t._id} value={t.name}>{t.name}</option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Channels */}
        <div className="md:col-span-2">
          <label className={labelCls}>
            Canais monitorados
            <span className="text-gray-600 ml-1">(vazio = todos os canais configurados)</span>
          </label>
          {channels.length === 0 ? (
            <p className="text-xs text-gray-600">Nenhum canal configurado. Adicione em <a href="/channels" className="text-brand-400 hover:underline">Canais Discord</a>.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {channels.map(ch => (
                <button
                  key={ch._id}
                  type="button"
                  onClick={() => toggleChannel(ch.channelId)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                    form.channelIds.includes(ch.channelId)
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span className="text-gray-400">#</span>
                  {ch.channelName || ch.channelId}
                  {ch.guildName && <span className="text-gray-500 text-[10px]"> · {ch.guildName}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Keywords */}
        <div className="md:col-span-2">
          <label className={labelCls}>Keywords obrigatórias (separadas por vírgula)</label>
          <input value={form.keywords} onChange={e => set('keywords', e.currentTarget.value)}
            placeholder="promoção, desconto, grátis"
            className={inputCls} />
        </div>

        {/* Destinations */}
        <div className="md:col-span-2">
          <label className={labelCls}>
            Destinos WhatsApp
            <span className="text-gray-600 ml-1">(vazio = todos os destinos ativos)</span>
          </label>
          <DestinationMultiSelect
            destinations={destinations}
            value={form.destinationIdentifiers}
            onChange={ids => setForm(f => ({ ...f, destinationIdentifiers: ids }))}
            destinationsLink="/discord/contact"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={() => onSave(form)} disabled={!form.name.trim() || saving}>
          {saving ? <Spinner size={12} /> : <Check size={12} />}
          Salvar
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          <X size={12} /> Cancelar
        </Button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Rules() {
  const qc = useQueryClient()
  const { guildId, guildName } = useGuild()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ['rules', guildId],
    queryFn: () => api.get(`/rules${guildId ? `?guildId=${guildId}` : ''}`),
    refetchInterval: 30_000,
  })

  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
  })

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates'),
  })

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: () => api.get('/channels'),
  })

  const invalidateRuleQueries = () => {
    qc.invalidateQueries({ queryKey: ['rules'] })
    qc.invalidateQueries({ queryKey: discordNavAlertsQueryKey(guildId) })
  }

  const toggle = useMutation({
    mutationFn: (id: string) => api.post(`/rules/${id}/toggle`),
    onSuccess: invalidateRuleQueries,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/rules/${id}`),
    onSuccess: invalidateRuleQueries,
  })

  const create = useMutation({
    mutationFn: (f: RuleForm) => api.post('/rules', {
      name: f.name,
      priority: f.priority,
      templateName: f.templateName,
      keywords: f.keywords,
      channelIds: f.channelIds,
      destinationIdentifiers: f.destinationIdentifiers,
    }),
    onSuccess: () => {
      invalidateRuleQueries()
      setCreating(false)
    },
  })

  const update = useMutation({
    mutationFn: ({ id, form }: { id: string; form: RuleForm }) =>
      api.put(`/rules/${id}`, {
        name: form.name,
        priority: form.priority,
        templateName: form.templateName,
        keywords: form.keywords,
        channelIds: form.channelIds,
        destinationIdentifiers: form.destinationIdentifiers,
      }),
    onSuccess: () => {
      invalidateRuleQueries()
      setEditingId(null)
    },
  })

  if (isLoading) {
    return (
      <DiscordPage description="Quando uma mensagem chega em um canal monitorado, as regras definem template, destinos e prioridade do envio ao WhatsApp.">
        <LoadingState rows={5} className="pt-8" />
      </DiscordPage>
    )
  }

  const activeRules = rules.filter(r => r.isActive).length
  const blockedRules = rules.filter(r => r.isActive && r.executionBlock?.reason)

  return (
    <DiscordPage
      description="Quando uma mensagem chega em um canal monitorado, as regras definem template, destinos e prioridade do envio ao WhatsApp."
      actions={
        !creating ? (
          <Button size="sm" onClick={() => { setCreating(true); setEditingId(null) }}>
            <Plus size={12} /> Nova regra
          </Button>
        ) : undefined
      }
    >
      {blockedRules.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-950/25 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <AlertTriangle size={18} className="shrink-0 text-red-400 mt-0.5" />
          <div>
            <p className="font-medium text-red-300">
              {blockedRules.length === 1
                ? '1 regra bloqueada para envio'
                : `${blockedRules.length} regras bloqueadas para envio`}
            </p>
            <p className="mt-1 text-red-200/90">
              Regras com grupo destino inacessível não são executadas. Entre no grupo com o número da sessão ou ajuste os destinos.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard title="Regras" value={rules.length} icon={BookOpen} />
        <MetricCard title="Ativas" value={activeRules} icon={ToggleRight} />
        <MetricCard title="Canais cadastrados" value={channels.length} icon={Hash} />
      </div>

      {!guildId && (
        <p className="text-xs text-amber-500/90 flex items-center gap-1.5">
          <Hash size={12} /> Selecione o servidor Discord na barra lateral para filtrar regras por guild.
        </p>
      )}
      {guildName && (
        <p className="text-xs text-gray-500">Exibindo regras do contexto · {guildName}</p>
      )}

      {/* Create form */}
      {creating && (
        <Card className="border-brand-700">
          <p className="text-sm font-medium text-brand-400 mb-4">Nova Regra</p>
          <RuleFormPanel
            initial={emptyForm}
            destinations={destinations}
            templates={templates}
            channels={channels}
            onSave={f => create.mutate(f)}
            onCancel={() => setCreating(false)}
            saving={create.isPending}
          />
        </Card>
      )}

      {/* Empty state */}
      {rules.length === 0 && !creating && (
        <EmptyState
          icon={BookOpen}
          title="Nenhuma regra configurada"
          description="Crie regras para definir template, destinos e prioridade dos envios ao WhatsApp."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={12} /> Criar primeira regra
            </Button>
          }
        />
      )}

      {/* Rule cards */}
      {rules.map((r) => {
        const blocked = Boolean(r.isActive && r.executionBlock?.reason)
        return (
        <Card key={r._id} className={blocked ? 'border-red-800/50' : undefined}>
          {editingId === r._id ? (
            <>
              <p className="text-sm font-medium text-yellow-400 mb-4">Editando: {r.name}</p>
              <RuleFormPanel
                initial={ruleToForm(r, destinations)}
                destinations={destinations}
                templates={templates}
                channels={channels}
                onSave={f => update.mutate({ id: r._id, form: f })}
                onCancel={() => setEditingId(null)}
                saving={update.isPending}
              />
            </>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{r.name}</span>
                  {blocked ? (
                    <Badge label="Bloqueada" variant="red" />
                  ) : (
                    <Badge label={r.isActive ? 'Ativa' : 'Inativa'} variant={r.isActive ? 'green' : 'gray'} />
                  )}
                  <Badge label={r.action.priority} variant="blue" />
                </div>
                {blocked && r.executionBlock?.reason && (
                  <p className="text-xs text-red-300/90 mb-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>Não executa: {r.executionBlock.reason}</span>
                  </p>
                )}
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>Template: <span className="text-gray-300">{r.action.templateName}</span></p>
                  {r.conditions.channelIds?.length ? (
                    <p>Canais: <span className="text-gray-300">
                      {r.conditions.channelIds.map(id => {
                        const ch = channels.find(c => c.channelId === id)
                        return ch ? `#${ch.channelName || id}` : `#${id}`
                      }).join(', ')}
                    </span></p>
                  ) : null}
                  {r.conditions.requireKeywords?.length ? (
                    <p>Keywords: <span className="text-gray-300">{r.conditions.requireKeywords.join(', ')}</span></p>
                  ) : null}
                  <p>
                    Destinos:{' '}
                    <span className="text-gray-300">
                      {r.action.destinationIds?.length
                        ? (() => {
                            const ids = new Set(r.action.destinationIds)
                            const names = destinations.filter(d => ids.has(d._id)).map(d => d.name)
                            return names.length ? names.join(', ') : `${r.action.destinationIds.length} destino(s)`
                          })()
                        : 'Todos os ativos'}
                    </span>
                  </p>
                  <p>Matches: <span className="text-brand-400 font-medium">{r.matchCount}</span></p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setEditingId(r._id); setCreating(false) }}
                  className="text-gray-600 hover:text-yellow-400 transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => toggle.mutate(r._id)}
                  disabled={toggle.isPending}
                  className="text-gray-400 hover:text-white transition-colors"
                  title={r.isActive ? 'Desativar' : 'Ativar'}
                >
                  {r.isActive
                    ? <ToggleRight size={22} className="text-brand-500" />
                    : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => { if (window.confirm('Deletar esta regra?')) remove.mutate(r._id) }}
                  disabled={remove.isPending}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}
        </Card>
        )
      })}
    </DiscordPage>
  )
}
