import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import {
  Bot,
  Clock,
  Users,
  ArrowLeft,
  Bell,
  MessageCircle,
  Sparkles,
  ChevronDown,
  ExternalLink,
  Zap,
  UserPlus,
  Star,
} from 'lucide-react'
import { inputCls, textareaCls, LoadingState, ConfigSaveFooter } from '@/design-system'
import { notifyConfigSaved, mutationError } from '../../lib/notify'
import { cn } from '@/lib/utils'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { InboxBotFlowPreview } from '../../components/inbox/InboxBotFlowPreview'
import { InboundRegistrationPolicyPanel } from '../../components/inbox/InboundRegistrationPolicyPanel'
import type { InboundRegistrationPolicy } from '@radarzap-types/inbound-registration-policy'
import { DEFAULT_INBOUND_REGISTRATION_POLICY } from '@radarzap-types/inbound-registration-policy'

type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

type BotTab = 'messages' | 'schedule' | 'queue' | 'quality' | 'registration'

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
  maxConcurrentChatsPerAgent: number
  queuePositionMessage: string
  queueAllBusyMessage: string
  alertSoundEnabled: boolean
  alertOnNewChat: boolean
  alertOnNewMessage: boolean
  inactivityAutoCloseEnabled: boolean
  inactivityCloseMinutes: number
  inactivityWarningMinutes: number
  inactivityWarningMessage: string
  inactivityCloseMessage: string
  inactivityCloseGateWaitMinutes?: number
  inactivityWarningQuickCode?: string
  inactivityCloseQuickCode?: string
  inactivityCloseGracefulQuickCode?: string
  gracefulCloseQuickCode?: string
  gracefulCloseAfterPromptMinutes?: number
  gracefulCloseDetectPhrases?: boolean
  closeQuickReplyGateEnabled?: boolean
  gracefulCloseQuickReplyGateEnabled?: boolean
  queueSlaAlertMinutes: number
  ticketTeamResponseHours: number
  triageInactivityEnabled: boolean
  attendantTriageVisible?: boolean
  triageWarningMinutes: number
  triageCloseAfterWarningMinutes: number
  triageWarningMessage: string
  triageCloseMessage: string
  csatEnabled: boolean
  csatPrompt: string
  csatThankYou: string
  whatsappFallbackEnabled: boolean
  whatsappFallbackAlertPhones: string[]
  whatsappFallbackVisitorMessage: string
  whatsappFallbackAcceptTimeoutSeconds: number
  whatsappFallbackNoAgentTimeoutSeconds: number
  webchatQueueMaxWaitMinutes: number
  webchatQueueMaxWaitCloseMessage: string
  agentPresenceTimeoutSeconds: number
  presenceIdleTimeoutSeconds: number
  inboundRegistrationPolicy?: InboundRegistrationPolicy
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

const BOT_TABS: Array<{ id: BotTab; label: string; icon: typeof Bot }> = [
  { id: 'messages', label: 'Mensagens', icon: Bot },
  { id: 'schedule', label: 'Horário', icon: Clock },
  { id: 'queue', label: 'Fila e equipe', icon: Users },
  { id: 'registration', label: 'Cadastro CRM', icon: UserPlus },
  { id: 'quality', label: 'Qualidade', icon: Star },
]

const TEMPLATE_VARS = ['{company}', '{department}', '{waiting}', '{options}'] as const

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('tabular-nums', value.length > max ? 'text-red-400' : 'text-[var(--rz-text-muted)]')}>
      {value.length}/{max}
    </span>
  )
}

function VariablePills({
  focusedField,
  onInsert,
}: {
  focusedField: keyof InboxSettings | null
  onInsert: (token: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--rz-text-muted)]">Variáveis:</span>
      {TEMPLATE_VARS.map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs font-mono transition-colors',
            focusedField
              ? 'border-brand-500/40 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20'
              : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-brand-500/30',
          )}
          title={focusedField ? 'Inserir no campo selecionado' : 'Clique em um campo de texto primeiro'}
        >
          {v}
        </button>
      ))}
      {!focusedField && (
        <span className="text-[10px] text-[var(--rz-text-muted)]">Clique em um campo para inserir</span>
      )}
    </div>
  )
}

function FieldFocusWrap({
  children,
  field,
  activeField,
  onFocus,
}: {
  children: ReactNode
  field: keyof InboxSettings
  activeField: keyof InboxSettings | null
  onFocus: (field: keyof InboxSettings) => void
}) {
  return (
    <div
      onFocusCapture={() => onFocus(field)}
      className={cn(activeField === field && 'rounded-lg ring-1 ring-brand-500/30')}
    >
      {children}
    </div>
  )
}

export default function InboxBotSettings() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<BotTab>('messages')
  const [focusedField, setFocusedField] = useState<keyof InboxSettings | null>(null)
  const [slaAdvancedOpen, setSlaAdvancedOpen] = useState(true)

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '').toLowerCase()
    if (raw === 'quality' || raw === 'qualidade' || raw === 'sla' || raw === 'atalhos') {
      setTab('quality')
    }
    if (raw === 'inactivity' || raw === 'inatividade') {
      setTab('messages')
    }
    if (raw === 'registration' || raw === 'cadastro' || raw === 'crm') {
      setTab('registration')
    }
    if (raw === 'sla' || raw === 'atalhos' || raw === 'aus' || raw === 'enc') {
      setTab('quality')
      setSlaAdvancedOpen(true)
    }
  }, [])

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

  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        triageInactivityEnabled: data.triageInactivityEnabled ?? true,
        triageWarningMinutes: data.triageWarningMinutes ?? 2,
        triageCloseAfterWarningMinutes: data.triageCloseAfterWarningMinutes ?? 1,
        triageWarningMessage: data.triageWarningMessage ?? 'Você está aí?',
        triageCloseMessage: data.triageCloseMessage ?? 'Conversa encerrada por inatividade.',
        inactivityWarningQuickCode: data.inactivityWarningQuickCode ?? 'aus',
        inactivityCloseQuickCode: data.inactivityCloseQuickCode ?? 'enc',
        gracefulCloseQuickCode: data.gracefulCloseQuickCode ?? 'mais',
        gracefulCloseAfterPromptMinutes: data.gracefulCloseAfterPromptMinutes ?? 2,
        gracefulCloseDetectPhrases: data.gracefulCloseDetectPhrases ?? true,
        inactivityCloseGracefulQuickCode: data.inactivityCloseGracefulQuickCode ?? 'enc_ok',
        inactivityWarningMessage: data.inactivityWarningMessage ?? 'Você está aí?',
        inactivityCloseMessage: data.inactivityCloseMessage ?? 'Conversa encerrada por inatividade.',
        inactivityCloseGateWaitMinutes:
          data.inactivityCloseGateWaitMinutes ??
          Math.max(0, (data.inactivityCloseMinutes ?? 15) - (data.inactivityWarningMinutes ?? 10)),
        closeQuickReplyGateEnabled: data.closeQuickReplyGateEnabled ?? true,
        gracefulCloseQuickReplyGateEnabled:
          data.gracefulCloseQuickReplyGateEnabled ?? data.closeQuickReplyGateEnabled ?? true,
        attendantTriageVisible: data.attendantTriageVisible ?? false,
        inboundRegistrationPolicy: data.inboundRegistrationPolicy ?? DEFAULT_INBOUND_REGISTRATION_POLICY,
      })
    }
  }, [data])

  const save = useMutation({
    mutationFn: (payload: Partial<InboxSettings>) => api.patch('/inbox/settings', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-settings'] })
      notifyConfigSaved()
    },
    onError: mutationError,
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

  const insertVariable = (token: string) => {
    if (!focusedField || typeof form[focusedField] !== 'string') return
    const current = form[focusedField] as string
    patch(focusedField, (current + token) as InboxSettings[typeof focusedField])
  }

  const handleSave = () => save.mutate(form)

  const departmentOptions =
    departments
      .filter(d => d.clientVisible !== false && d.isActive !== false)
      .slice(0, 6)
      .map(d => `${d.menuKey} — ${d.name}`) || undefined

  return (
    <PlatformPage
      title="Triagem e Bot"
      description="Configure mensagens, horário, fila e qualidade do atendimento automático."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/platform/inbox/setores">
          <Button size="sm" variant="secondary">
            <ArrowLeft size={14} /> Setores
          </Button>
        </Link>
        <Link to="/platform/inbox/respostas">
          <Button size="sm" variant="secondary">
            <Zap size={14} /> Respostas rápidas
          </Button>
        </Link>
        <Link to="/platform/inbox/ia">
          <Button size="sm" variant="secondary">
            <Sparkles size={14} /> IA de atendimento
          </Button>
        </Link>
        <Link to="/platform/webchat">
          <Button size="sm" variant="secondary">
            <MessageCircle size={14} /> Chat do site
          </Button>
        </Link>
      </div>

      <div
        className="mb-4 inline-flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50 p-1"
        role="tablist"
        aria-label="Configurações do bot"
      >
        {BOT_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              tab === id
                ? 'border border-brand-500/30 bg-brand-500/15 text-brand-300'
                : 'border border-transparent text-[var(--rz-text-muted)] hover:bg-[var(--rz-surface-muted)]',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {tab === 'messages' && (
            <>
              <Card className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-brand-400">
                  <Bot size={18} />
                  <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Mensagens ao cliente</h2>
                </div>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Textos enviados no WhatsApp durante triagem, menu e fila.{' '}
                  <Link to="/platform/inbox/setores" className="text-[var(--rz-accent)] hover:underline">
                    Configure os setores do menu
                  </Link>
                  .
                </p>
                <VariablePills focusedField={focusedField} onInsert={insertVariable} />

                <div className="space-y-3 border-b border-[var(--rz-border)] pb-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--rz-text-muted)]">Boas-vindas</h3>
                  <FieldFocusWrap field="welcomeWithCompany" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="flex justify-between text-xs text-[var(--rz-text-muted)]">
                        <span>Com nome da empresa</span>
                        <CharCount value={form.welcomeWithCompany} max={500} />
                      </span>
                      <textarea
                        className={textareaCls}
                        value={form.welcomeWithCompany}
                        onChange={e => patch('welcomeWithCompany', e.target.value)}
                      />
                    </label>
                  </FieldFocusWrap>
                  <FieldFocusWrap field="welcomeGeneric" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Sem nome da empresa</span>
                      <textarea
                        className={textareaCls}
                        value={form.welcomeGeneric}
                        onChange={e => patch('welcomeGeneric', e.target.value)}
                      />
                    </label>
                  </FieldFocusWrap>
                </div>

                <div className="space-y-3 border-b border-[var(--rz-border)] pb-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--rz-text-muted)]">Menu de setores</h3>
                  <FieldFocusWrap field="menuIntro" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Texto antes das opções</span>
                      <input className={inputCls} value={form.menuIntro} onChange={e => patch('menuIntro', e.target.value)} />
                    </label>
                  </FieldFocusWrap>
                  <FieldFocusWrap field="menuFooter" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Rodapé do menu</span>
                      <input className={inputCls} value={form.menuFooter} onChange={e => patch('menuFooter', e.target.value)} />
                    </label>
                  </FieldFocusWrap>
                  <FieldFocusWrap field="invalidMenuHint" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Opção inválida</span>
                      <input
                        className={inputCls}
                        value={form.invalidMenuHint}
                        onChange={e => patch('invalidMenuHint', e.target.value)}
                      />
                    </label>
                  </FieldFocusWrap>
                </div>

                <div className="space-y-3 border-b border-[var(--rz-border)] pb-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--rz-text-muted)]">Fila de espera</h3>
                  <FieldFocusWrap field="queueMessage" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Confirmação ao entrar na fila</span>
                      <textarea className={textareaCls} value={form.queueMessage} onChange={e => patch('queueMessage', e.target.value)} />
                    </label>
                  </FieldFocusWrap>
                  <FieldFocusWrap field="waitingMessage" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Mensagem de espera (substitui {'{waiting}'})</span>
                      <textarea
                        className={textareaCls}
                        value={form.waitingMessage}
                        onChange={e => patch('waitingMessage', e.target.value)}
                      />
                    </label>
                  </FieldFocusWrap>
                  <FieldFocusWrap field="queuePositionMessage" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Posição na fila</span>
                      <textarea
                        className={textareaCls}
                        value={form.queuePositionMessage}
                        onChange={e => patch('queuePositionMessage', e.target.value)}
                        placeholder="Ex.: Você é o {position}º da fila…"
                      />
                    </label>
                  </FieldFocusWrap>
                  <FieldFocusWrap field="queueAllBusyMessage" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Todos os atendentes ocupados</span>
                      <textarea
                        className={textareaCls}
                        value={form.queueAllBusyMessage}
                        onChange={e => patch('queueAllBusyMessage', e.target.value)}
                      />
                    </label>
                  </FieldFocusWrap>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--rz-text-muted)]">Encerramento e transferência</h3>
                  <FieldFocusWrap field="resolvedMessage" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Ao finalizar atendimento</span>
                      <textarea
                        className={textareaCls}
                        value={form.resolvedMessage}
                        onChange={e => patch('resolvedMessage', e.target.value)}
                      />
                    </label>
                  </FieldFocusWrap>
                  <FieldFocusWrap field="transferMessage" activeField={focusedField} onFocus={setFocusedField}>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--rz-text-muted)]">Ao transferir setor</span>
                      <textarea
                        className={textareaCls}
                        value={form.transferMessage}
                        onChange={e => patch('transferMessage', e.target.value)}
                      />
                    </label>
                  </FieldFocusWrap>
                </div>
              </Card>

              <Card className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-brand-400">
                  <Clock size={18} />
                  <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">
                    Inatividade automática (atendimento humano)
                  </h2>
                </div>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  O sistema envia estas mensagens quando o <strong>cliente para de responder</strong> após a última
                  mensagem do atendente. Use <code className="text-[var(--rz-text-muted)]">[user]</code> ou{' '}
                  <code className="text-[var(--rz-text-muted)]">[nome]</code> para o primeiro nome. Tempos e atalhos
                  manuais (<span className="font-mono">/aus</span> · <span className="font-mono">/enc</span>) ficam
                  em{' '}
                  <button
                    type="button"
                    className="text-[var(--rz-accent)] hover:underline"
                    onClick={() => setTab('quality')}
                  >
                    Qualidade → Atalhos
                  </button>
                  .
                </p>
                <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.inactivityAutoCloseEnabled}
                    onChange={e => patch('inactivityAutoCloseEnabled', e.target.checked)}
                  />
                  Encerrar automaticamente por inatividade
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-[var(--rz-text-muted)]">Minutos sem resposta até aviso</span>
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
                    <span className="text-xs text-[var(--rz-text-muted)]">Minutos totais sem resposta até encerrar</span>
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
                </div>
                <FieldFocusWrap field="inactivityWarningMessage" activeField={focusedField} onFocus={setFocusedField}>
                  <label className="block space-y-1">
                    <span className="text-xs text-[var(--rz-text-muted)]">Mensagem de aviso</span>
                    <input
                      className={inputCls}
                      value={form.inactivityWarningMessage}
                      disabled={!form.inactivityAutoCloseEnabled}
                      onChange={e => patch('inactivityWarningMessage', e.target.value)}
                      placeholder="Você está aí?"
                    />
                  </label>
                </FieldFocusWrap>
                <FieldFocusWrap field="inactivityCloseMessage" activeField={focusedField} onFocus={setFocusedField}>
                  <label className="block space-y-1">
                    <span className="text-xs text-[var(--rz-text-muted)]">Mensagem de encerramento</span>
                    <textarea
                      className={textareaCls}
                      value={form.inactivityCloseMessage}
                      disabled={!form.inactivityAutoCloseEnabled}
                      onChange={e => patch('inactivityCloseMessage', e.target.value)}
                      placeholder="Conversa encerrada por inatividade."
                    />
                  </label>
                </FieldFocusWrap>
                {form.inactivityAutoCloseEnabled && (
                  <p className="text-xs text-[var(--rz-text-muted)]">
                    Após o aviso, o sistema espera{' '}
                    <strong>
                      {Math.max(
                        0,
                        (form.inactivityCloseMinutes ?? 0) - (form.inactivityWarningMinutes ?? 0),
                      )}{' '}
                      min
                    </strong>{' '}
                    antes de enviar a mensagem de encerramento (total − aviso).
                  </p>
                )}
              </Card>
            </>
          )}

          {tab === 'schedule' && (
            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-2 text-brand-400">
                <Clock size={18} />
                <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Horário comercial</h2>
              </div>
              <p className="text-xs text-[var(--rz-text-muted)]">
                Fora do expediente o bot envia a mensagem automática abaixo. O{' '}
                <Link to="/platform/webchat" className="text-[var(--rz-accent)] hover:underline">
                  Chat do site
                </Link>{' '}
                pode herdar este horário ou usar um próprio.
              </p>
              <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                <input
                  type="checkbox"
                  checked={form.businessHoursEnabled}
                  onChange={e => patch('businessHoursEnabled', e.target.checked)}
                />
                Ativar horário comercial
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
                    className="flex flex-wrap items-center gap-3 border-b border-[var(--rz-border)]/80 py-2 last:border-0"
                  >
                    <label className="flex w-28 items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={form.schedule[day]?.enabled ?? false}
                        onChange={e => patchDay(day, 'enabled', e.target.checked)}
                      />
                      {WEEKDAY_LABEL[day]}
                    </label>
                    <input
                      type="time"
                      className={cn(inputCls, 'w-auto px-2 py-1 text-xs')}
                      value={form.schedule[day]?.start ?? '09:00'}
                      disabled={!form.schedule[day]?.enabled}
                      onChange={e => patchDay(day, 'start', e.target.value)}
                    />
                    <span className="text-xs text-[var(--rz-text-muted)]">até</span>
                    <input
                      type="time"
                      className={cn(inputCls, 'w-auto px-2 py-1 text-xs')}
                      value={form.schedule[day]?.end ?? '18:00'}
                      disabled={!form.schedule[day]?.enabled}
                      onChange={e => patchDay(day, 'end', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'queue' && (
            <>
              <Card className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-brand-400">
                  <Users size={18} />
                  <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Distribuição na fila</h2>
                </div>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  O cliente escolhe o setor no menu WhatsApp. Com round-robin, o sistema indica o próximo atendente
                  disponível na fila.
                </p>
                <label className="flex items-start gap-3 rounded-lg border border-[var(--rz-border)] p-3 has-[:checked]:border-brand-500/40 has-[:checked]:bg-brand-500/5">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.roundRobinEnabled}
                    onChange={e => patch('roundRobinEnabled', e.target.checked)}
                  />
                  <div>
                    <span className="text-sm font-medium text-[var(--rz-text-primary)]">Round-robin</span>
                    <p className="mt-0.5 text-xs text-[var(--rz-text-muted)]">
                      Indica prioridade ao entrar na fila — borda amarela e cronômetro no painel. Outro atendente pode
                      puxar após o tempo configurado.
                    </p>
                  </div>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">
                    Tempo de prioridade antes de liberar para outro (segundos)
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
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">
                    Máximo de atendimentos simultâneos por atendente
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className={inputCls}
                    value={form.maxConcurrentChatsPerAgent ?? 1}
                    disabled={!form.roundRobinEnabled}
                    onChange={e => patch('maxConcurrentChatsPerAgent', Number(e.target.value) || 1)}
                  />
                </label>
              </Card>

              <Card className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-brand-400">
                  <MessageCircle size={18} />
                  <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Triagem no Inbox</h2>
                </div>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Por padrão, só dono e administrador veem conversas em triagem (antes da escolha do setor).
                </p>
                <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.attendantTriageVisible ?? false}
                    onChange={e => patch('attendantTriageVisible', e.target.checked)}
                  />
                  Atendentes podem ver e assumir conversas em triagem
                </label>
              </Card>

              <Card className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-brand-400">
                  <MessageCircle size={18} />
                  <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Inatividade na triagem</h2>
                </div>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Durante o menu de setores, se o visitante não responder, o sistema avisa e encerra. Use{' '}
                  <code className="text-[var(--rz-text-muted)]">[user]</code> ou{' '}
                  <code className="text-[var(--rz-text-muted)]">[nome]</code> para o primeiro nome.
                </p>
                <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.triageInactivityEnabled}
                    onChange={e => patch('triageInactivityEnabled', e.target.checked)}
                  />
                  Encerrar triagem automaticamente por inatividade
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">Minutos até enviar aviso</span>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    className={inputCls}
                    value={form.triageWarningMinutes}
                    disabled={!form.triageInactivityEnabled}
                    onChange={e => patch('triageWarningMinutes', Number(e.target.value) || 0)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">Mensagem de aviso</span>
                  <input
                    className={inputCls}
                    value={form.triageWarningMessage}
                    disabled={!form.triageInactivityEnabled}
                    onChange={e => patch('triageWarningMessage', e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">Minutos após aviso para encerrar (0 = desligado)</span>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    className={inputCls}
                    value={form.triageCloseAfterWarningMinutes}
                    disabled={!form.triageInactivityEnabled}
                    onChange={e => patch('triageCloseAfterWarningMinutes', Number(e.target.value) || 0)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">Mensagem de encerramento</span>
                  <input
                    className={inputCls}
                    value={form.triageCloseMessage}
                    disabled={!form.triageInactivityEnabled}
                    onChange={e => patch('triageCloseMessage', e.target.value)}
                  />
                </label>
              </Card>

              <Card className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-brand-400">
                  <Bell size={18} />
                  <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Alertas operacionais</h2>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">
                    Alerta de fila parada — supervisor (minutos, 0 = desligado)
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
                <p className="text-xs text-[var(--rz-text-muted)]">Sons no painel do atendente:</p>
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
                  Novo chat / prioridade na fila
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.alertOnNewMessage}
                    onChange={e => patch('alertOnNewMessage', e.target.checked)}
                    disabled={!form.alertSoundEnabled}
                  />
                  Cada nova mensagem do cliente
                </label>
              </Card>

              <Card className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rz-text-primary)]">
                    <Users size={18} className="text-brand-400" />
                    Presença dos atendentes
                  </h2>
                  <Link to="/settings/team" className="text-xs text-[var(--rz-accent)] hover:underline">
                    Equipe
                  </Link>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">Timeout de presença (segundos, 30–300)</span>
                  <input
                    type="number"
                    min={30}
                    max={300}
                    className={inputCls}
                    value={form.agentPresenceTimeoutSeconds}
                    onChange={e => patch('agentPresenceTimeoutSeconds', Number(e.target.value))}
                  />
                  <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
                    Sem heartbeat do painel, o atendente deixa de contar como online.
                  </p>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">Inatividade antes de marcar ausente (60–3600 s)</span>
                  <input
                    type="number"
                    min={60}
                    max={3600}
                    className={inputCls}
                    value={form.presenceIdleTimeoutSeconds}
                    onChange={e => patch('presenceIdleTimeoutSeconds', Number(e.target.value))}
                  />
                </label>
              </Card>

              <Card className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-semibold text-[var(--rz-text-primary)]">
                    <MessageCircle className="h-5 w-5" /> Fallback WhatsApp (fila)
                  </h2>
                  <Link
                    to="/platform/webchat"
                    className="inline-flex items-center gap-1 text-xs text-[var(--rz-accent)] hover:underline"
                  >
                    Chat do site <ExternalLink size={12} />
                  </Link>
                </div>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Alerta a equipe no WhatsApp quando a fila estoura o tempo sem aceite — vale para
                  conversas do <strong>WhatsApp</strong> e do <strong>chat do site</strong>. Com
                  atendente online indicado, aguarda mais tempo; sem ninguém disponível, o alerta
                  pode ser imediato (se ativado abaixo).{' '}
                  <Link to="/platform/inbox/comandos-wa" className="text-[var(--rz-accent)] hover:underline">
                    Gerenciar comandos !assumir / bridge
                  </Link>
                </p>
                <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.whatsappFallbackEnabled}
                    onChange={e => patch('whatsappFallbackEnabled', e.target.checked)}
                  />
                  Ativar fallback WhatsApp para filas (WhatsApp + site)
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">
                    Com atendente indicado online — tempo para aceitar (segundos, 30–900)
                  </span>
                  <input
                    type="number"
                    min={30}
                    max={900}
                    className={inputCls}
                    value={form.whatsappFallbackAcceptTimeoutSeconds ?? 120}
                    onChange={e => patch('whatsappFallbackAcceptTimeoutSeconds', Number(e.target.value))}
                    disabled={!form.whatsappFallbackEnabled}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">
                    Sem atendente disponível — tempo antes do alerta (0 = imediato, máx. 120s)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    className={inputCls}
                    value={form.whatsappFallbackNoAgentTimeoutSeconds ?? 0}
                    onChange={e => patch('whatsappFallbackNoAgentTimeoutSeconds', Number(e.target.value))}
                    disabled={!form.whatsappFallbackEnabled}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">
                    Tempo máximo na fila do site antes de encerrar o chat (minutos, 0 = desligado)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={480}
                    className={inputCls}
                    value={form.webchatQueueMaxWaitMinutes ?? 45}
                    onChange={e => patch('webchatQueueMaxWaitMinutes', Number(e.target.value))}
                    disabled={!form.whatsappFallbackEnabled}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="flex justify-between text-xs text-[var(--rz-text-muted)]">
                    <span>Mensagem ao encerrar por tempo máximo na fila</span>
                    <CharCount value={form.webchatQueueMaxWaitCloseMessage} max={800} />
                  </span>
                  <textarea
                    className={textareaCls}
                    rows={3}
                    value={form.webchatQueueMaxWaitCloseMessage ?? ''}
                    onChange={e => patch('webchatQueueMaxWaitCloseMessage', e.target.value)}
                    disabled={!form.whatsappFallbackEnabled || !(form.webchatQueueMaxWaitMinutes ?? 0)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">Números ou grupos para alerta (um por linha)</span>
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
                </label>
                <label className="block space-y-1">
                  <span className="flex justify-between text-xs text-[var(--rz-text-muted)]">
                    <span>Mensagem ao cliente (WhatsApp ou visitante no site)</span>
                    <CharCount value={form.whatsappFallbackVisitorMessage} max={800} />
                  </span>
                  <textarea
                    className={textareaCls}
                    rows={3}
                    value={form.whatsappFallbackVisitorMessage}
                    onChange={e => patch('whatsappFallbackVisitorMessage', e.target.value)}
                    disabled={!form.whatsappFallbackEnabled}
                  />
                </label>
              </Card>
            </>
          )}

          {tab === 'registration' && form.inboundRegistrationPolicy && (
            <InboundRegistrationPolicyPanel
              policy={form.inboundRegistrationPolicy}
              onChange={policy => patch('inboundRegistrationPolicy', policy)}
            />
          )}

          {tab === 'quality' && (
            <>
              <Card className="space-y-3 p-5 border-brand-500/25 bg-brand-500/5">
                <h2 className="text-sm font-semibold text-[var(--rz-text-primary)] flex items-center gap-2">
                  <Zap size={16} className="text-brand-400" />
                  Atalhos /aus, /enc no chat (Inbox)
                </h2>
                <p className="text-xs text-[var(--rz-text-muted)] leading-relaxed">
                  Os botões <span className="font-mono text-brand-300">/aus</span>,{' '}
                  <span className="font-mono text-brand-300">/enc</span>,{' '}
                  <span className="font-mono text-brand-300">/mais</span> aparecem{' '}
                  <strong>dentro da conversa</strong> em{' '}
                  <Link to="/platform/inbox" className="text-[var(--rz-accent)] hover:underline">
                    Inbox
                  </Link>{' '}
                  (abaixo da caixa de mensagem), não nesta página.
                </p>
                <ul className="text-xs text-[var(--rz-text-muted)] space-y-1 list-disc pl-4">
                  <li>
                    <strong>Texto</strong> de cada atalho →{' '}
                    <Link to="/platform/inbox/respostas" className="text-[var(--rz-accent)] hover:underline">
                      Respostas rápidas
                    </Link>
                  </li>
                  <li>
                    <strong>Códigos</strong> (/aus, /enc…) e <strong>tempos</strong> → cards abaixo nesta aba
                    Qualidade
                  </li>
                </ul>
              </Card>

              <Card className="space-y-4 p-5">
                <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">CSAT — satisfação pós-atendimento</h2>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Após encerrar a conversa, o cliente recebe pedido de nota de 1 a 5.
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

              <Card className="space-y-4 p-5">
                <button
                  type="button"
                  onClick={() => setSlaAdvancedOpen(v => !v)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">
                      Atalhos e bloqueio (/aus · /mais)
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--rz-text-muted)]">
                      Códigos dos atalhos (não confundir com o texto enviado ao cliente). Textos em{' '}
                      <Link
                        to="/platform/inbox/respostas"
                        className="text-[var(--rz-accent)] hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        Respostas rápidas
                      </Link>
                      . Uso no chat:{' '}
                      <Link
                        to="/platform/inbox"
                        className="text-[var(--rz-accent)] hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        Inbox → conversa aberta
                      </Link>
                      .
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={cn('shrink-0 text-[var(--rz-text-muted)] transition-transform', slaAdvancedOpen && 'rotate-180')}
                  />
                </button>

                {slaAdvancedOpen && (
                  <div className="space-y-4 border-t border-[var(--rz-border)] pt-4">
                    <div className="space-y-3 rounded-lg border border-[var(--rz-border)] p-3">
                      <h3 className="text-sm font-medium text-[var(--rz-text-primary)]">
                        Atalho inatividade (atendente)
                      </h3>
                      <p className="text-xs text-[var(--rz-text-muted)]">
                        Você envia manualmente no Inbox — independente do encerramento automático do bot.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-xs text-[var(--rz-text-muted)]">Código do aviso</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-[var(--rz-text-muted)]">/</span>
                            <input
                              className={inputCls}
                              value={form.inactivityWarningQuickCode ?? 'aus'}
                              onChange={e =>
                                patch('inactivityWarningQuickCode', e.target.value.replace(/\s/g, '').toLowerCase())
                              }
                            />
                          </div>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs text-[var(--rz-text-muted)]">Código do encerramento</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-[var(--rz-text-muted)]">/</span>
                            <input
                              className={inputCls}
                              value={form.inactivityCloseQuickCode ?? 'enc'}
                              onChange={e =>
                                patch('inactivityCloseQuickCode', e.target.value.replace(/\s/g, '').toLowerCase())
                              }
                            />
                          </div>
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-xs text-[var(--rz-text-muted)]">
                          Minutos após /{form.inactivityWarningQuickCode ?? 'aus'} para liberar /{form.inactivityCloseQuickCode ?? 'enc'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={1440}
                          className={inputCls}
                          value={form.inactivityCloseGateWaitMinutes ?? 5}
                          onChange={e => patch('inactivityCloseGateWaitMinutes', Number(e.target.value) || 0)}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                        <input
                          type="checkbox"
                          checked={form.closeQuickReplyGateEnabled ?? true}
                          onChange={e => patch('closeQuickReplyGateEnabled', e.target.checked)}
                        />
                        Bloquear /{form.inactivityCloseQuickCode ?? 'enc'} até /{form.inactivityWarningQuickCode ?? 'aus'}{' '}
                        + tempo
                      </label>
                      <p className="text-xs text-[var(--rz-text-muted)]">
                        Fluxo: envie /{form.inactivityWarningQuickCode ?? 'aus'} no Inbox → aguarde{' '}
                        {form.inactivityCloseGateWaitMinutes ?? 5} min → /{form.inactivityCloseQuickCode ?? 'enc'}{' '}
                        libera.
                      </p>
                    </div>

                    <div className="space-y-3 rounded-lg border border-[var(--rz-border)] p-3">
                      <h3 className="text-sm font-medium text-[var(--rz-text-primary)]">Encerramento natural</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-xs text-[var(--rz-text-muted)]">Pergunta final</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-[var(--rz-text-muted)]">/</span>
                            <input
                              className={inputCls}
                              value={form.gracefulCloseQuickCode ?? 'mais'}
                              onChange={e =>
                                patch('gracefulCloseQuickCode', e.target.value.replace(/\s/g, '').toLowerCase())
                              }
                            />
                          </div>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs text-[var(--rz-text-muted)]">Despedida cordial</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-[var(--rz-text-muted)]">/</span>
                            <input
                              className={inputCls}
                              value={form.inactivityCloseGracefulQuickCode ?? 'enc_ok'}
                              onChange={e =>
                                patch(
                                  'inactivityCloseGracefulQuickCode',
                                  e.target.value.replace(/\s/g, '').toLowerCase(),
                                )
                              }
                            />
                          </div>
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-xs text-[var(--rz-text-muted)]">
                          Minutos após /{form.gracefulCloseQuickCode ?? 'mais'} para liberar /{form.inactivityCloseGracefulQuickCode ?? 'enc_ok'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={1440}
                          className={inputCls}
                          value={form.gracefulCloseAfterPromptMinutes ?? 2}
                          onChange={e => patch('gracefulCloseAfterPromptMinutes', Number(e.target.value) || 0)}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                        <input
                          type="checkbox"
                          checked={form.gracefulCloseQuickReplyGateEnabled ?? true}
                          onChange={e => patch('gracefulCloseQuickReplyGateEnabled', e.target.checked)}
                        />
                        Bloquear /{form.inactivityCloseGracefulQuickCode ?? 'enc_ok'} até /{form.gracefulCloseQuickCode ?? 'mais'}{' '}
                        + tempo ou resposta do cliente
                      </label>
                      <p className="text-xs text-[var(--rz-text-muted)]">
                        Fluxo: envie /{form.gracefulCloseQuickCode ?? 'mais'} → aguarde o cliente responder (ou{' '}
                        {form.gracefulCloseAfterPromptMinutes ?? 2} min) → /{form.inactivityCloseGracefulQuickCode ?? 'enc_ok'}{' '}
                        libera no Inbox.
                      </p>
                      <label className="flex items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
                        <input
                          type="checkbox"
                          checked={form.gracefulCloseDetectPhrases ?? true}
                          onChange={e => patch('gracefulCloseDetectPhrases', e.target.checked)}
                        />
                        Detectar &quot;não&quot;, &quot;obrigado&quot;, &quot;só isso&quot;
                      </label>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="space-y-4 p-5">
                <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">SLA de chamados (TK)</h2>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Prazo para a equipe responder após mensagem do cliente em um chamado.{' '}
                  <Link to="/platform/inbox/tickets" className="text-[var(--rz-accent)] hover:underline">
                    Ver chamados
                  </Link>
                </p>
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--rz-text-muted)]">Horas para resposta (0 = desligado)</span>
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
            </>
          )}

        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Prévia do fluxo</h2>
            <p className="text-xs text-[var(--rz-text-muted)]">
              {tab === 'messages'
                ? 'Atualiza conforme você edita as mensagens.'
                : tab === 'schedule'
                  ? 'Horário comercial afeta quando o bot responde automaticamente.'
                  : 'Use a aba Mensagens para ver a prévia do menu WhatsApp.'}
            </p>
            {(tab === 'messages' || tab === 'schedule') && (
              <InboxBotFlowPreview
                welcomeText={form.welcomeWithCompany}
                menuIntro={form.menuIntro}
                menuFooter={form.menuFooter}
                queueMessage={form.queueMessage}
                departmentOptions={departmentOptions}
              />
            )}
            {tab === 'schedule' && form.businessHoursEnabled && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Fora do horário: {form.outsideHoursMessage.slice(0, 120)}
                {form.outsideHoursMessage.length > 120 ? '…' : ''}
              </p>
            )}
          </Card>
        </aside>
      </div>

      <ConfigSaveFooter onSave={handleSave} saving={save.isPending} />
    </PlatformPage>
  )
}
