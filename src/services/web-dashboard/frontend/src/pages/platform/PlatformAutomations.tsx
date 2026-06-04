import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Workflow, Plus, Play, Trash2, Pencil, CalendarClock } from 'lucide-react'

type TriggerType =
  | 'on_contact_birthday'
  | 'day_of_month'
  | 'interval_months'
  | 'calendar_day_of_month'
  | 'nth_business_day_of_month'
  | 'weekly'

interface AutomationRule {
  _id: string
  name?: string
  templateName: string
  triggerType: TriggerType
  dayOfMonth?: number
  intervalMonths?: number
  nthBusinessDay?: number
  weekday?: number
  sendTime: string
  active: boolean
  destinationFilterTags?: string[]
  mensagemExtra?: string
  lastRunDate?: string
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  on_contact_birthday: 'Aniversário do contato (mês+dia do birthday)',
  day_of_month: 'Aniversariantes do dia N (qualquer mês)',
  interval_months: 'Aniversário + a cada N meses',
  calendar_day_of_month: 'Dia fixo do calendário (todo mês)',
  nth_business_day_of_month: 'N-ésimo dia útil do mês (seg–sex)',
  weekly: 'Semanal (dia da semana)',
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

const DEFAULT_FORM = {
  name: '',
  templateName: 'pw-aniversario',
  triggerType: 'on_contact_birthday' as TriggerType,
  dayOfMonth: 10,
  intervalMonths: 6,
  nthBusinessDay: 5,
  weekday: 1,
  sendTime: '09:00',
  active: true,
  destinationFilterTags: '',
  mensagemExtra: '',
}

function needsBirthday(t: TriggerType): boolean {
  return t === 'on_contact_birthday' || t === 'day_of_month' || t === 'interval_months'
}

export default function PlatformAutomations() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AutomationRule | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [showForm, setShowForm] = useState(false)

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
        destinationFilterTags: tags.length ? tags : undefined,
        mensagemExtra: form.mensagemExtra || undefined,
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
      sendTime: r.sendTime,
      active: r.active,
      destinationFilterTags: (r.destinationFilterTags ?? []).join('; '),
      mensagemExtra: r.mensagemExtra ?? '',
    })
    setShowForm(true)
  }

  return (
    <PlatformPage
      title="Mensagens automáticas"
      description="Crie regras recorrentes com modelos pw-*. Para envio único em data/hora exata, use Mensagens → Agendamentos."
    >
      <Card className="border-amber-800/30 bg-amber-950/15 text-xs text-gray-400 flex gap-2">
        <CalendarClock size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <p>
          <strong className="text-amber-300/90">Agendamento pontual</strong> (ex.: “dia 15/06 às 14h”) fica em{' '}
          <Link to="/send/agendamentos" className="text-brand-400 hover:underline">
            Mensagens → Agendamentos
          </Link>
          , não aqui.
        </p>
      </Card>

      <Card className="border-brand-800/40 bg-brand-950/15 text-xs text-gray-400 space-y-2">
        <p className="font-medium text-brand-300">Exemplos de gatilho</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <strong className="text-gray-300">Aniversário</strong> — envia no mês+dia do campo birthday do contato.
          </li>
          <li>
            <strong className="text-gray-300">5º dia útil</strong> — todo mês no 5º dia seg–sex, para contatos com tags
            (ex.: vip).
          </li>
          <li>
            <strong className="text-gray-300">Dia 10 do calendário</strong> — todo dia 10, independente de aniversário.
          </li>
          <li>
            <strong className="text-gray-300">Semanal</strong> — toda segunda às 09:00 para a base filtrada.
          </li>
        </ul>
        <p className="text-gray-500">
          Job a cada ~15 min após o horário configurado (máx. 1 execução por dia por regra).
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
            setForm(DEFAULT_FORM)
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
        <Card className="space-y-3">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Modelo pw-*</label>
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
              <label className="text-xs text-gray-500 block mb-1">Horário (HH:mm)</label>
              <input
                type="time"
                value={form.sendTime}
                onChange={e => setForm(f => ({ ...f, sendTime: e.target.value }))}
                className={inputCls}
              />
            </div>
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
            <p className="text-[11px] text-gray-600 mt-1">{TRIGGER_LABELS[form.triggerType]}</p>
          </div>

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
            <label className="text-xs text-gray-500 block mb-1">
              Tags dos contatos (opcional, separadas por ;)
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
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Texto extra → variável {'{mensagem}'}
            </label>
            <textarea
              rows={2}
              value={form.mensagemExtra}
              onChange={e => setForm(f => ({ ...f, mensagemExtra: e.target.value }))}
              className={`${inputCls} resize-none`}
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
                </div>
                <p className="text-xs text-gray-500 mt-1">{TRIGGER_LABELS[r.triggerType]}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Modelo {r.templateName} · {r.sendTime}
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
