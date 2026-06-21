import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Bot, Clock, Users, ArrowLeft, Save, Bell, MessageCircle } from 'lucide-react'
import { inputCls, textareaCls, LoadingState } from '@/design-system'
import { cn } from '@/lib/utils'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { InboxBotFlowPreview } from '../../components/inbox/InboxBotFlowPreview'

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
  inactivityAutoCloseEnabled: boolean
  inactivityCloseMinutes: number
  inactivityWarningMinutes: number
  queueSlaAlertMinutes: number
  ticketTeamResponseHours: number
  csatEnabled: boolean
  csatPrompt: string
  csatThankYou: string
  whatsappFallbackEnabled: boolean
  whatsappFallbackAlertPhones: string[]
  whatsappFallbackVisitorMessage: string
  agentPresenceTimeoutSeconds: number
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

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('tabular-nums', value.length > max ? 'text-red-400' : 'text-[var(--rz-text-muted)]')}>
      {value.length}/{max}
    </span>
  )
}

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

  const { data: departments = [] } = useQuery({
    queryKey: ['inbox-departments', 'bot-preview'],
    queryFn: () =>
      api.get<Array<{ name: string; menuKey: string; clientVisible?: boolean; isActive?: boolean }>>(
        '/inbox/departments?all=1',
      ),
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
      <PlatformPage title="Triagem e Bot" description="Sem permissão.">
        <p className="text-sm text-[var(--rz-text-muted)]">Apenas dono ou administrador pode configurar o bot.</p>
      </PlatformPage>
    )
  }

  if (isLoading || !form) {
    return (
      <PlatformPage title="Triagem e Bot" description="Carregando configurações…">
        <LoadingState rows={4} className="pt-4" />
      </PlatformPage>
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
      title="Triagem e Bot"
      description="Personalize o menu automático, horário comercial e distribuição de conversas."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      <div className="flex flex-wrap gap-2 mb-4">
        <Link to="/platform/inbox/setores">
          <Button size="sm" variant="secondary">
            <ArrowLeft size={14} /> Setores
          </Button>
        </Link>
        <Link to="/platform/inbox">
          <Button size="sm" variant="secondary">Abrir caixa de entrada</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-400">
            <Bot size={18} />
            <h2 className="font-semibold text-sm text-[var(--rz-text-primary)]">Mensagens do menu</h2>
          </div>
          <p className="text-xs text-[var(--rz-text-muted)]">
            Variáveis: <code className="text-[var(--rz-text-muted)]">{'{company}'}</code>,{' '}
            <code className="text-[var(--rz-text-muted)]">{'{department}'}</code>,{' '}
            <code className="text-[var(--rz-text-muted)]">{'{waiting}'}</code>,{' '}
            <code className="text-[var(--rz-text-muted)]">{'{options}'}</code>
          </p>

          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)] flex justify-between">
              <span>Boas-vindas (com nome da empresa)</span>
              <CharCount value={form.welcomeWithCompany} max={500} />
            </span>
            <textarea
              className={textareaCls}
              value={form.welcomeWithCompany}
              onChange={e => patch('welcomeWithCompany', e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Boas-vindas (sem empresa)</span>
            <textarea className={textareaCls} value={form.welcomeGeneric} onChange={e => patch('welcomeGeneric', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Texto antes das opções do menu</span>
            <input className={inputCls} value={form.menuIntro} onChange={e => patch('menuIntro', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Rodapé do menu</span>
            <input className={inputCls} value={form.menuFooter} onChange={e => patch('menuFooter', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Confirmação na fila</span>
            <textarea className={textareaCls} value={form.queueMessage} onChange={e => patch('queueMessage', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Mensagem de espera (substitui {'{waiting}'})</span>
            <textarea className={textareaCls} value={form.waitingMessage} onChange={e => patch('waitingMessage', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Opção inválida no menu</span>
            <input className={inputCls} value={form.invalidMenuHint} onChange={e => patch('invalidMenuHint', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Mensagem ao finalizar</span>
            <textarea className={textareaCls} value={form.resolvedMessage} onChange={e => patch('resolvedMessage', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Mensagem ao transferir</span>
            <textarea className={textareaCls} value={form.transferMessage} onChange={e => patch('transferMessage', e.target.value)} />
          </label>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-400">
            <Clock size={18} />
            <h2 className="font-semibold text-sm text-[var(--rz-text-primary)]">Horário comercial</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <input
              type="checkbox"
              checked={form.businessHoursEnabled}
              onChange={e => patch('businessHoursEnabled', e.target.checked)}
            />
            Ativar horário comercial (fora do horário envia mensagem automática)
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Fuso horário</span>
            <input
              className={inputCls}
              value={form.timezone}
              onChange={e => patch('timezone', e.target.value)}
              placeholder="America/Sao_Paulo"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Mensagem fora do horário</span>
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
                className="flex flex-wrap items-center gap-3 py-2 border-b border-[var(--rz-border)]/80 last:border-0"
              >
                <label className="flex items-center gap-2 w-28 text-sm text-[var(--rz-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.schedule[day]?.enabled ?? false}
                    onChange={e => patchDay(day, 'enabled', e.target.checked)}
                  />
                  {WEEKDAY_LABEL[day]}
                </label>
                <input
                  type="time"
                  className={cn(inputCls, 'text-xs py-1 px-2 w-auto')}
                  value={form.schedule[day]?.start ?? '09:00'}
                  disabled={!form.schedule[day]?.enabled}
                  onChange={e => patchDay(day, 'start', e.target.value)}
                />
                <span className="text-xs text-[var(--rz-text-muted)]">até</span>
                <input
                  type="time"
                  className={cn(inputCls, 'text-xs py-1 px-2 w-auto')}
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
            <h2 className="font-semibold text-sm text-[var(--rz-text-primary)]">Distribuição automática</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <input
              type="checkbox"
              checked={form.roundRobinEnabled}
              onChange={e => patch('roundRobinEnabled', e.target.checked)}
            />
            Round-robin — indicar prioridade ao entrar na fila (aceite voluntário)
          </label>
          <p className="text-xs text-[var(--rz-text-muted)]">
            O sistema marca o próximo atendente com borda amarela e cronômetro. Ele aceita quando puder.
            Outro pode puxar se o indicado estiver ocupado ou após o tempo abaixo.
          </p>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">
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
            <Clock size={18} />
            <h2 className="font-semibold text-sm text-[var(--rz-text-primary)]">SLA — inatividade e fila</h2>
          </div>
          <p className="text-xs text-[var(--rz-text-muted)]">
            Encerramento automático quando o cliente não responde após mensagem do atendente.
            O atendente também pode usar <code className="text-[var(--rz-text-muted)]">/enc</code> para encerrar na hora.
            Templates em Respostas rápidas (<code className="text-[var(--rz-text-muted)]">/aus</code>,{' '}
            <code className="text-[var(--rz-text-muted)]">/enc</code>).
          </p>
          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <input
              type="checkbox"
              checked={form.inactivityAutoCloseEnabled}
              onChange={e => patch('inactivityAutoCloseEnabled', e.target.checked)}
            />
            Encerrar automaticamente por inatividade do cliente
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">
              Aviso automático antes do encerramento (minutos, 0 = desligado)
            </span>
            <input
              type="number"
              min={0}
              max={1440}
              className={inputCls}
              value={form.inactivityWarningMinutes}
              disabled={!form.inactivityAutoCloseEnabled}
              onChange={e => patch('inactivityWarningMinutes', Number(e.target.value) || 0)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">
              Encerrar após inatividade (minutos, 0 = desligado)
            </span>
            <input
              type="number"
              min={0}
              max={1440}
              className={inputCls}
              value={form.inactivityCloseMinutes}
              disabled={!form.inactivityAutoCloseEnabled}
              onChange={e => patch('inactivityCloseMinutes', Number(e.target.value) || 0)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">
              Alerta de fila parada — supervisor (minutos na fila, 0 = desligado)
            </span>
            <input
              type="number"
              min={0}
              max={1440}
              className={inputCls}
              value={form.queueSlaAlertMinutes}
              onChange={e => patch('queueSlaAlertMinutes', Number(e.target.value) || 0)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">
              SLA ticket — prazo equipe responder após mensagem do cliente (horas, 0 = desligado)
            </span>
            <input
              type="number"
              min={0}
              max={168}
              className={inputCls}
              value={form.ticketTeamResponseHours}
              onChange={e => patch('ticketTeamResponseHours', Number(e.target.value) || 0)}
            />
          </label>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-sm text-[var(--rz-text-primary)]">CSAT — satisfação pós-atendimento</h2>
          <p className="text-xs text-[var(--rz-text-muted)]">
            Após encerrar a conversa (<code className="text-[var(--rz-text-muted)]">/enc</code> ou inatividade), o
            cliente recebe pedido de nota de 1 a 5.
          </p>
          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <input
              type="checkbox"
              checked={form.csatEnabled}
              onChange={e => patch('csatEnabled', e.target.checked)}
            />
            Ativar pesquisa CSAT
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Mensagem da pesquisa</span>
            <textarea
              className={textareaCls}
              value={form.csatPrompt}
              disabled={!form.csatEnabled}
              onChange={e => patch('csatPrompt', e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--rz-text-muted)]">Agradecimento após nota</span>
            <input
              className={inputCls}
              value={form.csatThankYou}
              disabled={!form.csatEnabled}
              onChange={e => patch('csatThankYou', e.target.value)}
            />
          </label>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-400">
            <Bell size={18} />
            <h2 className="font-semibold text-sm text-[var(--rz-text-primary)]">Alertas no painel</h2>
          </div>
          <p className="text-xs text-[var(--rz-text-muted)]">
            Balão de eventos no topo (à esquerda do status online) + som opcional.
          </p>
          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <input
              type="checkbox"
              checked={form.alertSoundEnabled}
              onChange={e => patch('alertSoundEnabled', e.target.checked)}
            />
            Sons de alerta ativados
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <input
              type="checkbox"
              checked={form.alertOnNewChat}
              onChange={e => patch('alertOnNewChat', e.target.checked)}
              disabled={!form.alertSoundEnabled}
            />
            Alertar em novo chat / prioridade na fila
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <input
              type="checkbox"
              checked={form.alertOnNewMessage}
              onChange={e => patch('alertOnNewMessage', e.target.checked)}
              disabled={!form.alertSoundEnabled}
            />
            Alertar em cada nova mensagem do cliente (pode ser frequente)
          </label>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-[var(--rz-text-primary)] flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> Chat do site — fallback WhatsApp
          </h2>
          <p className="text-sm text-[var(--rz-text-muted)]">
            Quando ninguém estiver online no painel e uma conversa do site entrar na fila, o sistema pode
            avisar números/grupos WhatsApp autorizados e exibir uma mensagem ao visitante.
          </p>
          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
            <input
              type="checkbox"
              checked={form.whatsappFallbackEnabled}
              onChange={e => patch('whatsappFallbackEnabled', e.target.checked)}
            />
            Ativar fallback WhatsApp quando não houver atendente online
          </label>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">
              Números ou grupos para alerta (um por linha)
            </label>
            <textarea
              className={textareaCls}
              rows={3}
              value={(form.whatsappFallbackAlertPhones ?? []).join('\n')}
              onChange={e =>
                patch(
                  'whatsappFallbackAlertPhones',
                  e.target.value
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean),
                )
              }
              placeholder={'5511999999999\n120363012345678901@g.us'}
              disabled={!form.whatsappFallbackEnabled}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-[var(--rz-text-muted)] mb-1">
              <label>Mensagem exibida ao visitante no chat</label>
              <CharCount value={form.whatsappFallbackVisitorMessage} max={800} />
            </div>
            <textarea
              className={textareaCls}
              rows={3}
              value={form.whatsappFallbackVisitorMessage}
              onChange={e => patch('whatsappFallbackVisitorMessage', e.target.value)}
              disabled={!form.whatsappFallbackEnabled}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">
              Timeout de presença do atendente (segundos, 30–300)
            </label>
            <input
              type="number"
              min={30}
              max={300}
              className={inputCls}
              value={form.agentPresenceTimeoutSeconds}
              onChange={e => patch('agentPresenceTimeoutSeconds', Number(e.target.value))}
            />
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">
              Sem heartbeat do painel por este tempo, o atendente deixa de contar como online.
            </p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-2">
              Atendentes autorizados respondem alertas com{' '}
              <code className="text-[var(--rz-text-secondary)]">!assumir TK-…</code>,{' '}
              <code className="text-[var(--rz-text-secondary)]">!abrir TK-…</code> (abrir chamado + token no site),{' '}
              <code className="text-[var(--rz-text-secondary)]">!encerrarchat TK-…</code> (só chat WA),{' '}
              <code className="text-[var(--rz-text-secondary)]">!encerrar TK-…</code> (finalizar chamado). Cadastre o WhatsApp
              pessoal em{' '}
              <Link to="/settings/team" className="text-[var(--rz-accent)] hover:underline">
                Equipe
              </Link>
              .
            </p>
          </div>
        </Card>

        <div className="flex items-center gap-3 sticky bottom-4 z-10 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)]/95 backdrop-blur p-3 shadow-lg">
          <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
            <Save size={14} /> {save.isPending ? 'Salvando…' : 'Salvar configurações'}
          </Button>
          {saved && <span className="text-sm text-brand-400">Configurações salvas com sucesso!</span>}
          {save.isError && (
            <span className="text-sm text-red-400">{(save.error as Error).message}</span>
          )}
        </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-sm text-[var(--rz-text-primary)]">Prévia do fluxo</h2>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Atualiza conforme você edita as mensagens do menu.
            </p>
            <InboxBotFlowPreview
              welcomeText={form.welcomeWithCompany}
              menuIntro={form.menuIntro}
              menuFooter={form.menuFooter}
              queueMessage={form.queueMessage}
              departmentOptions={
                departments
                  .filter(d => d.clientVisible !== false && d.isActive !== false)
                  .slice(0, 6)
                  .map(d => `${d.menuKey} — ${d.name}`) || undefined
              }
            />
          </Card>
        </aside>
      </div>
    </PlatformPage>
  )
}
