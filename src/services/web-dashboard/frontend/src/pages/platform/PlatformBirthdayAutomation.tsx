import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Cake, Plus, Play, Trash2, Pencil } from 'lucide-react'

type TriggerType = 'on_contact_birthday' | 'day_of_month' | 'interval_months'

interface BirthdayRule {
  _id: string
  templateName: string
  triggerType: TriggerType
  dayOfMonth?: number
  intervalMonths?: number
  sendTime: string
  active: boolean
  destinationFilterTags?: string[]
  mensagemExtra?: string
  lastRunDate?: string
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  on_contact_birthday: 'No dia do aniversário do contato (mês+dia)',
  day_of_month: 'Contatos que nasceram no dia N do mês (qualquer mês)',
  interval_months: 'No aniversário, se passaram ≥ N meses desde o último envio',
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

const DEFAULT_FORM = {
  templateName: 'pw-aniversario',
  triggerType: 'on_contact_birthday' as TriggerType,
  dayOfMonth: 10,
  intervalMonths: 6,
  sendTime: '09:00',
  active: true,
  destinationFilterTags: '',
  mensagemExtra: 'Muitas felicidades! 🎉',
}

export default function PlatformBirthdayAutomation() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<BirthdayRule | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [showForm, setShowForm] = useState(false)

  const { data: rules = [], isLoading } = useQuery<BirthdayRule[]>({
    queryKey: ['birthday-automation'],
    queryFn: () => api.get('/platform/birthday-automation'),
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
      const body = {
        templateName: form.templateName,
        triggerType: form.triggerType,
        dayOfMonth: form.triggerType === 'day_of_month' ? form.dayOfMonth : undefined,
        intervalMonths:
          form.triggerType === 'interval_months' ? form.intervalMonths : undefined,
        sendTime: form.sendTime,
        active: form.active,
        destinationFilterTags: tags.length ? tags : undefined,
        mensagemExtra: form.mensagemExtra || undefined,
      }
      if (editing) {
        return api.patch(`/platform/birthday-automation/${editing._id}`, body)
      }
      return api.post('/platform/birthday-automation', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['birthday-automation'] })
      setShowForm(false)
      setEditing(null)
      setForm(DEFAULT_FORM)
    },
    onError: (e: Error) => alert(e.message),
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/birthday-automation/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['birthday-automation'] }),
    onError: (e: Error) => alert(e.message),
  })

  const runNow = useMutation({
    mutationFn: () => api.post('/platform/birthday-automation/run-now', {}),
    onSuccess: (data: { enqueued?: number }) => {
      alert(`Processado: ${data.enqueued ?? 0} envio(s) enfileirado(s) para hoje.`)
    },
    onError: (e: Error) => alert(e.message),
  })

  const openEdit = (r: BirthdayRule) => {
    setEditing(r)
    setForm({
      templateName: r.templateName,
      triggerType: r.triggerType,
      dayOfMonth: r.dayOfMonth ?? 10,
      intervalMonths: r.intervalMonths ?? 6,
      sendTime: r.sendTime,
      active: r.active,
      destinationFilterTags: (r.destinationFilterTags ?? []).join('; '),
      mensagemExtra: r.mensagemExtra ?? '',
    })
    setShowForm(true)
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-gray-500">
        Envio automático de parabéns usando modelos <strong className="text-gray-400">pw-*</strong>.
        Contatos precisam ter <code className="text-brand-400">birthday</code> no CSV (
        <Link to="/platform/contacts" className="text-brand-400 hover:underline">
          Contatos
        </Link>
        ). Os envios aparecem em Agendamentos; recorrentes são planejados a cada 5 min no dia do gatilho.
      </p>

      <Card className="border-brand-800/40 bg-brand-950/15 text-xs text-gray-400 space-y-2">
        <p className="font-medium text-brand-300">Exemplos</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <strong className="text-gray-300">No dia do aniversário</strong> — Maria com
            birthday 1992-03-20 recebe em todo 20/03 às 09:00 (dedup: 1 envio por ano).
          </li>
          <li>
            <strong className="text-gray-300">Dia 10 do mês</strong> — todos os contatos
            nascidos no dia 10 (qualquer mês), útil para campanha em lote no dia 10.
          </li>
          <li>
            <strong className="text-gray-300">A cada 6 meses</strong> — no aniversário, só
            reenvia se o último parabéns automático foi há ≥6 meses.
          </li>
        </ul>
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
          <Plus size={14} /> Nova regra
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
            {editing ? 'Editar regra' : 'Nova regra de aniversário'}
          </h2>
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
            <label className="text-xs text-gray-500 block mb-1">Tipo de disparo</label>
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
              {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map(k => (
                <option key={k} value={k}>
                  {TRIGGER_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          {form.triggerType === 'day_of_month' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Dia do mês (1–31)</label>
              <input
                type="number"
                min={1}
                max={31}
                value={form.dayOfMonth}
                onChange={e =>
                  setForm(f => ({ ...f, dayOfMonth: Number(e.target.value) }))
                }
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
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Tags (opcional, separadas por ;)
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
            Regra ativa
          </label>
          <div className="flex gap-2">
            <Button onClick={() => saveRule.mutate()} disabled={saveRule.isPending}>
              {saveRule.isPending ? <Spinner size={14} /> : <Cake size={14} />}
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
          <Cake size={32} className="mx-auto mb-2 opacity-40" />
          <p>Nenhuma regra configurada</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map(r => (
            <Card key={r._id} className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-200">{r.templateName}</p>
                  <Badge label={r.active ? 'ativa' : 'pausada'} variant={r.active ? 'green' : 'gray'} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{TRIGGER_LABELS[r.triggerType]}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Horário {r.sendTime}
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
                    if (window.confirm('Remover esta regra?')) deleteRule.mutate(r._id)
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
    </div>
  )
}
