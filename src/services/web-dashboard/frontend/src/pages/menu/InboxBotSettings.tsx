import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Bot, Clock, Users, ArrowLeft, Save, Bell } from 'lucide-react'

type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

interface InboxSettings {
  welcomeWithCompany: string
  welcomeGeneric: string
  menuIntro: string
  menuFooter: string
  queueMessage: string
  waitingMessage: string
  outsideHoursMessage: string
  invalidMenuHint: string
  resolvedMessage: string
  transferMessage: string
  businessHoursEnabled: boolean
  timezone: string
  schedule: Record<Weekday, DaySchedule>
  roundRobinEnabled: boolean
  roundRobinPullTimeoutSeconds: number
  alertSoundEnabled: boolean
  alertOnNewChat: boolean
  alertOnNewMessage: boolean
}

const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
}

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'
const textareaCls = `${inputCls} min-h-[72px] resize-y`

export default function InboxBotSettings() {
  const qc = useQueryClient()
  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })
  const canManage = can(me ?? null, 'inbox:department:manage')

  const { data, isLoading } = useQuery({
    queryKey: ['inbox-settings'],
    queryFn: () => api.get<InboxSettings>('/inbox/settings'),
    enabled: canManage,
  })

  const [form, setForm] = useState<InboxSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: (payload: Partial<InboxSettings>) => api.patch('/inbox/settings', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  if (!canManage) {
    return (
      <PlatformPage title="Bot do Inbox" description="Sem permissão.">
        <p className="text-sm text-gray-500">Apenas dono ou administrador pode configurar o bot.</p>
      </PlatformPage>
    )
  }

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={28} />
      </div>
    )
  }

  const patch = <K extends keyof InboxSettings>(key: K, value: InboxSettings[K]) => {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  const patchDay = (day: Weekday, field: keyof DaySchedule, value: boolean | string) => {
    setForm(prev =>
      prev
        ? {
            ...prev,
            schedule: {
              ...prev.schedule,
              [day]: { ...prev.schedule[day], [field]: value },
            },
          }
        : prev,
    )
  }

  return (
    <PlatformPage
      title="Bot do Inbox"
      description="Personalize o menu automático, horário comercial e distribuição de conversas."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Link to="/platform/inbox/setores">
          <Button size="sm" variant="secondary">
            <ArrowLeft size={14} /> Setores
          </Button>
        </Link>
        <Link to="/platform/inbox">
          <Button size="sm" variant="secondary">Abrir Inbox</Button>
        </Link>
      </div>

      <div className="space-y-6 max-w-3xl">
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-400">
            <Bot size={18} />
            <h2 className="font-semibold text-sm text-white">Mensagens do menu</h2>
          </div>
          <p className="text-xs text-gray-500">
            Variáveis: <code className="text-gray-400">{'{company}'}</code>,{' '}
            <code className="text-gray-400">{'{department}'}</code>,{' '}
            <code className="text-gray-400">{'{waiting}'}</code>,{' '}
            <code className="text-gray-400">{'{options}'}</code>
          </p>

          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Boas-vindas (com nome da empresa)</span>
            <textarea
              className={textareaCls}
              value={form.welcomeWithCompany}
              onChange={e => patch('welcomeWithCompany', e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Boas-vindas (sem empresa)</span>
            <textarea className={textareaCls} value={form.welcomeGeneric} onChange={e => patch('welcomeGeneric', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Texto antes das opções do menu</span>
            <input className={inputCls} value={form.menuIntro} onChange={e => patch('menuIntro', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Rodapé do menu</span>
            <input className={inputCls} value={form.menuFooter} onChange={e => patch('menuFooter', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Confirmação na fila</span>
            <textarea className={textareaCls} value={form.queueMessage} onChange={e => patch('queueMessage', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Mensagem de espera (substitui {'{waiting}'})</span>
            <textarea className={textareaCls} value={form.waitingMessage} onChange={e => patch('waitingMessage', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Opção inválida no menu</span>
            <input className={inputCls} value={form.invalidMenuHint} onChange={e => patch('invalidMenuHint', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Mensagem ao finalizar</span>
            <textarea className={textareaCls} value={form.resolvedMessage} onChange={e => patch('resolvedMessage', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Mensagem ao transferir</span>
            <textarea className={textareaCls} value={form.transferMessage} onChange={e => patch('transferMessage', e.target.value)} />
          </label>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-400">
            <Clock size={18} />
            <h2 className="font-semibold text-sm text-white">Horário comercial</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.businessHoursEnabled}
              onChange={e => patch('businessHoursEnabled', e.target.checked)}
            />
            Ativar horário comercial (fora do horário envia mensagem automática)
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Fuso horário</span>
            <input
              className={inputCls}
              value={form.timezone}
              onChange={e => patch('timezone', e.target.value)}
              placeholder="America/Sao_Paulo"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Mensagem fora do horário</span>
            <textarea
              className={textareaCls}
              value={form.outsideHoursMessage}
              onChange={e => patch('outsideHoursMessage', e.target.value)}
            />
          </label>
          <div className="space-y-2">
            {WEEKDAYS.map(day => (
              <div
                key={day}
                className="flex flex-wrap items-center gap-3 py-2 border-b border-gray-800/80 last:border-0"
              >
                <label className="flex items-center gap-2 w-28 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.schedule[day]?.enabled ?? false}
                    onChange={e => patchDay(day, 'enabled', e.target.checked)}
                  />
                  {WEEKDAY_LABEL[day]}
                </label>
                <input
                  type="time"
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                  value={form.schedule[day]?.start ?? '09:00'}
                  disabled={!form.schedule[day]?.enabled}
                  onChange={e => patchDay(day, 'start', e.target.value)}
                />
                <span className="text-xs text-gray-500">até</span>
                <input
                  type="time"
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                  value={form.schedule[day]?.end ?? '18:00'}
                  disabled={!form.schedule[day]?.enabled}
                  onChange={e => patchDay(day, 'end', e.target.value)}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-400">
            <Users size={18} />
            <h2 className="font-semibold text-sm text-white">Distribuição automática</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.roundRobinEnabled}
              onChange={e => patch('roundRobinEnabled', e.target.checked)}
            />
            Round-robin — indicar prioridade ao entrar na fila (aceite voluntário)
          </label>
          <p className="text-xs text-gray-500">
            O sistema marca o próximo atendente com borda amarela e cronômetro. Ele aceita quando puder.
            Outro pode puxar se o indicado estiver ocupado ou após o tempo abaixo.
          </p>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">
              Tempo de prioridade antes de liberar para outro puxar (segundos)
            </span>
            <input
              type="number"
              min={30}
              max={900}
              className={inputCls}
              value={form.roundRobinPullTimeoutSeconds}
              disabled={!form.roundRobinEnabled}
              onChange={e => patch('roundRobinPullTimeoutSeconds', Number(e.target.value) || 120)}
            />
          </label>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-400">
            <Bell size={18} />
            <h2 className="font-semibold text-sm text-white">Alertas no painel</h2>
          </div>
          <p className="text-xs text-gray-500">
            Balão de eventos no topo (à esquerda do status online) + som opcional.
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.alertSoundEnabled}
              onChange={e => patch('alertSoundEnabled', e.target.checked)}
            />
            Sons de alerta ativados
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.alertOnNewChat}
              onChange={e => patch('alertOnNewChat', e.target.checked)}
              disabled={!form.alertSoundEnabled}
            />
            Alertar em novo chat / prioridade na fila
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.alertOnNewMessage}
              onChange={e => patch('alertOnNewMessage', e.target.checked)}
              disabled={!form.alertSoundEnabled}
            />
            Alertar em cada nova mensagem do cliente (pode ser frequente)
          </label>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
            <Save size={14} /> {save.isPending ? 'Salvando…' : 'Salvar configurações'}
          </Button>
          {saved && <span className="text-sm text-brand-400">Salvo!</span>}
          {save.isError && (
            <span className="text-sm text-red-400">{(save.error as Error).message}</span>
          )}
        </div>
      </div>
    </PlatformPage>
  )
}
