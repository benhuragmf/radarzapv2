import { useMemo, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { WhatsAppPreviewBubble } from '../../components/platform/WhatsAppPreviewBubble'
import { WhatsAppTextEditor } from '../../components/whatsapp/WhatsAppTextEditor'
import {
  Workflow,
  Plus,
  Play,
  Trash2,
  Pencil,
  Users,
  MessageSquare,
  Phone,
  UsersRound,
  Eye,
} from 'lucide-react'
import {
  TRIGGER_LABELS,
  TRIGGER_HINTS,
  TRIGGER_GROUPS,
  WEEKDAYS,
  describeTrigger,
  type TriggerType,
} from '../../lib/automation-triggers'
import { usePlatformMessagePreview } from '../../lib/usePlatformMessagePreview'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { inputCls, LoadingState } from '@/design-system'
import {
  currentTimeHHmm,
  minDatetimeLocalFromNow,
  triggerMatchesCalendarToday,
  validateAutomationScheduleTimes,
} from '../../lib/automation-schedule-validation'

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
  weekdays?: number[]
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
  birthday?: string
}

const SCOPE_OPTIONS: {
  id: DestinationScope
  label: string
  hint: string
  icon: typeof Phone
}[] = [
  {
    id: 'contacts',
    label: 'Contatos',
    hint: 'Pessoas cadastradas com consentimento aceito',
    icon: Phone,
  },
  {
    id: 'whatsapp_groups',
    label: 'Grupos WhatsApp',
    hint: 'Grupos cadastrados como destino no WhatsApp',
    icon: UsersRound,
  },
  {
    id: 'both',
    label: 'Contatos + grupos',
    hint: 'Envia para contatos e grupos WhatsApp na mesma regra',
    icon: Users,
  },
]

const SCOPE_LABELS: Record<DestinationScope, string> = {
  contacts: 'Contatos',
  whatsapp_groups: 'Grupos WhatsApp',
  both: 'Contatos + grupos',
}

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
  weekdays: [1] as number[],
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
  const location = useLocation()
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

  const { data: variableDocs = {} } = useQuery<Record<string, string>>({
    queryKey: ['platform-template-variables'],
    queryFn: () => api.get('/platform/templates/variables'),
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

  const contactDestinations = useMemo(
    () => destinations.filter(d => d.type === 'contact'),
    [destinations],
  )

  const previewDestinationId = useMemo(() => {
    if (showContactPicker && contactDestinations.length > 0) {
      return contactDestinations[0]._id
    }
    if (showWaPicker && waGroups.length > 0) {
      return waGroups[0]._id
    }
    return contactDestinations[0]?._id ?? waGroups[0]?._id ?? null
  }, [showContactPicker, showWaPicker, contactDestinations, waGroups])

  const previewDestinationName = useMemo(() => {
    if (!previewDestinationId) return null
    return destinations.find(d => d._id === previewDestinationId)?.name ?? null
  }, [previewDestinationId, destinations])

  const { previewText, previewLoading, previewSource } = usePlatformMessagePreview({
    enabled: showForm,
    messageMode: form.messageMode,
    templateName: form.templateName,
    customMessage: form.customMessage,
    mensagemExtra: form.mensagemExtra,
    destinationId: previewDestinationId,
  })

  const variableChips = useMemo(
    () => Object.keys(variableDocs).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [variableDocs],
  )

  const minScheduledAt = useMemo(() => minDatetimeLocalFromNow(), [showForm])
  const minSendTime = useMemo(
    () => (triggerMatchesCalendarToday(form) ? currentTimeHHmm() : undefined),
    [form.triggerType, form.dayOfMonth, form.nthBusinessDay, form.weekday, form.weekdays],
  )

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id]

  const saveRule = useMutation({
    mutationFn: () => {
      const scheduleErr = validateAutomationScheduleTimes(form)
      if (scheduleErr) throw new Error(scheduleErr)

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
        const days = form.weekdays.length ? form.weekdays : [form.weekday]
        body.weekdays = days
        body.weekday = days[0]
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
    onError: mutationError,
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/automations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-automations'] }),
    onError: mutationError,
  })

  const runNow = useMutation({
    mutationFn: () => api.post<{ enqueued?: number }>('/platform/automations/run-now', {}),
    onSuccess: data => {
      notifySuccess(`Processado: ${data.enqueued ?? 0} envio(s) enfileirado(s) para hoje.`)
    },
    onError: mutationError,
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
      weekdays: r.weekdays?.length
        ? r.weekdays
        : r.weekday
          ? [r.weekday]
          : [1],
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

  useEffect(() => {
    const editId = (location.state as { editId?: string } | null)?.editId
    if (!editId || rules.length === 0) return
    const rule = rules.find(r => r._id === editId)
    if (rule) openEdit(rule)
    window.history.replaceState({}, document.title)
  }, [location.state, rules])

  const insertVariable = (key: string) => {
    const token = `{${key}}`
    if (form.messageMode === 'plain') {
      setForm(f => ({ ...f, customMessage: `${f.customMessage}${f.customMessage ? ' ' : ''}${token}` }))
    } else {
      setForm(f => ({ ...f, mensagemExtra: `${f.mensagemExtra}${f.mensagemExtra ? ' ' : ''}${token}` }))
    }
  }

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
          Envios entram em{' '}
          <Link to="/send/autoagendamentos" className="text-brand-400 hover:underline">
            Agend. automação
          </Link>{' '}
          com o horário programado. Únicos/iminentes: checagem a cada 1 min.
          Recorrentes: planejamento a cada 5 min quando o gatilho bate no dia (cada destino na fila).
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
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              {TRIGGER_HINTS[form.triggerType]}
            </p>
          </div>

          {form.triggerType === 'once_at' ? (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Data e hora do envio</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                min={minScheduledAt}
                onChange={e => {
                  const v = e.target.value
                  setForm(f => ({
                    ...f,
                    scheduledAt: v && v < minScheduledAt ? minScheduledAt : v,
                  }))
                }}
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
                min={minSendTime}
                onChange={e => {
                  const v = e.target.value
                  setForm(f => ({
                    ...f,
                    sendTime:
                      minSendTime && v && v < minSendTime ? minSendTime : v,
                  }))
                }}
                className={inputCls}
              />
              {minSendTime && (
                <p className="text-[11px] text-gray-600 mt-1">
                  O gatilho bate hoje — horário deve ser futuro.
                </p>
              )}
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
              <label className="text-xs text-gray-500 block mb-1">
                Qual dia útil do mês? (1º a 23º, só seg–sex)
              </label>
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
              <p className="text-[11px] text-gray-600 mt-1">
                Ex.: <strong className="text-gray-400">5</strong> = 5ª segunda a sexta do mês, não o dia 5 do calendário.
              </p>
            </div>
          )}
          {form.triggerType === 'weekly' && (
            <div>
              <label className="text-xs text-gray-500 block mb-2">Dias da semana</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(w => {
                  const on = form.weekdays.includes(w.v)
                  return (
                    <button
                      key={w.v}
                      type="button"
                      title={w.full}
                      onClick={() =>
                        setForm(f => {
                          const next = toggleId(f.weekdays, w.v)
                          return {
                            ...f,
                            weekdays: next.length ? next : [w.v],
                            weekday: (next.length ? next : [w.v])[0],
                          }
                        })
                      }
                      className={`min-w-[2.75rem] px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        on
                          ? 'border-brand-500 bg-brand-600 text-white'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {w.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-600 mt-2">
                Marque um ou mais dias. Pelo menos um dia deve ficar ativo.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-2 flex items-center gap-1">
              <Users size={12} /> Quem recebe
            </label>
            <div className="grid gap-2 sm:grid-cols-3 mb-4">
              {SCOPE_OPTIONS.map(({ id, label, hint, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, destinationScope: id }))}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    form.destinationScope === id
                      ? 'border-brand-500 bg-brand-950/30'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                    <Icon size={14} className="text-brand-400 shrink-0" />
                    {label}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">{hint}</p>
                </button>
              ))}
            </div>

            {showContactPicker && (
              <div className="mb-3 rounded-lg border border-gray-800 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-300">Contatos</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-brand-400 hover:underline"
                      onClick={() => setForm(f => ({ ...f, contactGroupIds: [] }))}
                    >
                      Todos os contatos
                    </button>
                    {contactGroups.length > 0 && (
                      <button
                        type="button"
                        className="text-[11px] text-gray-500 hover:text-gray-300"
                        onClick={() =>
                          setForm(f => ({
                            ...f,
                            contactGroupIds: contactGroups.map(g => g._id),
                          }))
                        }
                      >
                        Todos os segmentos
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-gray-600">
                  {form.contactGroupIds.length === 0
                    ? 'Todos os contatos elegíveis (consentimento aceito).'
                    : `${form.contactGroupIds.length} segmento(s) selecionado(s).`}
                </p>
                {contactGroups.length > 0 && (
                  <>
                    <input
                      value={groupSearch}
                      onChange={e => setGroupSearch(e.target.value)}
                      placeholder="Buscar segmento..."
                      className={inputCls}
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-gray-950/40 p-1">
                      {filteredContactGroups.length === 0 ? (
                        <p className="text-xs text-gray-600 py-2 px-2">Nenhum segmento encontrado.</p>
                      ) : (
                        filteredContactGroups.map(g => {
                          const on = form.contactGroupIds.includes(g._id)
                          return (
                            <button
                              key={g._id}
                              type="button"
                              onClick={() =>
                                setForm(f => ({
                                  ...f,
                                  contactGroupIds: toggleId(f.contactGroupIds, g._id),
                                }))
                              }
                              className={`w-full flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1.5 transition-colors ${
                                on
                                  ? 'bg-brand-600/20 text-brand-100'
                                  : 'text-gray-400 hover:bg-gray-800/60'
                              }`}
                            >
                              <span className="truncate">{g.name}</span>
                              <span className="text-xs text-gray-600 shrink-0">{g.memberCount}</span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </>
                )}
                {contactGroups.length === 0 && (
                  <p className="text-xs text-gray-600">
                    <Link to="/contact" className="text-brand-400 hover:underline">
                      Criar segmentos em Contatos
                    </Link>
                  </p>
                )}
              </div>
            )}

            {showWaPicker && (
              <div className="rounded-lg border border-gray-800 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-300">Grupos WhatsApp</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-brand-400 hover:underline"
                      onClick={() => setForm(f => ({ ...f, whatsappDestinationIds: [] }))}
                    >
                      Todos os grupos
                    </button>
                    {waGroups.length > 0 && (
                      <button
                        type="button"
                        className="text-[11px] text-gray-500 hover:text-gray-300"
                        onClick={() =>
                          setForm(f => ({
                            ...f,
                            whatsappDestinationIds: waGroups.map(g => g._id),
                          }))
                        }
                      >
                        Selecionar todos
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-gray-600">
                  {form.whatsappDestinationIds.length === 0
                    ? 'Todos os grupos WhatsApp cadastrados.'
                    : `${form.whatsappDestinationIds.length} grupo(s) selecionado(s).`}
                </p>
                {waGroups.length > 0 ? (
                  <>
                    <input
                      value={waSearch}
                      onChange={e => setWaSearch(e.target.value)}
                      placeholder="Buscar grupo..."
                      className={inputCls}
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-gray-950/40 p-1">
                      {filteredWaGroups.length === 0 ? (
                        <p className="text-xs text-gray-600 py-2 px-2">Nenhum grupo encontrado.</p>
                      ) : (
                        filteredWaGroups.map(g => {
                          const on = form.whatsappDestinationIds.includes(g._id)
                          return (
                            <button
                              key={g._id}
                              type="button"
                              onClick={() =>
                                setForm(f => ({
                                  ...f,
                                  whatsappDestinationIds: toggleId(
                                    f.whatsappDestinationIds,
                                    g._id,
                                  ),
                                }))
                              }
                              className={`w-full flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1.5 text-left transition-colors ${
                                on
                                  ? 'bg-brand-600/20 text-brand-100'
                                  : 'text-gray-400 hover:bg-gray-800/60'
                              }`}
                            >
                              <span className="truncate">{g.name}</span>
                              <span className="text-[10px] text-gray-600 shrink-0 font-mono">
                                {g.identifier.slice(-8)}
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-600">
                    <Link to="/grupos" className="text-brand-400 hover:underline">
                      Cadastrar grupos WhatsApp
                    </Link>
                  </p>
                )}
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
                  <WhatsAppTextEditor
                    label={
                      <label className="text-xs text-gray-500 block mb-1">
                        Texto extra → {'{mensagem}'}
                      </label>
                    }
                    value={form.mensagemExtra}
                    onChange={v => setForm(f => ({ ...f, mensagemExtra: v }))}
                    rows={3}
                    showHint={false}
                  />
                </div>
              </div>
            ) : (
              <div>
                <WhatsAppTextEditor
                  label={
                    <label className="text-xs text-gray-500 block mb-1">
                      Texto completo — clique nas variáveis abaixo ou digite {'{nome}'},{' '}
                      {'{empresa}'}, etc.
                    </label>
                  }
                  value={form.customMessage}
                  onChange={v => setForm(f => ({ ...f, customMessage: v }))}
                  rows={6}
                  placeholder="Olá {nome}! Somos a {empresa}."
                  monospace
                  showHint={false}
                />
              </div>
            )}

            {variableChips.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] text-gray-600 mb-1.5">Variáveis disponíveis</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {variableChips.map(key => (
                    <button
                      key={key}
                      type="button"
                      title={variableDocs[key]}
                      onClick={() => insertVariable(key)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono border border-gray-700 text-brand-300 hover:border-brand-600 hover:bg-brand-950/40"
                    >
                      {'{'}{key}{'}'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 max-w-md">
              <div className="flex items-center gap-2 text-[11px] text-gray-600 mb-1">
                <Eye size={12} />
                Prévia
                {previewSource === 'destination' && previewDestinationName ? (
                  <span className="text-brand-400/90">({previewDestinationName})</span>
                ) : (
                  <span className="text-gray-500">(amostra com dados da sua conta)</span>
                )}
              </div>
              {previewLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size={20} />
                </div>
              ) : (
                <WhatsAppPreviewBubble text={previewText || ' '} />
              )}
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
        <LoadingState rows={3} className="pt-4" />
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
                <p className="text-xs text-gray-500 mt-1">{describeTrigger(r)}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {r.messageMode === 'plain' ? 'Texto manual' : `Modelo ${r.templateName}`}
                  {r.triggerType === 'once_at' && r.scheduledAt
                    ? ` · ${new Date(r.scheduledAt).toLocaleString('pt-BR')}`
                    : ` · ${r.sendTime}`}
                  {r.lastRunDate && ` · enfileirado ${r.lastRunDate.replace(/^rec:|^once:/, '')}`}
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
