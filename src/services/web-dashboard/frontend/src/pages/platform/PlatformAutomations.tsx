import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { WhatsAppPreviewBubble } from '../../components/platform/WhatsAppPreviewBubble'
import { Workflow, Plus, Play, Trash2, Pencil, Users, MessageSquare } from 'lucide-react'

type TriggerType =
  | 'on_contact_birthday'
  | 'day_of_month'
  | 'interval_months'
  | 'calendar_day_of_month'
  | 'nth_business_day_of_month'
  | 'weekly'
  | 'once_at'

type DestinationScope = 'contacts' | 'whatsapp_groups' | 'both'
type MessageMode = 'platform_template' | 'plain'

interface AutomationRule {
  _id: string
  name?: string
  templateName: string
  triggerType: TriggerType
  dayOfMonth?: number
  intervalMonths?: number
  nthBusinessDay?: number
  weekday?: number
  scheduledAt?: string
  sendTime: string
  active: boolean
  destinationScope?: DestinationScope
  contactGroupIds?: string[]
  whatsappDestinationIds?: string[]
  messageMode?: MessageMode
  customMessage?: string
  destinationFilterTags?: string[]
  mensagemExtra?: string
  lastRunDate?: string
}

interface ContactGroupOption {
  _id: string
  name: string
  memberCount: number
}

interface DestinationOption {
  _id: string
  name: string
  identifier: string
  type: 'contact' | 'group'
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  on_contact_birthday: 'Aniversário do contato (mês+dia do birthday)',
  day_of_month: 'Aniversariantes do dia N (qualquer mês)',
  interval_months: 'Aniversário + a cada N meses',
  calendar_day_of_month: 'Dia fixo do calendário (todo mês)',
  nth_business_day_of_month: 'N-ésimo dia útil do mês (seg–sex)',
  weekly: 'Semanal (dia da semana)',
  once_at: 'Envio único (data e hora)',
}

const SCOPE_LABELS: Record<DestinationScope, string> = {
  contacts: 'Contatos',
  whatsapp_groups: 'Grupos WhatsApp',
  both: 'Contatos + grupos WA',
}

const TRIGGER_GROUPS: { label: string; types: TriggerType[] }[] = [
  {
    label: 'Aniversário e contatos',
    types: ['on_contact_birthday', 'day_of_month', 'interval_months'],
  },
  {
    label: 'Calendário e rotinas',
    types: ['calendar_day_of_month', 'nth_business_day_of_month', 'weekly'],
  },
  {
    label: 'Pontual',
    types: ['once_at'],
  },
]

const WEEKDAYS = [
  { v: 1, label: 'Segunda' },
  { v: 2, label: 'Terça' },
  { v: 3, label: 'Quarta' },
  { v: 4, label: 'Quinta' },
  { v: 5, label: 'Sexta' },
  { v: 6, label: 'Sábado' },
  { v: 7, label: 'Domingo' },
]

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

function defaultScheduledAtLocal(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return toDatetimeLocal(d)
}

function toDatetimeLocal(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function needsBirthday(t: TriggerType): boolean {
  return t === 'on_contact_birthday' || t === 'day_of_month' || t === 'interval_months'
}

const DEFAULT_FORM = {
  name: '',
  templateName: 'pw-aniversario',
  triggerType: 'on_contact_birthday' as TriggerType,
  dayOfMonth: 10,
  intervalMonths: 6,
  nthBusinessDay: 5,
  weekday: 1,
  scheduledAt: defaultScheduledAtLocal(),
  sendTime: '09:00',
  active: true,
  destinationScope: 'contacts' as DestinationScope,
  contactGroupIds: [] as string[],
  whatsappDestinationIds: [] as string[],
  messageMode: 'platform_template' as MessageMode,
  customMessage: '',
  destinationFilterTags: '',
  mensagemExtra: '',
}

export default function PlatformAutomations() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AutomationRule | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [showForm, setShowForm] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [waSearch, setWaSearch] = useState('')

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['platform-automations'],
    queryFn: () => api.get('/platform/automations'),
  })

  const { data: pwTemplates = [] } = useQuery<{ name: string; label?: string }[]>({
    queryKey: ['platform-templates-pw'],
    queryFn: async () => {
      const list = await api.get<Array<{ name: string; label?: string }>>('/platform/templates')
      return list.filter(t => t.name.startsWith('pw-'))
    },
  })

  const { data: contactGroups = [] } = useQuery<ContactGroupOption[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
  })

  const { data: destinations = [] } = useQuery<DestinationOption[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
  })

  const waGroups = useMemo(
    () => destinations.filter(d => d.type === 'group'),
    [destinations],
  )

  const filteredContactGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase()
    if (!q) return contactGroups
    return contactGroups.filter(g => g.name.toLowerCase().includes(q))
  }, [contactGroups, groupSearch])

  const filteredWaGroups = useMemo(() => {
    const q = waSearch.trim().toLowerCase()
    if (!q) return waGroups
    return waGroups.filter(
      g =>
        g.name.toLowerCase().includes(q) ||
        g.identifier.toLowerCase().includes(q),
    )
  }, [waGroups, waSearch])

  const showContactPicker =
    form.destinationScope === 'contacts' || form.destinationScope === 'both'
  const showWaPicker =
    form.destinationScope === 'whatsapp_groups' || form.destinationScope === 'both'

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id]

  const saveRule = useMutation({
    mutationFn: () => {
      const tags = form.destinationFilterTags
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(Boolean)
      const body: Record<string, unknown> = {
        name: form.name.trim() || 'Automação',
        templateName: form.templateName,
        triggerType: form.triggerType,
        sendTime: form.sendTime,
        active: form.active,
        destinationScope: form.destinationScope,
        contactGroupIds: form.contactGroupIds.length ? form.contactGroupIds : undefined,
        whatsappDestinationIds: form.whatsappDestinationIds.length
          ? form.whatsappDestinationIds
          : undefined,
        messageMode: form.messageMode,
        customMessage: form.messageMode === 'plain' ? form.customMessage.trim() : undefined,
        destinationFilterTags: tags.length ? tags : undefined,
        mensagemExtra: form.mensagemExtra || undefined,
      }
      if (form.triggerType === 'once_at') {
        body.scheduledAt = new Date(form.scheduledAt).toISOString()
      }
      if (form.triggerType === 'day_of_month' || form.triggerType === 'calendar_day_of_month') {
        body.dayOfMonth = form.dayOfMonth
      }
      if (form.triggerType === 'interval_months') {
        body.intervalMonths = form.intervalMonths
      }
      if (form.triggerType === 'nth_business_day_of_month') {
        body.nthBusinessDay = form.nthBusinessDay
      }
      if (form.triggerType === 'weekly') {
        body.weekday = form.weekday
      }
      if (editing) {
        return api.patch(`/platform/automations/${editing._id}`, body)
      }
      return api.post('/platform/automations', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-automations'] })
      setShowForm(false)
      setEditing(null)
      setForm(DEFAULT_FORM)
    },
    onError: (e: Error) => alert(e.message),
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/automations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-automations'] }),
    onError: (e: Error) => alert(e.message),
  })

  const runNow = useMutation({
    mutationFn: () => api.post<{ enqueued?: number }>('/platform/automations/run-now', {}),
    onSuccess: data => {
      alert(`Processado: ${data.enqueued ?? 0} envio(s) enfileirado(s) para hoje.`)
    },
    onError: (e: Error) => alert(e.message),
  })

  const openEdit = (r: AutomationRule) => {
    setEditing(r)
    setForm({
      name: r.name ?? '',
      templateName: r.templateName,
      triggerType: r.triggerType,
      dayOfMonth: r.dayOfMonth ?? 10,
      intervalMonths: r.intervalMonths ?? 6,
      nthBusinessDay: r.nthBusinessDay ?? 5,
      weekday: r.weekday ?? 1,
      scheduledAt: r.scheduledAt ? toDatetimeLocal(r.scheduledAt) : defaultScheduledAtLocal(),
      sendTime: r.sendTime,
      active: r.active,
      destinationScope: r.destinationScope ?? 'contacts',
      contactGroupIds: (r.contactGroupIds ?? []).map(String),
      whatsappDestinationIds: (r.whatsappDestinationIds ?? []).map(String),
      messageMode: r.messageMode ?? 'platform_template',
      customMessage: r.customMessage ?? '',
      destinationFilterTags: (r.destinationFilterTags ?? []).join('; '),
      mensagemExtra: r.mensagemExtra ?? '',
    })
    setShowForm(true)
  }

  const previewText =
    form.messageMode === 'plain'
      ? form.customMessage || '(texto vazio)'
      : `[Modelo ${form.templateName}]${form.mensagemExtra ? `\n\n{mensagem}: ${form.mensagemExtra}` : ''}`

  return (
    <PlatformPage
      title="Mensagens automáticas"
      description="Regras recorrentes ou envio único. Escolha contatos, grupos de contato, grupos WhatsApp ou ambos."
    >
      <Card className="border-brand-800/40 bg-brand-950/15 text-xs text-gray-400 space-y-2">
        <p className="font-medium text-brand-300">Como funciona</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <strong className="text-gray-300">Gatilho</strong> — aniversário, calendário, semanal ou{' '}
            <strong className="text-gray-300">envio único</strong> com data/hora exata.
          </li>
          <li>
            <strong className="text-gray-300">Destinos</strong> — todos os contatos, grupos de contato (
            <Link to="/contact" className="text-brand-400 hover:underline">
              Contatos
            </Link>
            ), grupos WhatsApp ou combinação.
          </li>
          <li>
            <strong className="text-gray-300">Mensagem</strong> — modelo pw-* ou texto manual com variáveis
            como {'{nome}'}, {'{mensagem}'}.
          </li>
        </ul>
        <p className="text-gray-500">
          Job a cada ~15 min após o horário (máx. 1 execução por dia por regra recorrente).
          {needsBirthday(form.triggerType) && (
            <>
              {' '}
              Contatos precisam de{' '}
              <Link to="/platform/contacts" className="text-brand-400 hover:underline">
                birthday no import
              </Link>
              .
            </>
          )}
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setForm({ ...DEFAULT_FORM, scheduledAt: defaultScheduledAtLocal() })
            setShowForm(true)
          }}
        >
          <Plus size={14} /> Nova automação
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => runNow.mutate()}
          disabled={runNow.isPending}
        >
          {runNow.isPending ? <Spinner size={14} /> : <Play size={14} />}
          Testar agora (regras ativas)
        </Button>
      </div>

      {showForm && (
        <Card className="space-y-4">
          <h2 className="text-sm font-medium text-gray-300">
            {editing ? 'Editar automação' : 'Nova automação'}
          </h2>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Nome da regra</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Parabéns clientes VIP"
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Quando enviar (gatilho)</label>
            <select
              value={form.triggerType}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  triggerType: e.target.value as TriggerType,
                }))
              }
              className={inputCls}
            >
              {TRIGGER_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.types.map(k => (
                    <option key={k} value={k}>
                      {TRIGGER_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {form.triggerType === 'once_at' ? (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Data e hora do envio</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className={inputCls}
              />
              <p className="text-[11px] text-gray-600 mt-1">
                Envio único — não repete após executar.
              </p>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Horário diário (HH:mm)</label>
              <input
                type="time"
                value={form.sendTime}
                onChange={e => setForm(f => ({ ...f, sendTime: e.target.value }))}
                className={inputCls}
              />
            </div>
          )}

          {(form.triggerType === 'day_of_month' ||
            form.triggerType === 'calendar_day_of_month') && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Dia do mês (1–31)</label>
              <input
                type="number"
                min={1}
                max={31}
                value={form.dayOfMonth}
                onChange={e => setForm(f => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
          )}
          {form.triggerType === 'interval_months' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Intervalo (meses)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={form.intervalMonths}
                onChange={e =>
                  setForm(f => ({ ...f, intervalMonths: Number(e.target.value) }))
                }
                className={inputCls}
              />
            </div>
          )}
          {form.triggerType === 'nth_business_day_of_month' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Qual dia útil (1º a 23º)</label>
              <input
                type="number"
                min={1}
                max={23}
                value={form.nthBusinessDay}
                onChange={e =>
                  setForm(f => ({ ...f, nthBusinessDay: Number(e.target.value) }))
                }
                className={inputCls}
              />
            </div>
          )}
          {form.triggerType === 'weekly' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Dia da semana</label>
              <select
                value={form.weekday}
                onChange={e => setForm(f => ({ ...f, weekday: Number(e.target.value) }))}
                className={inputCls}
              >
                {WEEKDAYS.map(w => (
                  <option key={w.v} value={w.v}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-2 flex items-center gap-1">
              <Users size={12} /> Destinos
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(['contacts', 'whatsapp_groups', 'both'] as DestinationScope[]).map(scope => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, destinationScope: scope }))}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    form.destinationScope === scope
                      ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>

            {showContactPicker && (
              <div className="mb-3 rounded-lg border border-gray-800 p-3 space-y-2">
                <p className="text-xs text-gray-400">
                  Grupos de contato (vazio = todos os contatos elegíveis)
                </p>
                <input
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                  placeholder="Buscar grupo..."
                  className={inputCls}
                />
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {filteredContactGroups.length === 0 ? (
                    <p className="text-xs text-gray-600 py-2">
                      Nenhum grupo —{' '}
                      <Link to="/contact" className="text-brand-400 hover:underline">
                        criar em Contatos
                      </Link>
                    </p>
                  ) : (
                    filteredContactGroups.map(g => (
                      <label
                        key={g._id}
                        className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:bg-gray-800/50 rounded px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={form.contactGroupIds.includes(g._id)}
                          onChange={() =>
                            setForm(f => ({
                              ...f,
                              contactGroupIds: toggleId(f.contactGroupIds, g._id),
                            }))
                          }
                          className="rounded border-gray-600"
                        />
                        {g.name}
                        <span className="text-gray-600 text-xs">({g.memberCount})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {showWaPicker && (
              <div className="rounded-lg border border-gray-800 p-3 space-y-2">
                <p className="text-xs text-gray-400">
                  Grupos WhatsApp (vazio = todos os grupos cadastrados)
                </p>
                <input
                  value={waSearch}
                  onChange={e => setWaSearch(e.target.value)}
                  placeholder="Buscar grupo WA..."
                  className={inputCls}
                />
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {filteredWaGroups.length === 0 ? (
                    <p className="text-xs text-gray-600 py-2">Nenhum grupo WhatsApp cadastrado.</p>
                  ) : (
                    filteredWaGroups.map(g => (
                      <label
                        key={g._id}
                        className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:bg-gray-800/50 rounded px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={form.whatsappDestinationIds.includes(g._id)}
                          onChange={() =>
                            setForm(f => ({
                              ...f,
                              whatsappDestinationIds: toggleId(f.whatsappDestinationIds, g._id),
                            }))
                          }
                          className="rounded border-gray-600"
                        />
                        {g.name}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2 flex items-center gap-1">
              <MessageSquare size={12} /> Mensagem
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, messageMode: 'platform_template' }))}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  form.messageMode === 'platform_template'
                    ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                Modelo pw-*
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, messageMode: 'plain' }))}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  form.messageMode === 'plain'
                    ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                Texto manual
              </button>
            </div>

            {form.messageMode === 'platform_template' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Modelo</label>
                  <select
                    value={form.templateName}
                    onChange={e => setForm(f => ({ ...f, templateName: e.target.value }))}
                    className={inputCls}
                  >
                    {pwTemplates.map(t => (
                      <option key={t.name} value={t.name}>
                        {t.label ?? t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Texto extra → {'{mensagem}'}
                  </label>
                  <textarea
                    rows={3}
                    value={form.mensagemExtra}
                    onChange={e => setForm(f => ({ ...f, mensagemExtra: e.target.value }))}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Texto completo — use {'{nome}'}, {'{mensagem}'}, {'{empresa}'}, etc.
                </label>
                <textarea
                  rows={6}
                  value={form.customMessage}
                  onChange={e => setForm(f => ({ ...f, customMessage: e.target.value }))}
                  placeholder="Olá {nome}! ..."
                  className={`${inputCls} resize-none font-mono text-xs`}
                />
              </div>
            )}

            <div className="mt-3 max-w-sm">
              <p className="text-[11px] text-gray-600 mb-1">Prévia</p>
              <WhatsAppPreviewBubble text={previewText} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Tags dos contatos (legado, opcional)
            </label>
            <input
              value={form.destinationFilterTags}
              onChange={e =>
                setForm(f => ({ ...f, destinationFilterTags: e.target.value }))
              }
              placeholder="vip; clientes"
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="rounded border-gray-600"
            />
            Automação ativa
          </label>

          <div className="flex gap-2">
            <Button onClick={() => saveRule.mutate()} disabled={saveRule.isPending}>
              {saveRule.isPending ? <Spinner size={14} /> : <Workflow size={14} />}
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size={28} />
        </div>
      ) : rules.length === 0 ? (
        <Card className="text-center py-10 text-gray-500">
          <Workflow size={32} className="mx-auto mb-2 opacity-40" />
          <p>Nenhuma automação configurada</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map(r => (
            <Card key={r._id} className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-200">
                    {r.name?.trim() || r.templateName}
                  </p>
                  <Badge label={r.active ? 'ativa' : 'pausada'} variant={r.active ? 'green' : 'gray'} />
                  {r.destinationScope && r.destinationScope !== 'contacts' && (
                    <Badge label={SCOPE_LABELS[r.destinationScope]} variant="blue" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{TRIGGER_LABELS[r.triggerType]}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {r.messageMode === 'plain' ? 'Texto manual' : `Modelo ${r.templateName}`}
                  {r.triggerType === 'once_at' && r.scheduledAt
                    ? ` · ${new Date(r.scheduledAt).toLocaleString('pt-BR')}`
                    : ` · ${r.sendTime}`}
                  {r.lastRunDate && ` · última execução ${r.lastRunDate}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="p-2 text-gray-500 hover:text-white"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Remover esta automação?')) deleteRule.mutate(r._id)
                  }}
                  className="p-2 text-gray-500 hover:text-red-400"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PlatformPage>
  )
}
