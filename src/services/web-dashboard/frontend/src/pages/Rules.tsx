import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useGuild } from '../lib/guildContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { BookOpen, ToggleLeft, ToggleRight, Trash2, Plus, Pencil, X, Check, Hash, AlertTriangle, Mic, Users, MessageSquare } from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'
import DestinationMultiSelect from '../components/discord/DestinationMultiSelect'
import { RuleTriggerPicker } from '../components/discord/RuleTriggerPicker'
import { discordNavAlertsQueryKey } from '../lib/useDiscordNavAlerts'
import { LoadingState, MetricCard, EmptyState, inputCls } from '@/design-system'
import {
  type DiscordRuleTrigger,
  TRIGGER_LABELS,
  EVENT_TEMPLATE_NAMES,
  defaultTemplateForTrigger,
  getRuleTriggersFromRule,
  ruleHasMessageTrigger,
  ruleHasVoiceTrigger,
  ruleHasMemberTrigger,
} from '../lib/discordMonitor'
import { cn } from '@/lib/utils'

interface Rule {
  _id: string
  name: string
  isActive: boolean
  matchCount: number
  trigger?: DiscordRuleTrigger
  triggers?: DiscordRuleTrigger[]
  conditions: {
    channelIds?: string[]
    voiceChannelIds?: string[]
    requireKeywords?: string[]
  }
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
  monitorType?: string
}

// ── Form state ────────────────────────────────────────────────────────────────
interface RuleForm {
  name: string
  triggers: DiscordRuleTrigger[]
  priority: 'high' | 'medium' | 'low'
  templateName: string
  keywords: string
  destinationIdentifiers: string[]
  channelIds: string[]
  voiceChannelIds: string[]
}

const emptyForm: RuleForm = {
  name: '',
  triggers: ['message'],
  priority: 'medium',
  templateName: 'dw-padrao',
  keywords: '',
  destinationIdentifiers: [],
  channelIds: [],
  voiceChannelIds: [],
}

function ruleToForm(r: Rule, destinations: Destination[]): RuleForm {
  const destIds = new Set(r.action.destinationIds)
  const identifiers = destinations
    .filter(d => destIds.has(d._id))
    .map(d => d.identifier)
  return {
    name: r.name,
    triggers: getRuleTriggersFromRule(r),
    priority: r.action.priority as 'high' | 'medium' | 'low',
    templateName: r.action.templateName,
    keywords: (r.conditions.requireKeywords ?? []).join(', '),
    destinationIdentifiers: identifiers,
    channelIds: r.conditions.channelIds ?? [],
    voiceChannelIds: r.conditions.voiceChannelIds ?? [],
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

  const labelCls = 'text-xs text-[var(--rz-text-muted)] mb-1 block'
  const isMessage = ruleHasMessageTrigger(form.triggers)
  const isVoice = ruleHasVoiceTrigger(form.triggers)
  const isMember = ruleHasMemberTrigger(form.triggers)
  const multiEvent = form.triggers.length > 1 && !isMessage
  const textChannels = channels.filter(c => !c.monitorType || c.monitorType === 'text')
  const voiceChannels = channels.filter(c => c.monitorType === 'voice')

  const onTriggersChange = (triggers: DiscordRuleTrigger[]) => {
    setForm(f => {
      const next = { ...f, triggers }
      if (triggers.length === 1) {
        next.templateName = defaultTemplateForTrigger(triggers[0])
      }
      if (!ruleHasMessageTrigger(triggers)) {
        next.channelIds = []
        next.keywords = ''
      }
      if (!ruleHasVoiceTrigger(triggers)) {
        next.voiceChannelIds = []
      }
      return next
    })
  }

  const toggleChannel = (channelId: string) => {
    setForm(f => ({
      ...f,
      channelIds: f.channelIds.includes(channelId)
        ? f.channelIds.filter(id => id !== channelId)
        : [...f.channelIds, channelId],
    }))
  }

  const toggleVoiceChannel = (channelId: string) => {
    setForm(f => ({
      ...f,
      voiceChannelIds: f.voiceChannelIds.includes(channelId)
        ? f.voiceChannelIds.filter(id => id !== channelId)
        : [...f.voiceChannelIds, channelId],
    }))
  }

  const templateOptions = (() => {
    const fromApi = templates
      .filter(t => t.name.startsWith('dw-'))
      .map(t => t.name)
    if (isMessage) {
      return ['dw-padrao', ...fromApi.filter(n => n !== 'dw-padrao' && !EVENT_TEMPLATE_NAMES.includes(n as typeof EVENT_TEMPLATE_NAMES[number]))]
    }
    if (multiEvent) {
      return form.triggers.map(t => defaultTemplateForTrigger(t))
    }
    const primary = form.triggers[0] ?? 'message'
    return [defaultTemplateForTrigger(primary), ...EVENT_TEMPLATE_NAMES.filter(n => fromApi.includes(n) || n === defaultTemplateForTrigger(primary))]
  })()

  const sectionCls = 'rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30 p-4 space-y-3'
  const sectionTitle = 'text-xs font-semibold uppercase tracking-wide text-[var(--rz-text-muted)]'

  return (
    <div className="space-y-4">
      {/* 1 — Identificação */}
      <div className={sectionCls}>
        <p className={sectionTitle}>1 · Identificação</p>
        <div>
          <label className={labelCls}>Nome da regra *</label>
          <input
            value={form.name}
            onChange={e => set('name', e.currentTarget.value)}
            placeholder={
              isMessage
                ? 'Ex: Promoções do canal #ofertas'
                : isVoice && !isMember
                  ? 'Ex: Alerta quando alguém entra na Sala Geral'
                  : isMember && !isVoice
                    ? 'Ex: Aviso kick e ban no servidor'
                    : 'Ex: Alertas de voz e moderação'
            }
            className={inputCls}
          />
        </div>
      </div>

      {/* 2 — Gatilho */}
      <div className={sectionCls}>
        <p className={sectionTitle}>2 · O que dispara a regra</p>
        <RuleTriggerPicker value={form.triggers} onChange={onTriggersChange} />
      </div>

      {/* 3 — Filtros */}
      <div className={sectionCls}>
        <p className={sectionTitle}>3 · Filtros (opcional)</p>

        {isMessage && (
          <>
            <div>
              <label className={labelCls}>
                Canais de texto
                <span className="text-[var(--rz-text-muted)] font-normal ml-1">— vazio = todos</span>
              </label>
              {textChannels.length === 0 ? (
                <p className="text-xs text-amber-500/90">
                  Nenhum canal de texto.{' '}
                  <Link to="/discord/channels" className="text-brand-400 hover:underline">Adicionar monitor</Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {textChannels.map(ch => (
                    <button
                      key={ch._id}
                      type="button"
                      onClick={() => toggleChannel(ch.channelId)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1',
                        form.channelIds.includes(ch.channelId)
                          ? 'bg-brand-600 border-brand-500 text-white'
                          : 'bg-[var(--rz-surface)] border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-brand-500/40',
                      )}
                    >
                      <Hash size={11} />
                      {ch.channelName || ch.channelId}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Keywords obrigatórias (vírgula)</label>
              <input
                value={form.keywords}
                onChange={e => set('keywords', e.currentTarget.value)}
                placeholder="promoção, desconto, grátis"
                className={inputCls}
              />
            </div>
          </>
        )}

        {isVoice && (
          <div>
            <label className={labelCls}>
              Canais de voz
              <span className="text-[var(--rz-text-muted)] font-normal ml-1">— vazio = todos monitorados</span>
            </label>
            {voiceChannels.length === 0 ? (
              <p className="text-xs text-amber-500/90">
                Nenhum canal de voz monitorado.{' '}
                <Link to="/discord/channels" className="text-brand-400 hover:underline">
                  Canais → tipo Voz
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {voiceChannels.map(ch => (
                  <button
                    key={ch._id}
                    type="button"
                    onClick={() => toggleVoiceChannel(ch.channelId)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1',
                      form.voiceChannelIds.includes(ch.channelId)
                        ? 'bg-brand-600 border-brand-500 text-white'
                        : 'bg-[var(--rz-surface)] border-[var(--rz-border)] text-[var(--rz-text-muted)]',
                    )}
                  >
                    <Mic size={11} />
                    {ch.channelName || ch.channelId}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isMember && (
          <p className="text-xs text-[var(--rz-text-secondary)]">
            {isVoice ? 'Também requer' : 'Requer'} monitor <strong>Eventos do servidor</strong> em{' '}
            <Link to="/discord/channels" className="text-brand-400 hover:underline">Canais monitorados</Link>.
          </p>
        )}
      </div>

      {/* 4 — Envio WA */}
      <div className={sectionCls}>
        <p className={sectionTitle}>4 · Envio ao WhatsApp</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Prioridade</label>
            <select
              value={form.priority}
              onChange={e => set('priority', e.currentTarget.value)}
              className={inputCls}
            >
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              Template
              {multiEvent && (
                <span className="text-[var(--rz-text-muted)] font-normal ml-1">— automático por gatilho</span>
              )}
            </label>
            {multiEvent ? (
              <p className="text-xs text-[var(--rz-text-secondary)] rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-2">
                {form.triggers.map(t => defaultTemplateForTrigger(t)).join(' · ')}
              </p>
            ) : (
              <select
                value={form.templateName}
                onChange={e => set('templateName', e.currentTarget.value)}
                className={inputCls}
              >
                {templateOptions.map(name => (
                  <option key={name} value={name}>
                    {name}
                    {name === defaultTemplateForTrigger(form.triggers[0] ?? 'message') ? ' (recomendado)' : ''}
                  </option>
                ))}
                {templates
                  .filter(t => !t.name.startsWith('dw-') && !templateOptions.includes(t.name))
                  .map(t => (
                    <option key={t._id} value={t.name}>{t.name} (legado)</option>
                  ))}
              </select>
            )}
          </div>
        </div>
        <div>
          <label className={labelCls}>
            Destinos WhatsApp
            <span className="text-[var(--rz-text-muted)] font-normal ml-1">— vazio = todos ativos</span>
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
        <Button onClick={() => onSave(form)} disabled={!form.name.trim() || form.triggers.length === 0 || saving}>
          {saving ? <Spinner size={12} /> : <Check size={12} />}
          Salvar regra
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
  const [filterKind, setFilterKind] = useState<'all' | 'message' | 'voice' | 'members'>('all')
  const [draftForm, setDraftForm] = useState<RuleForm>(emptyForm)

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
    queryKey: ['channels', guildId],
    queryFn: () => api.get(`/channels${guildId ? `?guildId=${guildId}` : ''}`),
  })

  const voiceMonitors = channels.filter(c => c.monitorType === 'voice').length
  const guildMonitors = channels.filter(c => c.monitorType === 'guild').length
  const eventRules = rules.filter(r => getRuleTriggersFromRule(r).some(t => t !== 'message'))
  const messageRules = rules.filter(r => getRuleTriggersFromRule(r).every(t => t === 'message'))

  const filteredRules = rules.filter(r => {
    const triggers = getRuleTriggersFromRule(r)
    if (filterKind === 'all') return true
    if (filterKind === 'message') return triggers.includes('message')
    if (filterKind === 'voice') return triggers.some(t => t.startsWith('voice_'))
    return triggers.some(t => t.startsWith('member_'))
  })

  const openCreate = (preset?: Partial<RuleForm>) => {
    const base = { ...emptyForm, ...preset }
    if (preset?.triggers?.length === 1) {
      base.templateName = defaultTemplateForTrigger(preset.triggers[0])
    }
    setDraftForm(base)
    setCreating(true)
    setEditingId(null)
  }

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
      triggers: f.triggers,
      priority: f.priority,
      templateName: f.templateName,
      keywords: f.keywords,
      channelIds: f.channelIds,
      voiceChannelIds: f.voiceChannelIds,
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
        triggers: form.triggers,
        priority: form.priority,
        templateName: form.templateName,
        keywords: form.keywords,
        channelIds: form.channelIds,
        voiceChannelIds: form.voiceChannelIds,
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

  const triggerBadgeVariant = (t?: DiscordRuleTrigger): 'blue' | 'purple' | 'yellow' | 'gray' => {
    if (!t || t === 'message') return 'blue'
    if (t.startsWith('voice_')) return 'purple'
    return 'yellow'
  }

  const FILTER_TABS = [
    { id: 'all' as const, label: 'Todas', count: rules.length },
    { id: 'message' as const, label: 'Mensagens', count: messageRules.length, icon: MessageSquare },
    { id: 'voice' as const, label: 'Voz', count: rules.filter(r => getRuleTriggersFromRule(r).some(t => t.startsWith('voice_'))).length, icon: Mic },
    { id: 'members' as const, label: 'Eventos', count: rules.filter(r => getRuleTriggersFromRule(r).some(t => t.startsWith('member_'))).length, icon: Users },
  ]

  return (
    <DiscordPage
      description="Regras para mensagens, chamadas de voz e eventos de membros — template, destinos e prioridade no WhatsApp."
      actions={
        !creating ? (
          <Button size="sm" onClick={() => openCreate()}>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard title="Regras" value={rules.length} icon={BookOpen} />
        <MetricCard title="Ativas" value={activeRules} icon={ToggleRight} />
        <MetricCard title="Mensagens" value={messageRules.length} icon={MessageSquare} />
        <MetricCard title="Voz + eventos" value={eventRules.length} icon={Mic} />
      </div>

      {(voiceMonitors === 0 || guildMonitors === 0) && (
        <Card className="text-xs text-[var(--rz-text-secondary)] space-y-1 py-3">
          <p className="font-medium text-[var(--rz-text-primary)]">Gatilhos novos disponíveis</p>
          {voiceMonitors === 0 && (
            <p>
              <Mic size={12} className="inline mr-1 text-brand-400" />
              Chamada de voz: adicione monitor tipo <strong>Voz</strong> em{' '}
              <Link to="/discord/channels" className="text-brand-400 hover:underline">Canais</Link>
            </p>
          )}
          {guildMonitors === 0 && (
            <p>
              <Users size={12} className="inline mr-1 text-brand-400" />
              Kick/ban/entrada: ative <strong>Eventos do servidor</strong> em{' '}
              <Link to="/discord/channels" className="text-brand-400 hover:underline">Canais</Link>
            </p>
          )}
        </Card>
      )}

      {!creating && rules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterKind(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors',
                  filterKind === tab.id
                    ? 'bg-brand-600 border-brand-500 text-white'
                    : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-brand-500/40',
                )}
              >
                {Icon && <Icon size={12} />}
                {tab.label}
                <span className="opacity-70">({tab.count})</span>
              </button>
            )
          })}
        </div>
      )}

      {!creating && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-[var(--rz-text-muted)] self-center mr-1">Atalhos:</span>
          <Button size="sm" variant="ghost" onClick={() => openCreate({ triggers: ['voice_join'], name: 'Alerta entrada na voz' })}>
            <Mic size={12} /> Entrada na voz
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openCreate({ triggers: ['member_kick', 'member_ban'], name: 'Moderação (kick/ban)' })}>
            <Users size={12} /> Kick + Ban
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openCreate({ triggers: ['message'], name: '' })}>
            <MessageSquare size={12} /> Mensagem
          </Button>
        </div>
      )}

      {!guildId && (
        <p className="text-xs text-amber-500/90 flex items-center gap-1.5">
          <Hash size={12} /> Selecione o servidor Discord na barra lateral para filtrar regras por guild.
        </p>
      )}
      {guildName && (
        <p className="text-xs text-[var(--rz-text-muted)]">Exibindo regras do contexto · {guildName}</p>
      )}

      {/* Create form */}
      {creating && (
        <Card className="border-brand-700">
          <p className="text-sm font-medium text-brand-400 mb-4">Nova regra</p>
          <RuleFormPanel
            key={draftForm.triggers.join(',') + draftForm.name}
            initial={draftForm}
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
            <Button size="sm" onClick={() => openCreate()}>
              <Plus size={12} /> Criar primeira regra
            </Button>
          }
        />
      )}

      {/* Rule cards */}
      {filteredRules.map((r) => {
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
                  {getRuleTriggersFromRule(r).map(t => (
                    <Badge
                      key={t}
                      label={TRIGGER_LABELS[t]}
                      variant={triggerBadgeVariant(t)}
                    />
                  ))}
                </div>
                {blocked && r.executionBlock?.reason && (
                  <p className="text-xs text-red-300/90 mb-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>Não executa: {r.executionBlock.reason}</span>
                  </p>
                )}
                <div className="text-xs text-[var(--rz-text-muted)] space-y-0.5">
                  <p>Template: <span className="text-[var(--rz-text-secondary)]">{r.action.templateName}</span></p>
                  {r.conditions.channelIds?.length ? (
                    <p>Canais texto: <span className="text-[var(--rz-text-secondary)]">
                      {r.conditions.channelIds.map(id => {
                        const ch = channels.find(c => c.channelId === id)
                        return ch ? `#${ch.channelName || id}` : `#${id}`
                      }).join(', ')}
                    </span></p>
                  ) : null}
                  {r.conditions.voiceChannelIds?.length ? (
                    <p>Canais voz: <span className="text-[var(--rz-text-secondary)]">
                      {r.conditions.voiceChannelIds.map(id => {
                        const ch = channels.find(c => c.channelId === id)
                        return ch ? ch.channelName || id : id
                      }).join(', ')}
                    </span></p>
                  ) : null}
                  {r.conditions.requireKeywords?.length ? (
                    <p>Keywords: <span className="text-[var(--rz-text-secondary)]">{r.conditions.requireKeywords.join(', ')}</span></p>
                  ) : null}
                  <p>
                    Destinos:{' '}
                    <span className="text-[var(--rz-text-secondary)]">
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
                  className="text-[var(--rz-text-muted)] hover:text-yellow-400 transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => toggle.mutate(r._id)}
                  disabled={toggle.isPending}
                  className="text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] transition-colors"
                  title={r.isActive ? 'Desativar' : 'Ativar'}
                >
                  {r.isActive
                    ? <ToggleRight size={22} className="text-brand-500" />
                    : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => { if (window.confirm('Deletar esta regra?')) remove.mutate(r._id) }}
                  disabled={remove.isPending}
                  className="text-[var(--rz-text-muted)] hover:text-red-400 transition-colors"
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
